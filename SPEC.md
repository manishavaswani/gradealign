# SPEC — GradeAlign (App 6)

Grading consistency analyzer: generate a standard-aligned rubric, batch-score student papers with AI, and measure the deviation between AI scores and the professor's grades. Static web app, zero backend, no build step. Same visual suite language (warm neutrals, serif headings, no gradients, no emojis).

## Deliverable
Repo folder: `/mnt/agents/output/academic-apps/gradealign/` — index.html, styles.css, app.js, js/ modules, README.md (GitHub upload + Pages + embed instructions), LICENSE (MIT), .gitignore. git init + commit.

## Feature 1 — Rubric generation (js/rubric.js, js/data/standards.js)
Flow: upload/paste the **assignment prompt** (PDF via pdf.js, DOCX via mammoth.js, or plain text) → select a **standard** from dropdown → rubric generated.
- **Standards dropdown** (web-research each; sourceUrl + lastChecked 2026-10-12; write ORIGINAL rubric text aligned to the standard — do not copy copyrighted rubric text verbatim, especially AAC&U VALUE rubrics; note "aligned to" attribution):
  - **AACSB Assurance of Learning** — goal-based categories (e.g., written communication, critical thinking/analytical reasoning, ethical reasoning, quantitative/technological agility per AACSB 2020 standards philosophy)
  - **AAC&U VALUE-aligned** — critical thinking, written communication, information literacy, quantitative literacy, ethical reasoning, teamwork, oral communication (pick relevant subset by assignment type)
  - **Generic discipline templates** — research paper, case analysis, presentation, lab/technical report, reflective essay
  - **Custom** — user builds criteria from scratch
- Assignment-type auto-suggestion from the uploaded assignment text (heuristics: case study / research paper / essay keywords)
- Rubric = 4-8 criteria × 4 performance levels (Exemplary/Proficient/Developing/Beginning) with descriptors + point weights; editable inline; export rubric as .docx (docx.js) and .json
- **AI rubric generation (BYO key)**: generate criterion descriptors tailored to the actual assignment text + selected standard; template fallback without key (pre-written standard-aligned descriptors)

## Feature 2 — Batch scoring + deviation analysis (js/scoring.js, js/analysis.js)
- **Batch upload 10–15 papers** (up to 20 allowed): PDF/DOCX/TXT; show filename, word count, extraction status; rename to anonymized IDs (Paper 1…N) toggle
- **Grades entry**: per-paper field for the professor's grade (points or %; user sets max points); CSV upload option (paper,grade)
- **AI scoring (BYO key, OpenAI-compatible, localStorage only)**: each paper's extracted text + rubric sent to the model; returns per-criterion scores (1-4) + justification + total. Concurrency-limited (3 in flight), progress bar, retry on failure, per-paper status. Without a key: manual rubric-scoring UI so professors can score with the rubric and still use analytics (deviation vs their own entered grades becomes rubric-score vs holistic-grade comparison).
- **Deviation dashboard**:
  - Table: paper | professor grade | rubric/AI score | deviation (points + %) | flag if |dev| > threshold (user-set, default 10%)
  - Stats: mean deviation, mean absolute deviation, std dev, correlation coefficient (Pearson) between the two sets, direction bias ("AI scores average 4.2 pts higher / lower than professor grades")
  - Charts (hand-rolled SVG, no heavy chart lib): scatter plot professor-vs-AI with y=x reference line; per-criterion bar comparison of average scores
  - Interpretation panel: plain-language summary (consistency level, where deviation concentrates — e.g., "largest gaps in 'Critical Thinking' criterion")
- **Export**: full report as .docx (rubric + table + stats + charts as images) and .csv of scores

## Other
- Tabs: 1) Assignment & Rubric, 2) Upload & Score, 3) Deviation Report. Project persistence in localStorage; export/import project .json.
- API key settings shared pattern with AcceptEdge/GrantPilot (OpenAI-compatible endpoint + key fields).
- Privacy note in UI: student work stays in the browser; text is only sent to the user's own AI endpoint when scoring.

## Quality bar
- node --check all JS; curl-verify CDNs; node smoke tests: rubric data integrity, Pearson correlation + deviation math against hand-computed fixtures, CSV grade parser; docx valid OOXML; browser e2e if harness available (build rubric, upload 3 txt fixtures, enter grades, manual-score, see deviation report) with zero console errors
- README: same structure as sibling apps
