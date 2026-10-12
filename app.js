/* GradeAlign — app.js
 * UI wiring: tabs, assignment intake, rubric editor, batch upload, grades,
 * AI/manual scoring, deviation dashboard, exports, persistence.
 * Modules: GradeAlignStandards, GradeAlignRubric, GradeAlignAnalysis,
 *          GradeAlignScoring, GradeAlignAI.
 */
(function () {
  'use strict';

  var Standards = window.GradeAlignStandards;
  var Rubric = window.GradeAlignRubric;
  var Analysis = window.GradeAlignAnalysis;
  var Scoring = window.GradeAlignScoring;
  var AI = window.GradeAlignAI;

  var LS_PROJECT = 'gradealign.project.v1';
  var MAX_PAPERS = 20;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text != null) { e.textContent = text; }
    return e;
  }
  function setStatus(id, msg, kind) {
    var e = $(id);
    if (!e) { return; }
    e.textContent = msg || '';
    e.className = 'status-line' + (kind ? ' ' + kind : '');
  }
  function downloadBlob(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function slug(s) {
    return String(s || 'gradealign').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'gradealign';
  }

  /* ============================== state ============================== */

  var project = null;
  var stopRequested = false;
  var scoringRunning = false;
  var manualPaperId = null;

  function defaultProject() {
    return {
      version: 1,
      assignmentText: '',
      assignmentFileName: '',
      assignmentType: 'generic',
      typeSuggestion: null,
      standardId: 'aacsb-aol',
      rubric: null,
      settings: { maxPoints: 100, thresholdPct: 10, anonymize: true },
      papers: []
    };
  }

  function loadProject() {
    try {
      var raw = localStorage.getItem(LS_PROJECT);
      if (!raw) { return defaultProject(); }
      var p = JSON.parse(raw);
      var d = defaultProject();
      Object.keys(d).forEach(function (k) { if (p[k] === undefined) { p[k] = d[k]; } });
      p.settings = Object.assign({}, d.settings, p.settings || {});
      return p;
    } catch (e) { return defaultProject(); }
  }

  var saveTimer = null;
  function saveProject() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(LS_PROJECT, JSON.stringify(project)); }
      catch (e) { /* quota — extraction text can be large; warn once */
        setStatus('papers-status', 'Warning: localStorage is full — export your project to .json to avoid losing work.', 'error');
      }
    }, 250);
  }

  function paperLabel(paper, idx) {
    return project.settings.anonymize ? 'Paper ' + (idx + 1) : (paper.name || 'Paper ' + (idx + 1));
  }

  /* ============================== tabs ============================== */

  function activateTab(name) {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    if (history.replaceState) { history.replaceState(null, '', '#' + name); }
    if (name === 'report') { renderReport(); }
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { activateTab(b.dataset.tab); });
    });
    var hash = (location.hash || '').replace('#', '');
    if (['rubric', 'score', 'report'].indexOf(hash) !== -1) { activateTab(hash); }
  }

  /* ====================== TAB 1: assignment & rubric ====================== */

  function initStandardSelect() {
    var sel = $('standard-select');
    Standards.listStandards().forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = (s.kind === 'template' ? 'Template: ' : '') + s.name;
      sel.appendChild(o);
    });
    var custom = document.createElement('option');
    custom.value = 'custom';
    custom.textContent = 'Custom — build from scratch';
    sel.appendChild(custom);
    sel.value = project.standardId || 'aacsb-aol';
    updateStandardInfo();
    sel.addEventListener('change', function () {
      project.standardId = sel.value;
      updateStandardInfo();
      saveProject();
    });
  }

  function updateStandardInfo() {
    var info = $('standard-info');
    var id = $('standard-select').value;
    if (id === 'custom') {
      info.textContent = 'Start with an empty criterion and write everything yourself.';
      return;
    }
    var s = Standards.getStandard(id);
    if (!s) { info.textContent = ''; return; }
    info.textContent = s.description + ' — ' + s.attribution +
      (s.sourceUrl ? ' Source: ' + s.sourceUrl + ' (checked ' + s.lastChecked + ').' : '');
  }

  function refreshTypeSuggestion() {
    var text = project.assignmentText.trim();
    var hint = $('type-suggestion');
    if (text.length < 40) { hint.textContent = ''; project.typeSuggestion = null; return; }
    var sug = Rubric.suggestAssignmentType(text);
    project.typeSuggestion = sug.type;
    var names = { research: 'research paper', case: 'case analysis', presentation: 'presentation', lab: 'lab / technical report', reflective: 'reflective essay', essay: 'essay / position paper', generic: 'generic assignment' };
    hint.textContent = 'Suggested assignment type: ' + names[sug.type] + ' (heuristic from the text).';
    if (sug.type !== 'generic' && project.assignmentType === 'generic') {
      $('type-select').value = sug.type;
      project.assignmentType = sug.type;
      saveProject();
    }
  }

  function initAssignmentInput() {
    var ta = $('assignment-text');
    ta.value = project.assignmentText || '';
    ta.addEventListener('input', function () {
      project.assignmentText = ta.value;
      refreshTypeSuggestion();
      saveProject();
    });
    $('type-select').value = project.assignmentType || 'generic';
    $('type-select').addEventListener('change', function () {
      project.assignmentType = $('type-select').value;
      saveProject();
    });
    $('assignment-file').addEventListener('change', function (ev) {
      var f = ev.target.files[0];
      ev.target.value = '';
      if (!f) { return; }
      setStatus('assignment-status', 'Extracting text from ' + f.name + '…');
      Scoring.extractTextFromFile(f).then(function (text) {
        if (!text.trim()) { throw new Error('No text could be extracted from that file (scanned image PDFs are not supported).'); }
        project.assignmentText = text;
        project.assignmentFileName = f.name;
        ta.value = text;
        refreshTypeSuggestion();
        saveProject();
        setStatus('assignment-status', 'Extracted ' + Scoring.wordCount(text) + ' words from ' + f.name + '.', 'ok');
      }).catch(function (err) {
        setStatus('assignment-status', err.message, 'error');
      });
    });
    refreshTypeSuggestion();
  }

  /* Recompute stored rubric totals after rubric structure/weight changes. */
  function recomputeTotals() {
    if (!project.rubric) { return; }
    project.papers.forEach(function (p) {
      if (p.scoring && p.scoring.scores) {
        p.scoring.total = Rubric.rubricTotal(project.rubric, p.scoring.scores, project.settings.maxPoints);
        if (p.scoring.total == null && p.scoring.status === 'done') { p.scoring.status = 'idle'; }
      }
    });
  }

  function setRubric(rubric, msg, kind) {
    project.rubric = rubric;
    recomputeTotals();
    saveProject();
    renderRubricEditor();
    if (msg) { setStatus('gen-status', msg, kind); }
  }

  function initGeneration() {
    $('gen-template').addEventListener('click', function () {
      var stdId = $('standard-select').value;
      if (stdId === 'custom') { setRubric(Rubric.buildCustomRubric(), 'Blank custom rubric created — fill in your criteria below.', 'ok'); return; }
      var r = Rubric.buildTemplateRubric(stdId, $('type-select').value);
      if (!r) { setStatus('gen-status', 'Unknown standard selected.', 'error'); return; }
      setRubric(r, 'Template rubric generated: ' + r.criteria.length + ' criteria. Edit anything below.', 'ok');
    });

    $('gen-custom').addEventListener('click', function () {
      setRubric(Rubric.buildCustomRubric(), 'Blank custom rubric created.', 'ok');
    });

    $('gen-ai').addEventListener('click', function () {
      var text = project.assignmentText.trim();
      if (text.length < 40) { setStatus('gen-status', 'Paste or upload the assignment prompt first — AI tailors the rubric to it.', 'error'); return; }
      if (!AI.isConfigured()) { setStatus('gen-status', 'No AI endpoint configured — open "AI & Data" (top right) or use the template generator.', 'error'); return; }
      var stdId = $('standard-select').value;
      var std = stdId === 'custom' ? null : Standards.getStandard(stdId);
      var fallback = stdId === 'custom' ? Rubric.buildCustomRubric() : Rubric.buildTemplateRubric(stdId, $('type-select').value);
      var btn = $('gen-ai');
      btn.disabled = true;
      setStatus('gen-status', 'Asking the model to draft a tailored rubric…');
      AI.generateRubric(text, std || { name: 'Custom rubric', description: 'User-designed criteria for this assignment.' }, $('type-select').value, fallback)
        .then(function (rubric) {
          setRubric(rubric, 'AI-tailored rubric generated (' + rubric.criteria.length + ' criteria). Review and edit before scoring.', 'ok');
        })
        .catch(function (err) { setStatus('gen-status', err.message, 'error'); })
        .finally(function () { btn.disabled = false; });
    });
  }

  /* ------------------------- rubric editor ------------------------- */

  function renderRubricEditor() {
    var rubric = project.rubric;
    var editor = $('rubric-editor'), empty = $('rubric-empty');
    if (!rubric) { editor.classList.add('hidden'); empty.classList.remove('hidden'); $('rubric-meta').textContent = ''; return; }
    editor.classList.remove('hidden');
    empty.classList.add('hidden');
    $('rubric-meta').textContent = ' — ' + rubric.standardName + (rubric.generatedBy === 'ai' ? ' · AI-tailored' : rubric.generatedBy === 'template' ? ' · template' : ' · custom');
    $('rubric-name').value = rubric.name;

    // level headers
    var headRow = $('rubric-grid').querySelector('thead tr');
    headRow.querySelectorAll('th:not(.crit-col)').forEach(function (th) { th.remove(); });
    rubric.levels.forEach(function (l) {
      headRow.appendChild(el('th', null, l.name + ' (' + l.score + ')'));
    });

    var tbody = $('rubric-tbody');
    tbody.innerHTML = '';
    rubric.criteria.forEach(function (cr) {
      var tr = document.createElement('tr');
      tr.dataset.cid = cr.id;

      var tdCrit = el('td', 'crit-col');
      var nameIn = el('input');
      nameIn.type = 'text'; nameIn.className = 'crit-name'; nameIn.value = cr.name;
      nameIn.addEventListener('input', function () { cr.name = nameIn.value; saveProject(); });
      tdCrit.appendChild(nameIn);

      var wWrap = el('div', 'hint');
      wWrap.style.margin = '0 0 0.3rem';
      wWrap.appendChild(document.createTextNode('Weight % '));
      var wIn = el('input');
      wIn.type = 'number'; wIn.className = 'crit-weight'; wIn.min = '1'; wIn.max = '100'; wIn.step = '1'; wIn.value = cr.weight;
      wIn.addEventListener('input', function () { cr.weight = Number(wIn.value) || 0; recomputeTotals(); saveProject(); validateLive(); });
      wWrap.appendChild(wIn);
      var rm = el('button', 'link-remove', 'remove');
      rm.type = 'button';
      rm.style.marginLeft = '0.6rem';
      rm.addEventListener('click', function () {
        project.rubric.criteria = project.rubric.criteria.filter(function (x) { return x.id !== cr.id; });
        saveProject(); renderRubricEditor();
      });
      wWrap.appendChild(rm);
      tdCrit.appendChild(wWrap);

      var desc = el('textarea', 'crit-desc');
      desc.rows = 2; desc.placeholder = 'What this criterion assesses (optional)';
      desc.value = cr.description || '';
      desc.addEventListener('input', function () { cr.description = desc.value; saveProject(); });
      tdCrit.appendChild(desc);
      tr.appendChild(tdCrit);

      rubric.levels.forEach(function (l) {
        var td = el('td');
        var ta = el('textarea');
        ta.value = cr.descriptors[l.key] || '';
        ta.placeholder = l.name + ' descriptor…';
        ta.addEventListener('input', function () { cr.descriptors[l.key] = ta.value; saveProject(); validateLive(); });
        td.appendChild(ta);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    validateLive();
  }

  function validateLive() {
    var v = Rubric.validateRubric(project.rubric);
    var s = $('rubric-status');
    if (v.ok) {
      s.textContent = 'Rubric is complete: ' + project.rubric.criteria.length + ' criteria, weights sum to 100%.';
      s.className = 'status-line ok';
    } else {
      s.textContent = v.errors.slice(0, 3).join(' ') + (v.errors.length > 3 ? ' (+' + (v.errors.length - 3) + ' more)' : '');
      s.className = 'status-line error';
    }
    return v.ok;
  }

  function initRubricEditor() {
    $('rubric-name').addEventListener('input', function () {
      if (project.rubric) { project.rubric.name = $('rubric-name').value; saveProject(); }
    });
    $('add-criterion').addEventListener('click', function () {
      if (!project.rubric) { return; }
      if (project.rubric.criteria.length >= 8) { setStatus('rubric-status', 'Rubrics are capped at 8 criteria.', 'error'); return; }
      var cr = Rubric.emptyCriterion('Criterion ' + (project.rubric.criteria.length + 1));
      cr.weight = 0;
      project.rubric.criteria.push(cr);
      saveProject(); renderRubricEditor();
    });
    $('export-rubric-json').addEventListener('click', function () {
      if (!project.rubric) { return; }
      downloadBlob(slug(project.rubric.name) + '.json', new Blob([JSON.stringify(project.rubric, null, 2)], { type: 'application/json' }));
    });
    $('import-rubric-json').addEventListener('change', function (ev) {
      var f = ev.target.files[0]; ev.target.value = '';
      if (!f) { return; }
      f.text().then(function (t) {
        var j = JSON.parse(t);
        var v = Rubric.validateRubric(j);
        if (!v.ok) { throw new Error('That file is not a valid GradeAlign rubric: ' + v.errors[0]); }
        if (!j.levels) { j.levels = Rubric.LEVELS.map(function (l) { return { key: l.key, name: l.name, score: l.score }; }); }
        setRubric(j, 'Rubric imported from ' + f.name + '.', 'ok');
      }).catch(function (e) { setStatus('rubric-status', e.message, 'error'); });
    });
    $('export-rubric-docx').addEventListener('click', function () {
      if (!project.rubric || !validateLive()) { setStatus('rubric-status', 'Fix the rubric errors above before exporting.', 'error'); return; }
      var btn = $('export-rubric-docx');
      btn.disabled = true;
      setStatus('rubric-status', 'Generating .docx…');
      Rubric.buildRubricDocx(project.rubric, { assignmentType: $('type-select').value })
        .then(function (blob) {
          downloadBlob(slug(project.rubric.name) + '.docx', blob);
          setStatus('rubric-status', 'Downloaded ' + slug(project.rubric.name) + '.docx', 'ok');
        })
        .catch(function (e) { setStatus('rubric-status', e.message, 'error'); })
        .finally(function () { btn.disabled = false; });
    });
  }

  /* ====================== TAB 2: upload & score ====================== */

  function renderPapers() {
    var tbody = $('papers-tbody');
    tbody.innerHTML = '';
    var has = project.papers.length > 0;
    $('papers-empty').classList.toggle('hidden', has);
    $('papers-wrap').classList.toggle('hidden', !has);
    $('paper-count-label').textContent = has ? '— ' + project.papers.length + ' / ' + MAX_PAPERS : '';

    project.papers.forEach(function (p, idx) {
      var tr = document.createElement('tr');

      var tdLabel = el('td');
      var lab = el('span', 'paper-label', paperLabel(p, idx));
      tdLabel.appendChild(lab);
      if (project.settings.anonymize) {
        tdLabel.appendChild(el('span', 'paper-file', p.name));
      }
      tr.appendChild(tdLabel);

      tr.appendChild(el('td', 'word-count', p.extractStatus === 'ok' ? String(p.wordCount) : '—'));

      var tdExt = el('td');
      if (p.extractStatus === 'ok') { tdExt.appendChild(el('span', 'badge ok', 'extracted')); }
      else if (p.extractStatus === 'extracting') { tdExt.appendChild(el('span', 'badge neutral', 'extracting…')); }
      else { tdExt.appendChild(el('span', 'badge bad', 'failed')); tdExt.title = p.extractError || ''; }
      tr.appendChild(tdExt);

      var tdGrade = el('td');
      var gIn = el('input');
      gIn.type = 'number'; gIn.min = '0'; gIn.max = String(project.settings.maxPoints);
      gIn.step = 'any'; gIn.placeholder = '0–' + project.settings.maxPoints;
      gIn.value = p.professorGrade == null ? '' : String(p.professorGrade);
      gIn.setAttribute('aria-label', 'Your grade for ' + paperLabel(p, idx));
      gIn.addEventListener('input', function () {
        var v = gIn.value.trim();
        p.professorGrade = v === '' ? null : Number(v);
        saveProject();
      });
      tdGrade.appendChild(gIn);
      tr.appendChild(tdGrade);

      var tdScore = el('td');
      tdScore.textContent = p.scoring && p.scoring.total != null ? Analysis.round1(p.scoring.total) + ' / ' + project.settings.maxPoints : '—';
      tr.appendChild(tdScore);

      var tdStatus = el('td');
      var st = p.scoring ? p.scoring.status : 'idle';
      if (st === 'done') {
        tdStatus.appendChild(el('span', 'badge ok', p.scoring.method === 'ai' ? 'AI scored' : 'manually scored'));
      } else if (st === 'scoring') { tdStatus.appendChild(el('span', 'badge warn', 'scoring…')); }
      else if (st === 'queued') { tdStatus.appendChild(el('span', 'badge neutral', 'queued')); }
      else if (st === 'error') { tdStatus.appendChild(el('span', 'badge bad', 'error')); tdStatus.title = p.scoring.error || ''; }
      else { tdStatus.appendChild(el('span', 'badge neutral', 'not scored')); }
      tr.appendChild(tdStatus);

      var tdAct = el('td');
      var scoreBtn = el('button', 'btn small', 'Score manually');
      scoreBtn.type = 'button';
      scoreBtn.disabled = p.extractStatus !== 'ok';
      scoreBtn.addEventListener('click', function () { openManualScore(p.id); });
      tdAct.appendChild(scoreBtn);
      var rmBtn = el('button', 'link-remove', 'remove');
      rmBtn.type = 'button';
      rmBtn.style.marginLeft = '0.5rem';
      rmBtn.addEventListener('click', function () {
        project.papers = project.papers.filter(function (x) { return x.id !== p.id; });
        if (manualPaperId === p.id) { closeManualScore(); }
        saveProject(); renderPapers();
      });
      tdAct.appendChild(rmBtn);
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });
  }

  function initPapers() {
    $('anonymize-toggle').checked = project.settings.anonymize !== false;
    $('anonymize-toggle').addEventListener('change', function () {
      project.settings.anonymize = $('anonymize-toggle').checked;
      saveProject(); renderPapers();
    });

    $('max-points').value = String(project.settings.maxPoints);
    $('max-points').addEventListener('input', function () {
      var v = Number($('max-points').value);
      if (v >= 1) {
        var old = project.settings.maxPoints;
        project.settings.maxPoints = v;
        // rescale stored rubric totals if the scale changed
        if (old && old !== v) {
          project.papers.forEach(function (p) {
            if (p.scoring && p.scoring.scores) {
              p.scoring.total = Rubric.rubricTotal(project.rubric, p.scoring.scores, v);
            }
          });
        }
        saveProject(); renderPapers();
      }
    });

    $('papers-file').addEventListener('change', function (ev) {
      var files = Array.prototype.slice.call(ev.target.files || []);
      ev.target.value = '';
      if (!files.length) { return; }
      var room = MAX_PAPERS - project.papers.length;
      if (files.length > room) {
        setStatus('papers-status', 'Only ' + room + ' slot(s) left (max ' + MAX_PAPERS + ' papers); extra files skipped.', 'error');
        files = files.slice(0, Math.max(0, room));
      }
      files.forEach(function (f) {
        var p = {
          id: Rubric.uid(),
          name: f.name,
          text: '',
          wordCount: 0,
          extractStatus: 'extracting',
          extractError: '',
          professorGrade: null,
          scoring: { status: 'idle', method: null, error: '', scores: null, total: null, justifications: null }
        };
        project.papers.push(p);
        Scoring.extractTextFromFile(f).then(function (text) {
          if (!text.trim()) { throw new Error('No extractable text (scanned image PDFs are not supported).'); }
          p.text = text;
          p.wordCount = Scoring.wordCount(text);
          p.extractStatus = 'ok';
        }).catch(function (err) {
          p.extractStatus = 'error';
          p.extractError = err.message;
        }).finally(function () { saveProject(); renderPapers(); });
      });
      saveProject(); renderPapers();
      setStatus('papers-status', 'Extracting text from ' + files.length + ' file(s)…');
    });

    $('clear-papers').addEventListener('click', function () {
      if (!project.papers.length) { return; }
      if (!window.confirm('Remove all ' + project.papers.length + ' papers, their grades and scores?')) { return; }
      project.papers = [];
      closeManualScore();
      saveProject(); renderPapers();
      setStatus('papers-status', 'All papers removed.');
    });

    $('grades-csv').addEventListener('change', function (ev) {
      var f = ev.target.files[0]; ev.target.value = '';
      if (!f) { return; }
      f.text().then(function (text) {
        var res = Scoring.parseGradesCsv(text);
        var matched = 0, unmatched = [];
        Object.keys(res.grades).forEach(function (key) {
          var p = Scoring.matchPaperKey(key, project.papers);
          if (p) { p.professorGrade = res.grades[key]; matched++; }
          else { unmatched.push(key); }
        });
        saveProject(); renderPapers();
        var msg = 'Imported ' + matched + ' grade(s) from ' + f.name + '.';
        if (unmatched.length) { msg += ' Unmatched rows: ' + unmatched.slice(0, 5).join(', ') + (unmatched.length > 5 ? '…' : ''); }
        if (res.errors.length) { msg += ' ' + res.errors.slice(0, 3).join(' '); }
        setStatus('grades-status', msg, unmatched.length || res.errors.length ? 'error' : 'ok');
      }).catch(function (e) { setStatus('grades-status', e.message, 'error'); });
    });
  }

  /* --------------------------- AI batch scoring --------------------------- */

  function initAiScoring() {
    $('score-ai').addEventListener('click', function () {
      if (scoringRunning) { return; }
      var v = Rubric.validateRubric(project.rubric);
      if (!project.rubric || !v.ok) {
        setStatus('score-status', 'Build a complete rubric first (Assignment & Rubric tab).', 'error'); return;
      }
      if (!AI.isConfigured()) {
        setStatus('score-status', 'No AI endpoint configured — open "AI & Data" (top right), or score manually per paper.', 'error'); return;
      }
      var targets = project.papers.filter(function (p) { return p.extractStatus === 'ok'; });
      if (!targets.length) { setStatus('score-status', 'No extracted papers to score.', 'error'); return; }

      scoringRunning = true;
      stopRequested = false;
      $('score-ai').disabled = true;
      $('score-stop').classList.remove('hidden');
      $('score-progress-wrap').classList.remove('hidden');
      $('score-progress-fill').style.width = '0%';
      $('score-progress-label').textContent = '0 / ' + targets.length;
      targets.forEach(function (p) { p.scoring.status = 'queued'; });
      renderPapers();
      setStatus('score-status', 'Scoring ' + targets.length + ' papers (3 at a time)…');

      Scoring.runBatch(targets, function (p) {
        return AI.scorePaper(project.rubric, p.text, project.settings.maxPoints).then(function (scores) {
          p.scoring.scores = scores;
          p.scoring.total = Rubric.rubricTotal(project.rubric, scores, project.settings.maxPoints);
          p.scoring.method = 'ai';
          p.scoring.error = '';
          return scores;
        });
      }, {
        concurrency: 3,
        retries: 2,
        shouldStop: function () { return stopRequested; },
        onItemStart: function (p) { p.scoring.status = 'scoring'; renderPapers(); },
        onItemDone: function (p) { p.scoring.status = 'done'; saveProject(); renderPapers(); },
        onItemError: function (p, err, willRetry) {
          p.scoring.status = willRetry ? 'queued' : 'error';
          p.scoring.error = err.message;
          renderPapers();
        },
        onProgress: function (done, total) {
          $('score-progress-fill').style.width = Math.round((done / total) * 100) + '%';
          $('score-progress-label').textContent = done + ' / ' + total;
        }
      }).then(function (out) {
        scoringRunning = false;
        $('score-ai').disabled = false;
        $('score-stop').classList.add('hidden');
        var okCount = out.results.size, errCount = out.errors.size;
        setStatus('score-status',
          (stopRequested ? 'Stopped. ' : 'Done. ') + okCount + ' scored' + (errCount ? ', ' + errCount + ' failed (see table; click Score manually or re-run)' : '') + '.',
          errCount ? 'error' : 'ok');
        saveProject(); renderPapers();
      });
    });

    $('score-stop').addEventListener('click', function () { stopRequested = true; });
  }

  /* --------------------------- manual scoring --------------------------- */

  function openManualScore(paperId) {
    var p = project.papers.find(function (x) { return x.id === paperId; });
    if (!p || !project.rubric) { return; }
    manualPaperId = paperId;
    var idx = project.papers.indexOf(p);
    $('manual-score-title').textContent = 'Manual scoring — ' + paperLabel(p, idx);
    var body = $('manual-score-body');
    body.innerHTML = '';

    project.rubric.criteria.forEach(function (cr) {
      var row = el('div', 'score-row');
      var head = el('div', 'score-head');
      head.appendChild(el('span', 'score-title', cr.name));
      var sel = el('select');
      sel.setAttribute('aria-label', 'Score for ' + cr.name);
      var blank = document.createElement('option');
      blank.value = ''; blank.textContent = '— not scored —';
      sel.appendChild(blank);
      project.rubric.levels.forEach(function (l) {
        var o = document.createElement('option');
        o.value = String(l.score);
        o.textContent = l.name + ' (' + l.score + ')';
        sel.appendChild(o);
      });
      var existing = p.scoring.scores && p.scoring.scores[cr.id];
      if (existing) { sel.value = String(existing.score); }
      sel.dataset.cid = cr.id;
      head.appendChild(sel);
      row.appendChild(head);
      row.appendChild(el('p', 'score-meta', cr.description || ''));
      var hint = el('p', 'descriptor-hint', '');
      function updateHint() {
        var v = Number(sel.value);
        var l = project.rubric.levels.find(function (x) { return x.score === v; });
        hint.textContent = l ? l.name + ': ' + cr.descriptors[l.key] : '';
        updateManualTotal();
      }
      sel.addEventListener('change', updateHint);
      row.appendChild(hint);
      updateHint();
      body.appendChild(row);
    });

    // existing AI justifications, if any
    if (p.scoring.method === 'ai' && p.scoring.scores) {
      var note = el('p', 'hint', 'This paper was AI-scored; adjust any criterion to make it manual.');
      body.appendChild(note);
    }

    updateManualTotal();
    $('manual-score').classList.remove('hidden');
    $('manual-score').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function collectManualScores() {
    var scores = {};
    var complete = true;
    $('manual-score-body').querySelectorAll('select[data-cid]').forEach(function (sel) {
      if (sel.value === '') { complete = false; return; }
      scores[sel.dataset.cid] = { score: Number(sel.value), justification: '' };
    });
    return { scores: scores, complete: complete };
  }

  function updateManualTotal() {
    if (manualPaperId == null || !project.rubric) { return; }
    var c = collectManualScores();
    var t = c.complete ? Rubric.rubricTotal(project.rubric, c.scores, project.settings.maxPoints) : null;
    $('manual-score-total').textContent = t != null
      ? 'Rubric total: ' + Analysis.round1(t) + ' / ' + project.settings.maxPoints
      : 'Score every criterion to compute the total.';
  }

  function closeManualScore() {
    manualPaperId = null;
    $('manual-score').classList.add('hidden');
  }

  function initManualScore() {
    $('manual-score-save').addEventListener('click', function () {
      var p = project.papers.find(function (x) { return x.id === manualPaperId; });
      if (!p) { closeManualScore(); return; }
      var c = collectManualScores();
      if (!c.complete) { setStatus('score-status', 'Score every criterion before saving.', 'error'); return; }
      p.scoring.scores = c.scores;
      p.scoring.total = Rubric.rubricTotal(project.rubric, c.scores, project.settings.maxPoints);
      p.scoring.method = p.scoring.method === 'ai' ? 'ai' : 'manual';
      // if the user edited an AI score, count it as manual-adjusted
      p.scoring.status = 'done';
      p.scoring.error = '';
      saveProject(); renderPapers();
      setStatus('score-status', 'Saved scores for ' + paperLabel(p, project.papers.indexOf(p)) + ' (' + Analysis.round1(p.scoring.total) + ' / ' + project.settings.maxPoints + ').', 'ok');
      closeManualScore();
    });
    $('manual-score-close').addEventListener('click', closeManualScore);
  }

  /* ====================== TAB 3: deviation report ====================== */

  function analysisRows() {
    return project.papers.map(function (p, idx) {
      return {
        id: p.id,
        label: paperLabel(p, idx),
        professorGrade: p.professorGrade,
        rubricScore: p.scoring && p.scoring.total != null ? p.scoring.total : null,
        scores: (p.scoring && p.scoring.scores) || {}
      };
    });
  }

  function renderReport() {
    var body = $('report-body'), empty = $('report-empty');
    if (!project.rubric) { body.classList.add('hidden'); empty.classList.remove('hidden'); return; }
    var analysis = Analysis.computeAnalysis(analysisRows(), project.rubric, project.settings);
    if (!analysis.n) { body.classList.add('hidden'); empty.classList.remove('hidden'); return; }
    body.classList.remove('hidden');
    empty.classList.add('hidden');

    // stat cards
    var grid = $('stat-grid');
    grid.innerHTML = '';
    var anyAi = project.papers.some(function (p) { return p.scoring && p.scoring.method === 'ai' && p.scoring.status === 'done'; });
    function stat(label, value, cls) {
      var c = el('div', 'stat-card');
      c.appendChild(el('div', 'stat-value' + (cls ? ' ' + cls : ''), value));
      c.appendChild(el('div', 'stat-label', label));
      grid.appendChild(c);
    }
    stat('Papers compared', String(analysis.n));
    stat('Mean deviation', (analysis.meanDeviation >= 0 ? '+' : '') + Analysis.round1(analysis.meanDeviation) + ' pts');
    stat('Mean |deviation|', Analysis.round1(analysis.meanAbsoluteDeviation) + ' pts');
    stat('Std dev of deviations', Analysis.round1(analysis.stdDeviation) + ' pts');
    stat('Pearson r', analysis.pearson == null ? 'n/a' : String(Analysis.round2(analysis.pearson)));
    stat('Flagged > ' + analysis.thresholdPct + '%', analysis.flaggedCount + ' / ' + analysis.n, analysis.flaggedCount ? 'bad' : 'ok');
    stat('Consistency', Analysis.consistencyLabel(analysis).toUpperCase());

    // per-paper table
    var tbody = $('dev-tbody');
    tbody.innerHTML = '';
    analysis.rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.appendChild(el('td', 'paper-label', r.label));
      tr.appendChild(el('td', null, Analysis.round1(r.professorGrade)));
      tr.appendChild(el('td', null, Analysis.round1(r.rubricScore)));
      var tdD = el('td', r.deviation > 0.05 ? 'dev-pos' : r.deviation < -0.05 ? 'dev-neg' : '');
      tdD.textContent = (r.deviation >= 0 ? '+' : '') + Analysis.round1(r.deviation);
      tr.appendChild(tdD);
      tr.appendChild(el('td', null, (r.deviationPct >= 0 ? '+' : '') + Analysis.round1(r.deviationPct) + '%'));
      var tdF = el('td');
      if (r.flagged) { tdF.appendChild(el('span', 'badge bad', 'flagged')); }
      else { tdF.appendChild(el('span', 'badge ok', 'ok')); }
      tr.appendChild(tdF);
      tbody.appendChild(tr);
    });

    // charts
    $('chart-scatter').innerHTML = Analysis.scatterSvg(analysis);
    $('chart-bars').innerHTML = Analysis.criterionBarsSvg(analysis);

    // interpretation
    var ul = $('interpretation');
    ul.innerHTML = '';
    Analysis.interpret(analysis, anyAi ? 'ai' : 'manual').forEach(function (line) {
      ul.appendChild(el('li', null, line));
    });

    // stash for exports
    body.dataset.ready = '1';
  }

  function initReport() {
    $('threshold-pct').value = String(project.settings.thresholdPct);
    $('threshold-pct').addEventListener('input', function () {
      var v = Number($('threshold-pct').value);
      if (v >= 1 && v <= 100) { project.settings.thresholdPct = v; saveProject(); renderReport(); }
    });

    $('export-scores-csv').addEventListener('click', function () {
      if (!project.rubric) { return; }
      var analysis = Analysis.computeAnalysis(analysisRows(), project.rubric, project.settings);
      if (!analysis.n) { setStatus('report-status', 'Nothing to export yet.', 'error'); return; }
      downloadBlob('gradealign-scores.csv', new Blob([Analysis.scoresCsv(analysis, project.rubric)], { type: 'text/csv' }));
      setStatus('report-status', 'Downloaded gradealign-scores.csv', 'ok');
    });

    $('export-report-docx').addEventListener('click', function () {
      if (!project.rubric) { return; }
      var analysis = Analysis.computeAnalysis(analysisRows(), project.rubric, project.settings);
      if (!analysis.n) { setStatus('report-status', 'Nothing to export yet.', 'error'); return; }
      var btn = $('export-report-docx');
      btn.disabled = true;
      setStatus('report-status', 'Generating report .docx…');
      var anyAi = project.papers.some(function (p) { return p.scoring && p.scoring.method === 'ai' && p.scoring.status === 'done'; });
      var scatter = Analysis.scatterSvg(analysis);
      var bars = Analysis.criterionBarsSvg(analysis);
      var pngs = {};
      Promise.all([
        Analysis.svgToPngArrayBuffer(scatter, 520, 400).then(function (b) { pngs.scatter = b; }).catch(function () {}),
        Analysis.svgToPngArrayBuffer(bars, 560, 44 + analysis.criteriaStats.length * 36).then(function (b) {
          pngs.bars = b;
          pngs.barsRatio = (44 + analysis.criteriaStats.length * 36) / 560;
        }).catch(function () {})
      ]).then(function () {
        return Analysis.buildReportDocx(analysis, project.rubric, {
          generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
          scoreSource: anyAi ? 'ai' : 'manual'
        }, pngs);
      }).then(function (blob) {
        downloadBlob('gradealign-consistency-report.docx', blob);
        setStatus('report-status', 'Downloaded gradealign-consistency-report.docx', 'ok');
      }).catch(function (e) { setStatus('report-status', e.message, 'error'); })
        .finally(function () { btn.disabled = false; });
    });
  }

  /* ====================== settings modal & project data ====================== */

  function initSettings() {
    $('open-settings').addEventListener('click', function () {
      var s = AI.getSettings();
      $('ai-endpoint').value = s.endpoint;
      $('ai-model').value = s.model;
      $('ai-key').value = s.key;
      $('settings-modal').classList.remove('hidden');
    });
    $('settings-close').addEventListener('click', function () { $('settings-modal').classList.add('hidden'); });
    $('settings-modal').addEventListener('click', function (ev) {
      if (ev.target === $('settings-modal')) { $('settings-modal').classList.add('hidden'); }
    });
    $('ai-save').addEventListener('click', function () {
      AI.saveSettings({ endpoint: $('ai-endpoint').value, model: $('ai-model').value, key: $('ai-key').value });
      setStatus('ai-status', AI.isConfigured() ? 'Saved — AI features enabled.' : 'Saved (endpoint + key required for AI features).', AI.isConfigured() ? 'ok' : '');
    });
    $('ai-clear').addEventListener('click', function () {
      AI.clearSettings();
      $('ai-endpoint').value = ''; $('ai-model').value = ''; $('ai-key').value = '';
      setStatus('ai-status', 'AI settings cleared from this browser.', 'ok');
    });

    $('project-export').addEventListener('click', function () {
      downloadBlob('gradealign-project.json', new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
      setStatus('project-status', 'Project exported.', 'ok');
    });
    $('project-import').addEventListener('change', function (ev) {
      var f = ev.target.files[0]; ev.target.value = '';
      if (!f) { return; }
      f.text().then(function (t) {
        var j = JSON.parse(t);
        if (!j || typeof j !== 'object' || !Array.isArray(j.papers)) { throw new Error('Not a GradeAlign project file.'); }
        project = j;
        var d = defaultProject();
        Object.keys(d).forEach(function (k) { if (project[k] === undefined) { project[k] = d[k]; } });
        project.settings = Object.assign({}, d.settings, project.settings || {});
        saveProject();
        hydrateAll();
        setStatus('project-status', 'Imported ' + f.name + ' (' + project.papers.length + ' papers).', 'ok');
      }).catch(function (e) { setStatus('project-status', e.message, 'error'); });
    });
    $('project-reset').addEventListener('click', function () {
      if (!window.confirm('Delete the entire project from this browser (assignment, rubric, papers, grades, scores)?')) { return; }
      project = defaultProject();
      closeManualScore();
      saveProject();
      hydrateAll();
      setStatus('project-status', 'Project reset.', 'ok');
    });
  }

  function hydrateAll() {
    $('assignment-text').value = project.assignmentText || '';
    $('standard-select').value = project.standardId || 'aacsb-aol';
    $('type-select').value = project.assignmentType || 'generic';
    updateStandardInfo();
    refreshTypeSuggestion();
    $('anonymize-toggle').checked = project.settings.anonymize !== false;
    $('max-points').value = String(project.settings.maxPoints);
    $('threshold-pct').value = String(project.settings.thresholdPct);
    renderRubricEditor();
    renderPapers();
    renderReport();
  }

  /* ============================== boot ============================== */

  project = loadProject();
  initTabs();
  initStandardSelect();
  initAssignmentInput();
  initGeneration();
  initRubricEditor();
  initPapers();
  initAiScoring();
  initManualScore();
  initReport();
  initSettings();
  hydrateAll();
})();
