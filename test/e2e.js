/* GradeAlign — end-to-end browser test (Playwright + Chromium).
 * Requires the app served on http://localhost:8139 (e.g.:
 *   python3 -m http.server 8139  from the repo root)
 * Fails on any console error. Exercises: paste assignment → template rubric,
 * upload 3 .txt fixtures, enter grades, manual-score each paper, view the
 * deviation report (stats + charts + interpretation), export CSV and rubric
 * .docx downloads.
 */
'use strict';

const fs = require('fs');
const { chromium } = require('playwright');

const FIX = '/tmp/gradealign-fixtures';

(async () => {
  fs.mkdirSync(FIX, { recursive: true });
  fs.writeFileSync(FIX + '/alice.txt', 'This paper argues that remote work reshapes urban labor markets. ' + 'Evidence and analysis are presented. '.repeat(60));
  fs.writeFileSync(FIX + '/bob.txt', 'A shorter paper with a clear thesis but limited sources and a thin conclusion. ' + 'Some analysis follows. '.repeat(40));
  fs.writeFileSync(FIX + '/carol.txt', 'Notes toward an argument. Structure is loose and evidence mostly anecdotal. ' + 'Draft material. '.repeat(30));

  const errors = [];
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') { errors.push(msg.text()); } });
  page.on('pageerror', (err) => { errors.push('pageerror: ' + err.message); });

  await page.goto('http://localhost:8139/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#assignment-text', { timeout: 10000 });
  console.log('PASS  page loads, Assignment & Rubric tab active');

  // 1. paste assignment → type suggestion + template rubric
  await page.fill('#assignment-text', 'Write a research paper (2000 words) with a research question, literature review of at least 8 peer-reviewed scholarly sources, methodology, findings, and a references section. Cite at least 8 sources. Include an abstract.');
  await page.waitForFunction(() => /research paper/.test(document.getElementById('type-suggestion').textContent), { timeout: 5000 });
  console.log('PASS  assignment-type heuristic suggests research paper');

  await page.selectOption('#standard-select', 'aacu-value');
  await page.click('#gen-template');
  await page.waitForSelector('#rubric-editor:not(.hidden)', { timeout: 5000 });
  const critRows = await page.locator('#rubric-tbody tr').count();
  if (critRows < 4) { throw new Error('expected >=4 rubric criteria, got ' + critRows); }
  console.log('PASS  template rubric generated with ' + critRows + ' criteria, editor visible');

  // 2. upload 3 txt fixtures
  await page.click('#tab-score');
  await page.setInputFiles('#papers-file', [FIX + '/alice.txt', FIX + '/bob.txt', FIX + '/carol.txt']);
  await page.waitForFunction(() => document.querySelectorAll('#papers-tbody .badge.ok').length === 3, { timeout: 15000 });
  console.log('PASS  3 papers uploaded and extracted');

  // anonymized labels
  const firstLabel = await page.locator('#papers-tbody .paper-label').first().innerText();
  if (firstLabel.trim() !== 'Paper 1') { throw new Error('expected anonymized label "Paper 1", got ' + firstLabel); }
  console.log('PASS  anonymized IDs shown (Paper 1…N)');

  // 3. enter grades
  const gradeInputs = page.locator('#papers-tbody input[type="number"]');
  await gradeInputs.nth(0).fill('90');
  await gradeInputs.nth(1).fill('78');
  await gradeInputs.nth(2).fill('55');
  console.log('PASS  professor grades entered');

  // 4. manual-score each paper: all Exemplary / all Proficient / all Developing
  const levels = ['4', '3', '2'];
  for (let i = 0; i < 3; i++) {
    await page.locator('#papers-tbody .btn.small', { hasText: 'Score manually' }).nth(i).click();
    await page.waitForSelector('#manual-score:not(.hidden)', { timeout: 5000 });
    const selects = page.locator('#manual-score-body select[data-cid]');
    const n = await selects.count();
    if (n !== critRows) { throw new Error('manual scoring shows ' + n + ' criteria, expected ' + critRows); }
    for (let j = 0; j < n; j++) { await selects.nth(j).selectOption(levels[i]); }
    await page.waitForFunction(() => /Rubric total: /.test(document.getElementById('manual-score-total').textContent), { timeout: 5000 });
    await page.click('#manual-score-save');
    await page.waitForSelector('#manual-score.hidden', { state: 'attached', timeout: 5000 });
  }
  await page.waitForFunction(() => document.querySelectorAll('#papers-tbody .badge.ok').length === 6, { timeout: 5000 }); // 3 extraction + 3 scoring badges
  console.log('PASS  all 3 papers manually scored (100 / 75 / 50 expected)');

  const scoreCells = await page.locator('#papers-tbody td:nth-child(5)').allInnerTexts();
  if (!/^100/.test(scoreCells[0]) || !/^75/.test(scoreCells[1]) || !/^50/.test(scoreCells[2])) {
    throw new Error('unexpected rubric totals: ' + JSON.stringify(scoreCells));
  }
  console.log('PASS  rubric totals computed: ' + scoreCells.join(' | '));

  // 5. deviation report
  await page.click('#tab-report');
  await page.waitForSelector('#report-body:not(.hidden)', { timeout: 5000 });
  const stats = await page.locator('#stat-grid').innerText();
  if (!/\+0\.7 pts/.test(stats)) { throw new Error('expected mean deviation +0.7 pts, stats: ' + stats); }
  if (!/0\.98/.test(stats)) { throw new Error('expected Pearson r ≈ 0.98, stats: ' + stats); }
  console.log('PASS  stats cards render (mean dev +0.7, r ≈ 0.98)');

  const devRows = await page.locator('#dev-tbody tr').count();
  if (devRows !== 3) { throw new Error('expected 3 deviation rows, got ' + devRows); }
  const circles = await page.locator('#chart-scatter circle').count();
  if (circles !== 3) { throw new Error('expected 3 scatter points, got ' + circles); }
  const bars = await page.locator('#chart-bars rect').count();
  if (bars < critRows + 1) { throw new Error('expected criterion bars, got ' + bars); }
  const interp = await page.locator('#interpretation li').count();
  if (interp < 4) { throw new Error('expected >=4 interpretation lines, got ' + interp); }
  console.log('PASS  deviation table (3 rows), scatter (3 points), bars, interpretation render');

  // threshold flagging: devs are +10 / -3 / -5 pts on 100 → at threshold 5% one flagged
  await page.fill('#threshold-pct', '5');
  await page.waitForFunction(() => document.querySelectorAll('#dev-tbody .badge.bad').length === 1, { timeout: 5000 });
  console.log('PASS  threshold 5% flags exactly the +10% paper');

  // 6. exports
  const dl1 = page.waitForEvent('download', { timeout: 10000 });
  await page.click('#export-scores-csv');
  const csvDl = await dl1;
  if (!/\.csv$/.test(csvDl.suggestedFilename())) { throw new Error('CSV download name: ' + csvDl.suggestedFilename()); }
  console.log('PASS  scores CSV downloads: ' + csvDl.suggestedFilename());

  await page.click('#tab-rubric');
  const dl2 = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#export-rubric-docx');
  const docxDl = await dl2;
  const docxPath = FIX + '/downloaded-rubric.docx';
  await docxDl.saveAs(docxPath);
  const sig = fs.readFileSync(docxPath).slice(0, 2).toString('latin1');
  if (sig !== 'PK') { throw new Error('downloaded rubric docx is not a zip'); }
  console.log('PASS  rubric .docx downloads (valid zip signature)');

  // 7. persistence: reload and confirm state survives
  await page.reload({ waitUntil: 'load' });
  await page.click('#tab-score');
  await page.waitForFunction(() => document.querySelectorAll('#papers-tbody tr').length === 3, { timeout: 5000 });
  const g0 = await page.locator('#papers-tbody input[type="number"]').first().inputValue();
  if (g0 !== '90') { throw new Error('grade not persisted, got ' + g0); }
  console.log('PASS  project persists across reload (papers + grades)');

  await browser.close();

  if (errors.length) {
    console.log('\nCONSOLE ERRORS:');
    errors.forEach((e) => console.log('  ' + e));
    process.exit(1);
  }
  console.log('\nALL PASS (zero console errors)');
})().catch((e) => { console.error('FAIL ', e); process.exit(1); });
