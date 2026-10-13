/* GradeAlign — js/scoring.js
 * Batch upload + extraction (pdf.js / mammoth.js, lazy pinned CDNs),
 * CSV grade parsing (pure — Node-tested), and the concurrency-limited
 * scoring runner (3 in flight, retries, per-paper callbacks).
 * Exposed as window.GradeAlignScoring / globalThis.GradeAlignScoring.
 */
(function (global) {
  'use strict';

  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/mammoth.browser.min.js';

  function loadScriptOnce(url, check) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-gradealign-src="' + url + '"]');
      if (existing && check()) { resolve(); return; }
      var s = document.createElement('script');
      s.src = url;
      s.setAttribute('data-gradealign-src', url);
      s.onload = function () { check() ? resolve() : reject(new Error(url + ' loaded but did not initialize')); };
      s.onerror = function () { reject(new Error('Could not load ' + url + ' — check your internet connection.')); };
      document.head.appendChild(s);
    });
  }

  function loadPdfJs() {
    return loadScriptOnce(PDFJS_URL, function () { return !!global.pdfjsLib; }).then(function () {
      global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return global.pdfjsLib;
    });
  }

  function loadMammoth() {
    return loadScriptOnce(MAMMOTH_URL, function () { return !!global.mammoth; }).then(function () {
      return global.mammoth;
    });
  }

  function wordCount(text) {
    var m = String(text || '').trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }

  /* Extract plain text from a File. Returns Promise<string>. */
  function extractTextFromFile(file) {
    var ext = extOf(file.name);
    if (ext === 'txt' || ext === 'md' || ext === 'text') {
      return file.text();
    }
    if (ext === 'pdf') {
      return file.arrayBuffer().then(function (buf) {
        return loadPdfJs().then(function (pdfjsLib) {
          return pdfjsLib.getDocument({ data: buf }).promise;
        }).then(function (pdf) {
          var pages = [];
          var chain = Promise.resolve();
          var _loop = function (i) {
            chain = chain.then(function () {
              return pdf.getPage(i).then(function (page) {
                return page.getTextContent().then(function (tc) {
                  var lastY = null, line = '';
                  tc.items.forEach(function (it) {
                    var y = it.transform ? it.transform[5] : null;
                    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { line += '\n'; }
                    line += it.str;
                    lastY = y;
                  });
                  pages.push(line);
                });
              });
            });
          };
          for (var i = 1; i <= pdf.numPages; i++) { _loop(i); }
          return chain.then(function () { return pages.join('\n\n'); });
        });
      });
    }
    if (ext === 'docx') {
      return file.arrayBuffer().then(function (buf) {
        return loadMammoth().then(function (mammoth) {
          return mammoth.extractRawText({ arrayBuffer: buf });
        }).then(function (res) { return res.value || ''; });
      });
    }
    return Promise.reject(new Error('Unsupported file type ".' + ext + '" — use PDF, DOCX, or TXT.'));
  }

  /* --------------------------- CSV grade parser --------------------------- */

  /* Minimal RFC-4180-ish CSV parser → array of row arrays. */
  function parseCsv(text) {
    var rows = [], row = [], field = '', inQ = false;
    var s = String(text == null ? '' : text).replace(/^﻿/, '');
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (inQ) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else { inQ = false; }
        } else { field += ch; }
      } else if (ch === '"') { inQ = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') { i++; }
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') { rows.push(row); }
        row = [];
      } else { field += ch; }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* Parse a grades CSV ("paper,grade" with an optional header row).
   * Returns {grades: {key: grade}, errors: [], matchedHeader: bool}.
   * Keys are lowercased trim of column 1 — matching against paper labels
   * happens in the caller. */
  function parseGradesCsv(text) {
    var rows = parseCsv(text);
    var errors = [], grades = {};
    if (!rows.length) { return { grades: grades, errors: ['CSV is empty.'] }; }
    var start = 0;
    var first = rows[0].map(function (c) { return c.trim().toLowerCase(); });
    if (first.length >= 2 && isNaN(Number(first[1]))) {
      // header row
      start = 1;
    }
    for (var i = start; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 2) { errors.push('Row ' + (i + 1) + ': expected two columns (paper, grade).'); continue; }
      var key = r[0].trim();
      var raw = r[1].trim().replace(/%$/, '');
      var g = Number(raw);
      if (!key) { errors.push('Row ' + (i + 1) + ': empty paper name.'); continue; }
      if (raw === '' || !isFinite(g)) { errors.push('Row ' + (i + 1) + ': "' + r[1].trim() + '" is not a number.'); continue; }
      grades[key.toLowerCase()] = g;
    }
    if (!Object.keys(grades).length && !errors.length) { errors.push('No grade rows found.'); }
    return { grades: grades, errors: errors, hadHeader: start === 1 };
  }

  /* Match a CSV key to a paper. Accepts: exact file name, anonymized id
   * ("Paper 3"), or 1-based index ("3"). */
  function matchPaperKey(key, papers) {
    var k = String(key || '').trim().toLowerCase();
    if (!k) { return null; }
    var byIndex = /^(\d{1,3})$/.exec(k);
    for (var i = 0; i < papers.length; i++) {
      var p = papers[i];
      if (String(p.name || '').toLowerCase() === k) { return p; }
      if (('paper ' + (i + 1)) === k) { return p; }
    }
    if (byIndex) {
      var n = Number(byIndex[1]);
      if (n >= 1 && n <= papers.length) { return papers[n - 1]; }
    }
    return null;
  }

  /* --------------------- concurrency-limited batch runner --------------------- */

  /* runBatch(items, worker, opts)
   *   items: array of anything
   *   worker(item) → Promise
   *   opts: {concurrency (default 3), retries (default 2), retryDelayMs,
   *          onItemStart(item), onItemDone(item, result), onItemError(item, err, willRetry),
   *          onProgress(done, total), shouldStop() -> bool}
   * Resolves {results: Map(item→result), errors: Map(item→err)}. */
  function runBatch(items, worker, opts) {
    opts = opts || {};
    var concurrency = opts.concurrency || 3;
    var retries = opts.retries != null ? opts.retries : 2;
    var retryDelayMs = opts.retryDelayMs != null ? opts.retryDelayMs : 1200;
    var queue = items.slice();
    var results = new Map(), errors = new Map();
    var done = 0, stopped = false;

    function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function attempt(item, triesLeft) {
      if (opts.onItemStart) { opts.onItemStart(item); }
      return worker(item).then(function (res) {
        results.set(item, res);
        if (opts.onItemDone) { opts.onItemDone(item, res); }
      }).catch(function (err) {
        if (triesLeft > 0 && !(opts.shouldStop && opts.shouldStop())) {
          if (opts.onItemError) { opts.onItemError(item, err, true); }
          return delay(retryDelayMs).then(function () { return attempt(item, triesLeft - 1); });
        }
        errors.set(item, err);
        if (opts.onItemError) { opts.onItemError(item, err, false); }
      });
    }

    function next() {
      if (opts.shouldStop && opts.shouldStop()) { stopped = true; }
      if (stopped || !queue.length) { return Promise.resolve(); }
      var item = queue.shift();
      return attempt(item, retries).then(function () {
        done++;
        if (opts.onProgress) { opts.onProgress(done, items.length); }
        return next();
      });
    }

    var lanes = [];
    for (var i = 0; i < Math.min(concurrency, items.length); i++) { lanes.push(next()); }
    return Promise.all(lanes).then(function () { return { results: results, errors: errors, stopped: stopped }; });
  }

  global.GradeAlignScoring = {
    PDFJS_URL: PDFJS_URL,
    MAMMOTH_URL: MAMMOTH_URL,
    loadPdfJs: loadPdfJs,
    loadMammoth: loadMammoth,
    extractTextFromFile: extractTextFromFile,
    wordCount: wordCount,
    parseCsv: parseCsv,
    parseGradesCsv: parseGradesCsv,
    matchPaperKey: matchPaperKey,
    runBatch: runBatch
  };
})(typeof window !== 'undefined' ? window : globalThis);
