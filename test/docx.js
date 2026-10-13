/* GradeAlign — generate every .docx output in Node for OOXML validation.
 * Requires the docx package:  mkdir -p /tmp/rl-docx-test && cd /tmp/rl-docx-test
 *   && npm init -y && npm i docx@9.8.1
 * Then from the repo root:
 *   NODE_PATH=/tmp/rl-docx-test/node_modules node test/docx.js
 *   python3 test/validate-docx.py
 */
'use strict';

const fs = require('fs');
const path = require('path');

globalThis.docx = require('docx');

require(path.join(__dirname, '..', 'js', 'data', 'standards.js'));
require(path.join(__dirname, '..', 'js', 'rubric.js'));
require(path.join(__dirname, '..', 'js', 'analysis.js'));

const R = globalThis.GradeAlignRubric;
const A = globalThis.GradeAlignAnalysis;
const OUT = '/tmp/gradealign-docx';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const rubric = R.buildTemplateRubric('aacu-value', 'research');
  const blob = await R.buildRubricDocx(rubric, { assignmentType: 'research' });
  fs.writeFileSync(path.join(OUT, 'rubric.docx'), Buffer.from(await blob.arrayBuffer()));
  console.log('wrote rubric.docx');

  const papers = [80, 70, 90, 60, 85].map(function (g, i) {
    return { id: 'p' + i, label: 'Paper ' + (i + 1), professorGrade: g, rubricScore: [82, 68, 88, 65, 80][i], scores: {} };
  });
  const analysis = A.computeAnalysis(papers, rubric, { maxPoints: 100, thresholdPct: 10 });
  const reportBlob = await A.buildReportDocx(analysis, rubric, { generatedAt: '2026-10-12 00:00 UTC', scoreSource: 'ai' }, null);
  fs.writeFileSync(path.join(OUT, 'report.docx'), Buffer.from(await reportBlob.arrayBuffer()));
  console.log('wrote report.docx');
  console.log('done');
})().catch(function (e) { console.error('FAIL', e); process.exit(1); });
