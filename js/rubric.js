/* GradeAlign — js/rubric.js
 * Rubric model + generation logic (pure where possible — runs in Node):
 *   - suggestAssignmentType(text)   keyword heuristics → assignment type
 *   - buildTemplateRubric(standardId, assignmentType) → rubric object
 *   - parseAiRubricJson(text, fallbackRubric) → rubric object (tolerant)
 *   - validateRubric(rubric) → {ok, errors}
 *   - rubricMaxPoints / criterionPoints / scoreToPoints math
 *   - rubricToPlainText(rubric)
 *   - buildRubricDocx(rubric, meta) → Promise<Blob> (browser; docx.js lazy CDN)
 * Exposed as window.GradeAlignRubric / globalThis.GradeAlignRubric.
 */
(function (global) {
  'use strict';

  var Standards = global.GradeAlignStandards;
  var LEVELS = Standards.LEVELS; // Exemplary 4 … Beginning 1

  var DOCX_URL = 'https://cdn.jsdelivr.net/npm/docx@9.8.1/dist/index.iife.min.js';
  var docxLoadPromise = null;

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

  function loadDocx() {
    if (global.docx) { return Promise.resolve(global.docx); }
    if (docxLoadPromise) { return docxLoadPromise; }
    docxLoadPromise = loadScriptOnce(DOCX_URL, function () { return !!global.docx; })
      .then(function () { return global.docx; })
      .catch(function (e) { docxLoadPromise = null; throw e; });
    return docxLoadPromise;
  }

  /* --------------------- assignment-type heuristics --------------------- */

  var TYPE_KEYWORDS = {
    case: ['case study', 'case analysis', 'analyze the case', 'the company', 'recommendation', 'recommend', 'stakeholder', 'swot', 'dilemma', 'protagonist'],
    presentation: ['presentation', 'present your', 'slides', 'slide deck', 'oral', 'deliver a talk', 'pitch', 'powerpoint', 'minutes to present', 'q&a'],
    lab: ['lab report', 'laboratory', 'experiment', 'hypothesis', 'procedure', 'apparatus', 'measurements', 'data collection', 'control group', 'uncertainty'],
    reflective: ['reflect', 'reflection', 'your experience', 'what did you learn', 'what have you learned', 'personal growth', 'journal', 'looking back', 'reflective essay'],
    research: ['research paper', 'research question', 'literature review', 'hypothesis', 'methodology', 'findings', 'scholarly sources', 'peer-reviewed', 'cite at least', 'abstract', 'references section', 'empirical'],
    essay: ['essay', 'argue', 'argument', 'discuss', 'take a position', 'defend', 'critique', 'in your opinion']
  };

  /* Returns { type, scores } — type ∈ case|presentation|lab|reflective|research|essay|generic */
  function suggestAssignmentType(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    var scores = {};
    Object.keys(TYPE_KEYWORDS).forEach(function (type) {
      var n = 0;
      TYPE_KEYWORDS[type].forEach(function (kw) {
        var idx = t.indexOf(kw);
        while (idx !== -1) { n++; idx = t.indexOf(kw, idx + kw.length); }
      });
      scores[type] = n;
    });
    var best = 'generic', bestN = 0;
    // Priority order breaks ties toward the more specific genres.
    ['case', 'presentation', 'lab', 'reflective', 'research', 'essay'].forEach(function (type) {
      if (scores[type] > bestN) { bestN = scores[type]; best = type; }
    });
    return { type: bestN > 0 ? best : 'generic', scores: scores };
  }

  /* --------------------------- rubric model --------------------------- */

  function uid() {
    return 'c' + Math.random().toString(36).slice(2, 9);
  }

  /* Build a rubric from a standard/template. For AAC&U VALUE-aligned, the
   * assignment type picks the relevant subset of outcome dimensions. */
  function buildTemplateRubric(standardId, assignmentType) {
    var std = Standards.getStandard(standardId);
    if (!std) { return null; }
    var criteria = std.criteria;
    if (std.id === 'aacu-value') {
      var subset = Standards.VALUE_SUBSETS[assignmentType] || Standards.VALUE_SUBSETS.generic;
      criteria = std.criteria.filter(function (cr) { return subset.indexOf(cr.name) !== -1; });
    }
    if (std.id === 'aacsb-aol') {
      // Drop oral/visual communication for non-presentation written work.
      if (assignmentType !== 'presentation') {
        criteria = std.criteria.filter(function (cr) { return cr.name !== 'Oral & Visual Communication'; });
      }
    }
    var n = criteria.length;
    var weight = Math.floor(100 / n);
    var rubricCriteria = criteria.map(function (cr, i) {
      return {
        id: uid(),
        name: cr.name,
        description: cr.description,
        weight: i === n - 1 ? 100 - weight * (n - 1) : weight, // weights sum to exactly 100
        descriptors: {
          exemplary: cr.descriptors.exemplary,
          proficient: cr.descriptors.proficient,
          developing: cr.descriptors.developing,
          beginning: cr.descriptors.beginning
        }
      };
    });
    return {
      name: std.shortName + ' rubric',
      standardId: std.id,
      standardName: std.name,
      attribution: std.attribution,
      sourceUrl: std.sourceUrl,
      lastChecked: std.lastChecked,
      levels: LEVELS.map(function (l) { return { key: l.key, name: l.name, score: l.score }; }),
      criteria: rubricCriteria,
      generatedBy: 'template'
    };
  }

  function emptyCriterion(name) {
    return {
      id: uid(),
      name: name || 'New criterion',
      description: '',
      weight: 0,
      descriptors: { exemplary: '', proficient: '', developing: '', beginning: '' }
    };
  }

  function buildCustomRubric() {
    return {
      name: 'Custom rubric',
      standardId: 'custom',
      standardName: 'Custom (built from scratch)',
      attribution: 'Created by the user in GradeAlign.',
      sourceUrl: '',
      lastChecked: Standards.LAST_CHECKED,
      levels: LEVELS.map(function (l) { return { key: l.key, name: l.name, score: l.score }; }),
      criteria: [emptyCriterion('Criterion 1')],
      generatedBy: 'custom'
    };
  }

  /* ------------------------- AI JSON tolerance ------------------------- */

  /* Extract a JSON object/array from model output that may be wrapped in
   * prose or markdown fences. Returns null on failure. */
  function extractJson(text) {
    if (!text) { return null; }
    var s = String(text).trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(s); } catch (e) { /* fall through */ }
    var first = s.search(/[{[]/);
    if (first === -1) { return null; }
    var open = s[first], close = open === '{' ? '}' : ']';
    var depth = 0, inStr = false, esc = false;
    for (var i = first; i < s.length; i++) {
      var ch = s[i];
      if (inStr) {
        if (esc) { esc = false; }
        else if (ch === '\\') { esc = true; }
        else if (ch === '"') { inStr = false; }
      } else if (ch === '"') { inStr = true; }
      else if (ch === open) { depth++; }
      else if (ch === close) { depth--; if (depth === 0) { return safeParse(s.slice(first, i + 1)); } }
    }
    return null;
  }

  function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  function clampScore(v) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) { return null; }
    return Math.min(4, Math.max(1, n));
  }

  /* Parse AI rubric-generation output into a rubric, falling back to the
   * provided template rubric for anything missing/unparseable. */
  function parseAiRubricJson(text, fallbackRubric) {
    var j = extractJson(text);
    if (!j) { return null; }
    var arr = Array.isArray(j) ? j : (j.criteria || j.rubric || null);
    if (!Array.isArray(arr) || !arr.length) { return null; }
    var criteria = [];
    arr.slice(0, 8).forEach(function (item, i) {
      if (!item) { return; }
      var name = String(item.name || item.criterion || ('Criterion ' + (i + 1))).slice(0, 120);
      var d = item.descriptors || item.levels || {};
      function pick() {
        for (var a = 0; a < arguments.length; a++) {
          var v = arguments[a];
          if (typeof v === 'string' && v.trim()) { return v.trim(); }
        }
        return '';
      }
      criteria.push({
        id: uid(),
        name: name,
        description: String(item.description || ''),
        weight: null, // assigned below
        descriptors: {
          exemplary: pick(d.exemplary, d['Exemplary'], d['4'], d.level4, item.exemplary),
          proficient: pick(d.proficient, d['Proficient'], d['3'], d.level3, item.proficient),
          developing: pick(d.developing, d['Developing'], d['2'], d.level2, item.developing),
          beginning: pick(d.beginning, d['Beginning'], d['1'], d.level1, item.beginning)
        }
      });
    });
    if (criteria.length < 2) { return null; }
    // Fill any missing descriptor from the same-named template criterion.
    if (fallbackRubric) {
      criteria.forEach(function (cr) {
        var fb = null;
        fallbackRubric.criteria.forEach(function (fc) {
          if (fc.name.toLowerCase() === cr.name.toLowerCase()) { fb = fc; }
        });
        LEVELS.forEach(function (l) {
          if (!cr.descriptors[l.key]) {
            cr.descriptors[l.key] = fb ? fb.descriptors[l.key]
              : (fallbackRubric.criteria[0] ? fallbackRubric.criteria[0].descriptors[l.key] : '');
          }
        });
      });
    }
    var n = criteria.length;
    var weight = Math.floor(100 / n);
    criteria.forEach(function (cr, i) { cr.weight = i === n - 1 ? 100 - weight * (n - 1) : weight; });
    var base = fallbackRubric || buildCustomRubric();
    return {
      name: (j.name && typeof j.name === 'string') ? j.name.slice(0, 120) : base.name + ' (AI-tailored)',
      standardId: base.standardId,
      standardName: base.standardName,
      attribution: base.attribution,
      sourceUrl: base.sourceUrl,
      lastChecked: base.lastChecked,
      levels: LEVELS.map(function (l) { return { key: l.key, name: l.name, score: l.score }; }),
      criteria: criteria,
      generatedBy: 'ai'
    };
  }

  /* Parse AI per-paper scoring output → {criterionId: {score, justification}} */
  function parseAiScoresJson(text, rubric) {
    var j = extractJson(text);
    if (!j) { return null; }
    var arr = Array.isArray(j) ? j : (j.scores || j.criteria || null);
    if (!Array.isArray(arr) || !arr.length) { return null; }
    var byName = {};
    rubric.criteria.forEach(function (cr) { byName[cr.name.toLowerCase()] = cr.id; });
    var out = {};
    arr.forEach(function (item) {
      if (!item) { return; }
      var id = null;
      if (item.criterionId && rubric.criteria.some(function (cr) { return cr.id === item.criterionId; })) {
        id = item.criterionId;
      } else {
        var nm = String(item.criterion || item.name || '').toLowerCase().trim();
        if (byName[nm]) { id = byName[nm]; }
        else {
          // fuzzy: unique criterion whose name is contained in the label (or vice versa)
          var matches = rubric.criteria.filter(function (cr) {
            var cn = cr.name.toLowerCase();
            return nm && (cn.indexOf(nm) !== -1 || nm.indexOf(cn) !== -1);
          });
          if (matches.length === 1) { id = matches[0].id; }
        }
      }
      if (!id) { return; }
      var score = clampScore(item.score != null ? item.score : item.level);
      if (score == null) { return; }
      out[id] = { score: score, justification: String(item.justification || item.reason || '').slice(0, 1200) };
    });
    return Object.keys(out).length ? out : null;
  }

  /* ---------------------------- validation ---------------------------- */

  function validateRubric(rubric) {
    var errors = [];
    if (!rubric) { return { ok: false, errors: ['No rubric.'] }; }
    if (!rubric.criteria || !rubric.criteria.length) { errors.push('Rubric has no criteria.'); }
    else {
      if (rubric.criteria.length > 8) { errors.push('Rubric has more than 8 criteria.'); }
      rubric.criteria.forEach(function (cr, i) {
        if (!cr.name || !cr.name.trim()) { errors.push('Criterion ' + (i + 1) + ' has no name.'); }
        LEVELS.forEach(function (l) {
          if (!cr.descriptors || !String(cr.descriptors[l.key] || '').trim()) {
            errors.push('Criterion "' + (cr.name || i + 1) + '" is missing its ' + l.name + ' descriptor.');
          }
        });
      });
      var w = rubric.criteria.reduce(function (s, cr) { return s + (Number(cr.weight) || 0); }, 0);
      if (Math.abs(w - 100) > 0.5) { errors.push('Criterion weights must sum to 100 (currently ' + Math.round(w * 10) / 10 + ').'); }
      rubric.criteria.forEach(function (cr) {
        if (!(Number(cr.weight) > 0)) { errors.push('Criterion "' + (cr.name || '?') + '" needs a weight above 0.'); }
      });
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /* ----------------------------- scoring math ----------------------------- */

  /* Points earned for one criterion: weight% of maxPoints × (level/4). */
  function criterionPoints(criterion, level, maxPoints) {
    var lv = clampScore(level);
    if (lv == null) { return null; }
    return (Number(criterion.weight) / 100) * maxPoints * (lv / 4);
  }

  /* Total rubric score out of maxPoints from {criterionId: {score}} map.
   * Returns null if any criterion is unscored. */
  function rubricTotal(rubric, scoresMap, maxPoints) {
    var total = 0;
    for (var i = 0; i < rubric.criteria.length; i++) {
      var cr = rubric.criteria[i];
      var entry = scoresMap && scoresMap[cr.id];
      if (!entry) { return null; }
      var p = criterionPoints(cr, entry.score != null ? entry.score : entry, maxPoints);
      if (p == null) { return null; }
      total += p;
    }
    return total;
  }

  function rubricMaxPoints(rubric, maxPoints) {
    return rubric.criteria.reduce(function (s, cr) { return s + (Number(cr.weight) / 100) * maxPoints; }, 0);
  }

  /* ------------------------------ text export ------------------------------ */

  function rubricToPlainText(rubric) {
    var lines = [];
    lines.push(rubric.name.toUpperCase());
    lines.push('Standard: ' + rubric.standardName);
    if (rubric.attribution) { lines.push(rubric.attribution); }
    if (rubric.sourceUrl) { lines.push('Source: ' + rubric.sourceUrl + ' (checked ' + rubric.lastChecked + ')'); }
    lines.push('');
    rubric.criteria.forEach(function (cr, i) {
      lines.push((i + 1) + '. ' + cr.name + ' (weight ' + cr.weight + '%)');
      if (cr.description) { lines.push('   ' + cr.description); }
      LEVELS.forEach(function (l) {
        lines.push('   - ' + l.name + ' (' + l.score + '): ' + cr.descriptors[l.key]);
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ------------------------------- docx export ------------------------------- */

  function buildRubricDocx(rubric, meta) {
    return loadDocx().then(function (dx) {
      var children = [];
      children.push(new dx.Paragraph({ text: rubric.name, heading: dx.HeadingLevel.HEADING_1 }));
      children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: 'Standard: ' + rubric.standardName, italics: true })] }));
      if (meta && meta.assignmentType) {
        children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: 'Assignment type: ' + meta.assignmentType, italics: true })] }));
      }
      children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: rubric.attribution || '', size: 18, color: '6b6357' })] }));
      if (rubric.sourceUrl) {
        children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: 'Source: ' + rubric.sourceUrl + ' (checked ' + rubric.lastChecked + ')', size: 18, color: '6b6357' })] }));
      }
      children.push(new dx.Paragraph({ text: '' }));

      var headerCells = [new dx.TableCell({ children: [new dx.Paragraph({ children: [new dx.TextRun({ text: 'Criterion', bold: true })] })] })];
      rubric.levels.forEach(function (l) {
        headerCells.push(new dx.TableCell({ children: [new dx.Paragraph({ children: [new dx.TextRun({ text: l.name + ' (' + l.score + ')', bold: true })] })] }));
      });
      var rows = [new dx.TableRow({ children: headerCells, tableHeader: true })];
      rubric.criteria.forEach(function (cr) {
        var cells = [new dx.TableCell({
          children: [
            new dx.Paragraph({ children: [new dx.TextRun({ text: cr.name + ' (' + cr.weight + '%)', bold: true })] }),
            new dx.Paragraph({ children: [new dx.TextRun({ text: cr.description || '', size: 18 })] })
          ]
        })];
        rubric.levels.forEach(function (l) {
          cells.push(new dx.TableCell({ children: [new dx.Paragraph({ children: [new dx.TextRun({ text: cr.descriptors[l.key] || '', size: 18 })] })] }));
        });
        rows.push(new dx.TableRow({ children: cells }));
      });
      var colW = [2200, 1800, 1800, 1800, 1800];
      children.push(new dx.Table({ rows: rows, width: { size: 100, type: dx.WidthType.PERCENTAGE }, columnWidths: colW }));

      var doc = new dx.Document({
        creator: 'GradeAlign',
        title: rubric.name,
        sections: [{ properties: { page: { size: { orientation: dx.PageOrientation.LANDSCAPE } } }, children: children }]
      });
      return dx.Packer.toBlob(doc);
    });
  }

  global.GradeAlignRubric = {
    LEVELS: LEVELS,
    loadDocx: loadDocx,
    suggestAssignmentType: suggestAssignmentType,
    buildTemplateRubric: buildTemplateRubric,
    buildCustomRubric: buildCustomRubric,
    emptyCriterion: emptyCriterion,
    extractJson: extractJson,
    parseAiRubricJson: parseAiRubricJson,
    parseAiScoresJson: parseAiScoresJson,
    clampScore: clampScore,
    validateRubric: validateRubric,
    criterionPoints: criterionPoints,
    rubricTotal: rubricTotal,
    rubricMaxPoints: rubricMaxPoints,
    rubricToPlainText: rubricToPlainText,
    buildRubricDocx: buildRubricDocx,
    uid: uid
  };
})(typeof window !== 'undefined' ? window : globalThis);
