# GradeAlign

A grading-consistency analyzer for professors. Paste or upload an assignment
prompt, generate a standards-aligned rubric (AACSB Assurance of Learning,
AAC&U VALUE-aligned, or generic discipline templates), batch-score student
papers with your own AI endpoint or by hand, then measure exactly where the
rubric's scores deviate from your own grades. A fully static web app — no
backend, no build step, no account. Open `index.html` and start.

## Features

### 1. Rubric generation (Tab: Assignment & Rubric)
- **Assignment intake**: upload the prompt as PDF (text extracted in-browser
  with pdf.js), DOCX (mammoth.js), or TXT — or paste the text directly.
  Nothing is uploaded anywhere.
- **Assignment-type auto-suggestion**: keyword heuristics detect research
  paper / case analysis / presentation / lab report / reflective essay /
  essay, and pre-select the matching assignment type (overridable).
- **Standards dropdown** (`js/data/standards.js`), each with `sourceUrl` and
  `lastChecked` (2026-10-12):
  - **AACSB Assurance of Learning (2020 standards)** — competency-goal
    categories typical of Standard 5 AoL portfolios: written communication,
    critical thinking & analytical reasoning, ethical reasoning,
    quantitative & technological agility, disciplinary knowledge, evidence
    use, oral & visual communication (dropped automatically for
    non-presentation work).
  - **AAC&U VALUE-aligned** — original criteria aligned to the dimension
    structure of the VALUE rubrics (critical thinking, written
    communication, information literacy, quantitative literacy, ethical
    reasoning, teamwork, oral communication); the assignment type picks the
    relevant subset.
  - **Generic discipline templates** — research paper, case analysis,
    presentation, lab/technical report, reflective essay.
  - **Custom** — build criteria from scratch.
- **Copyright-safe**: every descriptor bundled with GradeAlign is ORIGINAL
  text *aligned to* the named standard. No AAC&U VALUE rubric text (or any
  other published rubric text) is reproduced. Each standard carries an
  "aligned to" attribution plus its source URL.
- **Editable rubric grid**: 4–8 criteria × 4 levels
  (Exemplary/Proficient/Developing/Beginning) with inline-editable names,
  weights (must sum to 100%), and descriptors; live validation.
- **AI-tailored generation (BYO key)**: sends the assignment text + selected
  standard to any OpenAI-compatible chat-completions endpoint and parses back
  a tailored rubric. Without a key, the template generator produces a
  complete rubric — no functionality is gated.
- **Export rubric** as `.docx` (landscape rubric table, docx.js) or `.json`
  (re-importable).

### 2. Batch upload & scoring (Tab: Upload & Score)
- **Batch upload up to 20 papers** (PDF/DOCX/TXT) with per-file extraction
  status, word counts, and an anonymized-ID toggle (`Paper 1…N` vs file
  names).
- **Grade entry**: per-paper grade fields on a configurable max-points scale,
  or CSV import (`paper,grade` — paper can be the file name, `Paper 3`, or
  the row number; quoted fields, CRLF, `%` suffixes handled).
- **AI batch scoring**: each paper's text + the rubric go to your endpoint;
  per-criterion scores (1–4) with justifications. Concurrency-limited to 3
  in flight, progress bar, automatic retries (2), per-paper status, and a
  Stop button.
- **Manual rubric scoring (no-key fallback)**: click any paper to score it
  against the rubric with level pickers showing each descriptor; the total
  is computed on the assignment's points scale. The analytics work
  identically — the comparison becomes rubric-score vs your holistic grade.

### 3. Deviation report (Tab: Deviation Report)
- **Per-paper table**: professor grade | rubric/AI score | deviation in
  points and % | flag when |deviation| exceeds a user-set threshold
  (default 10%).
- **Stats**: mean deviation, mean absolute deviation, (population) standard
  deviation of deviations, Pearson correlation between the two score sets,
  bias direction ("rubric scores average N pts higher/lower").
- **Charts** (hand-rolled SVG, no chart library): scatter plot
  professor-vs-rubric with a dashed y = x perfect-agreement line (flagged
  papers in red), and per-criterion average-score bars with the criterion
  most correlated with deviation highlighted.
- **Interpretation panel**: plain-language summary — consistency level
  (high/moderate/low), bias, and where deviation concentrates ("Deviation
  concentrates most in 'Critical Thinking — Evidence & Analysis'…").
- **Export**: full report as `.docx` (stats, interpretation, tables, charts
  embedded as images, plus the rubric) and scores as `.csv`.

### 4. AI & Data (modal)
- Shared BYO-key pattern: endpoint base URL + model + API key, stored
  **only** in this browser's localStorage and sent only to that endpoint.
- Project persistence in localStorage; export/import the whole project
  (assignment, rubric, papers with extracted text, grades, scores) as `.json`;
  one-click reset.

### Privacy
Student work stays in the browser. Extracted paper text lives only in
localStorage and is transmitted solely to the AI endpoint you configure, only
when you click "Score with AI".

## Screenshots

<!-- Add screenshots after deploying, e.g.:
![Assignment & Rubric tab with generated rubric](docs/screenshot-rubric.png)
![Upload & Score tab with batch progress](docs/screenshot-score.png)
![Deviation report with scatter plot](docs/screenshot-report.png)
-->

_coming soon_

## Tech

- Vanilla HTML/CSS/JS. No framework, no bundler, no build step.
- [pdf.js](https://mozilla.github.io/pdf.js/) `3.11.174` (cdnjs, pinned) for
  PDF text extraction; [mammoth.js](https://github.com/mwilliamson/mammoth.js)
  `1.9.1` (jsDelivr, pinned) for DOCX; [docx.js](https://github.com/dolanmiu/docx)
  `9.8.1` (jsDelivr, pinned) for `.docx` generation. All lazy-loaded.
- Optional AI features call any OpenAI-compatible chat-completions endpoint
  you configure; the key never leaves your browser except to that endpoint.
- Charts are hand-rolled SVG; statistics (Pearson, mean/absolute deviation,
  population std dev) are implemented in `js/analysis.js` and verified
  against hand-computed fixtures in `test/smoke.js`.

## Run locally

Option A — just open the file:

```
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

Option B — serve it (recommended, behaves exactly like hosting):

```
cd gradealign
python3 -m http.server 8000
# then visit http://localhost:8000
```

Any static server works (`npx serve`, nginx, …). Internet access is required
for loading pdf.js / mammoth.js / docx.js from the CDNs and for AI features;
rubric templates, manual scoring, and the deviation analytics work offline
once loaded.

## Tests

Node smoke tests (standards data integrity, template generation, type
heuristics, Pearson/deviation math vs hand-computed fixtures, CSV grade
parser edge cases, AI-JSON tolerance, concurrency runner):

```
node test/smoke.js
```

.docx OOXML validation:

```
mkdir -p /tmp/rl-docx-test && cd /tmp/rl-docx-test && npm init -y && npm i docx@9.8.1
cd /path/to/gradealign
NODE_PATH=/tmp/rl-docx-test/node_modules node test/docx.js
python3 test/validate-docx.py
```

Browser end-to-end (Playwright + Chromium; serves the app on port 8139;
gates on zero console errors):

```
python3 -m http.server 8139 &
node test/e2e.js
```

## Put it on GitHub (step-by-step, no git experience needed)

1. Create a free account at <https://github.com> and sign in.
2. Click the **+** in the top-right corner → **New repository**.
3. Name it `gradealign`, leave it **Public**, do **not** check "Add a README"
   (this repo already has one), click **Create repository**.
4. Install git if you don't have it: <https://git-scm.com/downloads>
   (accept the defaults during install).
5. Open a terminal (macOS/Linux) or **Git Bash** (Windows) and run:

   ```
   cd path/to/gradealign        # the folder containing index.html
   git init                     # only if this isn't already a git repo
   git add .
   git commit -m "Initial commit: GradeAlign"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/gradealign.git
   git push -u origin main
   ```

   Replace `YOUR-USERNAME` with your GitHub username. When asked to sign in,
   use the browser window that opens (or a personal access token).
6. Refresh your repository page on GitHub — you should see all the files.

## Deploy to GitHub Pages

1. In your GitHub repository, click **Settings** → **Pages** (left sidebar).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, select **main** and **/ (root)**, click **Save**.
4. Wait a minute, then reload the page — GitHub shows your site URL:
   `https://YOUR-USERNAME.github.io/gradealign/`

That's it — the app is a plain static site, so no build configuration is needed.

## Embed in your personal website

```html
<iframe
  src="https://YOUR-USERNAME.github.io/gradealign/"
  style="width:100%; max-width:1240px; height:800px; border:1px solid #e2d9c9; border-radius:4px;"
  title="GradeAlign — grading consistency analyzer"
  loading="lazy">
</iframe>
```

Deep-link to a specific tab with the URL hash: `#rubric`, `#score`, or
`#report`:

```html
<iframe src="https://YOUR-USERNAME.github.io/gradealign/#report" …></iframe>
```

## Repository layout

```
gradealign/
├── index.html
├── styles.css
├── app.js              # UI wiring, tabs, editors, batch scoring, persistence
├── js/
│   ├── rubric.js       # rubric model, template/AI generation, type heuristics, rubric .docx
│   ├── analysis.js     # Pearson/deviation stats, SVG charts, interpretation, report .docx/.csv
│   ├── scoring.js      # pdf.js/mammoth extraction, CSV grade parser, concurrency runner
│   ├── ai.js           # optional BYO-key OpenAI-compatible AI (rubric + scoring)
│   └── data/
│       └── standards.js# standards/template database (original descriptors; sourceUrl + lastChecked)
├── test/
│   ├── smoke.js        # node tests: data integrity, stats fixtures, CSV parser, AI JSON, runner
│   ├── docx.js         # generates every .docx in node (requires npm i docx@9.8.1)
│   ├── validate-docx.py# OOXML validation of generated files
│   └── e2e.js          # Playwright/Chromium end-to-end, zero-console-error gate
├── README.md
├── LICENSE             # MIT
└── .gitignore
```

## Disclaimer

Rubric templates are original descriptors *aligned to* the AACSB 2020
accreditation standards' Assurance of Learning approach and the AAC&U VALUE
rubric dimension structure (sources and check dates in
`js/data/standards.js`); they are starting points, not official rubrics.
AI-generated scores are advisory and must be reviewed by the instructor;
GradeAlign measures score *deviation*, not who is right.

## License

MIT — see [LICENSE](LICENSE).
