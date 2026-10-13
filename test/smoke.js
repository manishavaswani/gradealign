/* GradeAlign — node smoke tests.
 * Run: node test/smoke.js
 * Covers: standards/rubric data integrity, template generation, assignment-type
 * heuristics, Pearson + deviation stats vs hand-computed fixtures, CSV grade
 * parser edge cases, AI JSON tolerance, and the concurrency-limited runner.
 */
'use strict';

const path = require('path');
require(path.join(__dirname, '..', 'js', 'data', 'standards.js'));
require(path.join(__dirname, '..', 'js', 'rubric.js'));
require(path.join(__dirname, '..', 'js', 'analysis.js'));
require(path.join(__dirname, '..', 'js', 'scoring.js'));

const S = globalThis.GradeAlignStandards;
const R = globalThis.GradeAlignRubric;
const A = globalThis.GradeAlignAnalysis;
const C = globalThis.GradeAlignScoring;

let failures = 0;
function ok(cond, label) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label);
  if (!cond) { failures++; }
}
function near(a, b, tol) { return a != null && b != null && Math.abs(a - b) <= (tol || 1e-9); }

/* ---------------- 1. standards data integrity ---------------- */
console.log('\n— standards data integrity —');
ok(Array.isArray(S.STANDARDS) && S.STANDARDS.length === 7, 'exactly 7 standards/templates bundled (2 standards + 5 generic)');
S.STANDARDS.forEach(function (std) {
  ok(std.id && std.name && std.description, std.id + ': id/name/description present');
  ok(std.lastChecked === '2026-10-12', std.id + ': lastChecked 2026-10-12');
  if (std.kind === 'standard') {
    ok(/^https:\/\//.test(std.sourceUrl || ''), std.id + ': sourceUrl present for research-backed standard');
    ok(/aligned to/i.test(std.attribution || ''), std.id + ': attribution uses "aligned to" language');
  }
  ok(std.criteria.length >= 4 && std.criteria.length <= 9, std.id + ': ' + std.criteria.length + ' criteria (4–9)');
  std.criteria.forEach(function (cr) {
    ['exemplary', 'proficient', 'developing', 'beginning'].forEach(function (k) {
      ok(typeof cr.descriptors[k] === 'string' && cr.descriptors[k].trim().length > 20,
        std.id + ' / ' + cr.name + ': ' + k + ' descriptor present and original-length');
    });
  });
});
// VALUE subsets reference real criteria
const valueNames = S.getStandard('aacu-value').criteria.map(function (c) { return c.name; });
Object.keys(S.VALUE_SUBSETS).forEach(function (t) {
  const bad = S.VALUE_SUBSETS[t].filter(function (n) { return valueNames.indexOf(n) === -1; });
  ok(!bad.length, 'VALUE subset "' + t + '" references existing criteria');
});

/* ---------------- 2. template generation ---------------- */
console.log('\n— template rubric generation —');
['aacsb-aol', 'aacu-value', 'research-paper', 'case-analysis', 'presentation', 'lab-report', 'reflective-essay'].forEach(function (id) {
  const r = R.buildTemplateRubric(id, 'research');
  const v = R.validateRubric(r);
  ok(v.ok, id + ' template validates (' + (v.errors[0] || 'ok') + ')');
  const w = r.criteria.reduce(function (s, c) { return s + c.weight; }, 0);
  ok(w === 100, id + ' weights sum to exactly 100');
});
const vPres = R.buildTemplateRubric('aacu-value', 'presentation');
ok(vPres.criteria.some(function (c) { return c.name === 'Oral Communication'; }), 'VALUE presentation subset includes oral communication');
ok(!vPres.criteria.some(function (c) { return c.name === 'Quantitative Literacy'; }), 'VALUE presentation subset excludes quantitative literacy');
const aacsbPres = R.buildTemplateRubric('aacsb-aol', 'presentation');
ok(aacsbPres.criteria.some(function (c) { return c.name === 'Oral & Visual Communication'; }), 'AACSB presentation keeps oral/visual criterion');
const aacsbPaper = R.buildTemplateRubric('aacsb-aol', 'research');
ok(!aacsbPaper.criteria.some(function (c) { return c.name === 'Oral & Visual Communication'; }), 'AACSB research drops oral/visual criterion');

/* ---------------- 3. assignment-type heuristics ---------------- */
console.log('\n— assignment-type heuristics —');
ok(R.suggestAssignmentType('Write a research paper with a literature review, research question, and at least 8 peer-reviewed scholarly sources. Include an abstract and references section.').type === 'research', 'research keywords → research');
ok(R.suggestAssignmentType('Read the case study about the company and its dilemma. Analyze the case and recommend a course of action for the protagonist.').type === 'case', 'case keywords → case');
ok(R.suggestAssignmentType('Prepare a 10-minute presentation with a slide deck. You will present your findings and take Q&A. Slides due Friday.').type === 'presentation', 'presentation keywords → presentation');
ok(R.suggestAssignmentType('Submit a lab report describing the experiment, hypothesis, procedure, measurements, and data collection with uncertainty estimates.').type === 'lab', 'lab keywords → lab');
ok(R.suggestAssignmentType('Write a reflective essay about your experience this semester. Reflect on what did you learn and your personal growth.').type === 'reflective', 'reflective keywords → reflective');
ok(R.suggestAssignmentType('Write an essay. Take a position and argue it; defend your view and critique the opposing argument.').type === 'essay', 'essay keywords → essay');
ok(R.suggestAssignmentType('Page one. Page two.').type === 'generic', 'no keywords → generic');

/* ---------------- 4. statistics vs hand-computed fixtures ---------------- */
console.log('\n— statistics (hand-computed fixtures) —');
const prof = [80, 70, 90, 60, 85];
const rub = [82, 68, 88, 65, 80];
// hand-computed: mean dev = -0.4, mean abs dev = 3.2, pop std dev = sqrt(12.24) ≈ 3.4985711
// Pearson r = 449 / sqrt(580 * 379.2) ≈ 0.9574104862732372
ok(near(A.pearson(prof, rub), 0.9574104862732372, 1e-6), 'pearson fixture ≈ 0.9574104862732372');
ok(A.pearson([5, 5, 5], [1, 2, 3]) === null, 'pearson undefined on zero-variance input');
ok(A.pearson([1], [2]) === null, 'pearson undefined for n<2');

const rubric = R.buildTemplateRubric('research-paper', 'research');
const papers = prof.map(function (g, i) {
  // build criterion score map that yields exactly rub[i] out of 100
  // research-paper template: 6 criteria, weights 16,16,16,16,16,20
  // target rub[i] = sum(weight * level/4) — solved per fixture below via direct map:
  return { id: 'p' + i, label: 'Paper ' + (i + 1), professorGrade: g, rubricScore: rub[i], scores: {} };
});
const an = A.computeAnalysis(papers, rubric, { maxPoints: 100, thresholdPct: 10 });
ok(an.n === 5, 'analysis rows: 5');
ok(near(an.meanDeviation, -0.4, 1e-9), 'mean deviation = -0.4');
ok(near(an.meanAbsoluteDeviation, 3.2, 1e-9), 'mean absolute deviation = 3.2');
ok(near(an.stdDeviation, Math.sqrt(12.24), 1e-9), 'population std dev = sqrt(12.24) ≈ 3.4986');
ok(near(an.pearson, 0.9574104862732372, 1e-6), 'analysis pearson matches fixture');
ok(an.biasDirection === 'lower', 'bias direction: rubric scores lower');
ok(an.flaggedCount === 0, 'nothing flagged at 10% threshold');

const an2 = A.computeAnalysis([{ id: 'x', label: 'Paper 1', professorGrade: 50, rubricScore: 71, scores: {} }], rubric, { maxPoints: 100, thresholdPct: 10 });
ok(an2.rows[0].flagged === true && an2.rows[0].deviationPct === 21, 'deviation +21% flags at threshold 10');
ok(A.consistencyLabel(an) === 'high', 'fixture consistency label = high');

/* rubric scoring math: 6 criteria weights 16,16,16,16,16,20, all level 4 → 100 */
const allFour = {};
rubric.criteria.forEach(function (c) { allFour[c.id] = { score: 4 }; });
ok(near(R.rubricTotal(rubric, allFour, 100), 100, 1e-9), 'all-Exemplary scores 100/100');
const allOne = {};
rubric.criteria.forEach(function (c) { allOne[c.id] = { score: 1 }; });
ok(near(R.rubricTotal(rubric, allOne, 100), 25, 1e-9), 'all-Beginning scores 25/100');
ok(R.rubricTotal(rubric, {}, 100) === null, 'incomplete scores → null total');

/* ---------------- 5. CSV grade parser edge cases ---------------- */
console.log('\n— CSV grade parser —');
let res = C.parseGradesCsv('paper,grade\r\nPaper 1,88\r\nPaper 2,91.5\r\n');
ok(res.hadHeader && res.grades['paper 1'] === 88 && res.grades['paper 2'] === 91.5, 'header + CRLF rows parsed');
res = C.parseGradesCsv('Paper 1,88\nPaper 2,91');
ok(!res.hadHeader && res.grades['paper 1'] === 88, 'headerless CSV parsed');
res = C.parseGradesCsv('paper,grade\n"Smith, J — final draft.pdf",77\n"quote ""heavy"".pdf",82%\n');
ok(res.grades['smith, j — final draft.pdf'] === 77, 'quoted comma field parsed');
ok(res.grades['quote "heavy".pdf'] === 82, 'escaped quotes + % suffix parsed');
res = C.parseGradesCsv('﻿paper,grade\nPaper 1,85');
ok(res.grades['paper 1'] === 85, 'UTF-8 BOM tolerated');
res = C.parseGradesCsv('paper,grade\nPaper 1,\nPaper 2,abc\nPaper 3,');
ok(Object.keys(res.grades).length === 0 && res.errors.length === 3, 'empty/non-numeric grades each reported as errors');
res = C.parseGradesCsv('paper,grade\n,90\nPaper 1,92\n\n');
ok(res.grades['paper 1'] === 92 && res.errors.length === 1, 'blank key reported, trailing blank line ignored');
res = C.parseGradesCsv('');
ok(res.errors.length > 0, 'empty CSV reported');
// matchPaperKey
const fakePapers = [{ name: 'alice.pdf' }, { name: 'bob.docx' }, { name: 'carol.txt' }];
ok(C.matchPaperKey('alice.pdf', fakePapers) === fakePapers[0], 'match by filename');
ok(C.matchPaperKey('Paper 2', fakePapers) === fakePapers[1], 'match by anonymized id');
ok(C.matchPaperKey('3', fakePapers) === fakePapers[2], 'match by 1-based index');
ok(C.matchPaperKey('nobody', fakePapers) === null, 'unknown key → null');

/* ---------------- 6. AI JSON tolerance ---------------- */
console.log('\n— AI response parsing —');
const aiRubricText = 'Here you go:\n```json\n{"name":"Tailored","criteria":[{"name":"Thesis","description":"d","descriptors":{"exemplary":"e4","proficient":"e3","developing":"e2","beginning":"e1"}},{"name":"Evidence","description":"d","descriptors":{"exemplary":"x4","proficient":"x3","developing":"x2","beginning":"x1"}}]}\n```';
const parsed = R.parseAiRubricJson(aiRubricText, R.buildTemplateRubric('research-paper', 'research'));
ok(parsed && parsed.criteria.length === 2 && parsed.generatedBy === 'ai', 'AI rubric JSON parsed from fenced prose');
ok(parsed.criteria[0].weight === 50 && parsed.criteria[1].weight === 50, 'AI rubric weights normalized to 100');
ok(R.parseAiRubricJson('no json here', null) === null, 'garbage AI rubric → null');
const scoresText = '{"scores":[{"criterion":"Thesis & Research Question","score":4,"justification":"Strong."},{"criterion":"Literature & Sources","score":3},{"criterion":"Method / Approach","score":"2"},{"criterion":"Analysis & Argument","score":7}]}';
const scores = R.parseAiScoresJson(scoresText, rubric);
ok(scores && Object.keys(scores).length === 4, 'AI scores parsed (name matching, string number)');
ok(scores[rubric.criteria[3].id].score === 4, 'out-of-range score clamped to 4');

/* ---------------- 7. concurrency-limited runner ---------------- */
console.log('\n— batch runner (concurrency 3, retries) —');
let inFlight = 0, maxInFlight = 0;
const attempts = {};
const items = [1, 2, 3, 4, 5, 6, 7];
C.runBatch(items, function (item) {
  attempts[item] = (attempts[item] || 0) + 1;
  inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      inFlight--;
      if (item === 4 && attempts[item] === 1) { reject(new Error('flaky')); }
      else { resolve(item * 10); }
    }, 5);
  });
}, { concurrency: 3, retries: 2, retryDelayMs: 5 }).then(function (out) {
  ok(maxInFlight <= 3, 'never more than 3 in flight (max observed: ' + maxInFlight + ')');
  ok(out.results.size === 7 && out.errors.size === 0, 'all items resolved, flaky item retried');
  ok(attempts[4] === 2, 'failing item retried exactly once before success');
  const csv = A.scoresCsv(an, rubric);
  ok(csv.split('\r\n').length === 6 && /^paper,professor_grade/.test(csv), 'scores CSV has header + 5 rows');
  const interp = A.interpret(an, 'ai');
  ok(Array.isArray(interp) && interp.length >= 4 && /correlation/i.test(interp[1]), 'interpretation produces plain-language lines');
  ok(/higher|lower|level/.test(interp.join(' ')), 'interpretation states bias direction');

  console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS'));
  process.exit(failures ? 1 : 0);
});
