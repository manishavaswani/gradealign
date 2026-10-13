/* GradeAlign — js/ai.js
 * Optional AI features (BYO key, OpenAI-compatible chat-completions endpoint).
 * Settings live ONLY in this browser's localStorage; the key is sent ONLY to
 * the endpoint the user configures. Both AI features have full template/manual
 * fallbacks, so the app works completely without a key.
 * Exposed as window.GradeAlignAI / globalThis.GradeAlignAI.
 */
(function (global) {
  'use strict';

  var LS_KEY = 'gradealign.ai.v1';
  var MAX_PAPER_CHARS = 14000;

  function getSettings() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var s = raw ? JSON.parse(raw) : {};
      return { endpoint: s.endpoint || '', model: s.model || '', key: s.key || '' };
    } catch (e) { return { endpoint: '', model: '', key: '' }; }
  }

  function saveSettings(s) {
    localStorage.setItem(LS_KEY, JSON.stringify({
      endpoint: String(s.endpoint || '').trim(),
      model: String(s.model || '').trim(),
      key: String(s.key || '').trim()
    }));
  }

  function clearSettings() { localStorage.removeItem(LS_KEY); }

  function isConfigured() {
    var s = getSettings();
    return !!(s.endpoint && s.key);
  }

  /* One chat-completions call → assistant message text. */
  function chat(systemPrompt, userPrompt, temperature) {
    var s = getSettings();
    if (!s.endpoint || !s.key) {
      return Promise.reject(new Error('No AI endpoint configured. Add an endpoint and key in Settings, or use the template/manual workflow.'));
    }
    var url = s.endpoint.replace(/\/+$/, '') + '/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.key },
      body: JSON.stringify({
        model: s.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature != null ? temperature : 0.3,
        response_format: { type: 'json_object' }
      })
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('AI endpoint returned HTTP ' + r.status + (t ? ' — ' + t.slice(0, 200) : ''));
        });
      }
      return r.json();
    }).then(function (j) {
      var msg = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!msg) { throw new Error('AI endpoint returned an unexpected response shape.'); }
      return msg.trim();
    });
  }

  /* --------------------------- rubric generation --------------------------- */

  function generateRubric(assignmentText, standard, assignmentType, fallbackRubric) {
    var Rubric = global.GradeAlignRubric;
    var sys = 'You are an expert in higher-education assessment design. You write ORIGINAL analytic rubrics ' +
      'aligned to the named accreditation/assessment standard. Never reproduce the wording of any published ' +
      'rubric (including AAC&U VALUE rubrics) — write fresh descriptor text. Output ONLY valid JSON.';
    var shape = '{ "name": string, "criteria": [ { "name": string, "description": string, ' +
      '"descriptors": { "exemplary": string, "proficient": string, "developing": string, "beginning": string } } ] }';
    var user = [
      'ASSIGNMENT TYPE: ' + (assignmentType || 'generic'),
      'STANDARD: ' + standard.name,
      'STANDARD NOTES: ' + standard.description,
      'Write 4–8 criteria for grading student responses to the assignment below. Tailor every descriptor to the',
      'actual assignment while staying aligned to the standard. JSON shape:',
      shape,
      '',
      'ASSIGNMENT TEXT:',
      String(assignmentText || '').slice(0, 8000)
    ].join('\n');
    return chat(sys, user).then(function (text) {
      var rubric = Rubric.parseAiRubricJson(text, fallbackRubric);
      if (!rubric) { throw new Error('The AI response could not be parsed into a rubric. The template rubric is unchanged.'); }
      return rubric;
    });
  }

  /* ----------------------------- paper scoring ----------------------------- */

  function scorePaper(rubric, paperText, maxPoints) {
    var sys = 'You are a careful, consistent grader. Score the student paper against the rubric, criterion by ' +
      'criterion. Use ONLY the rubric levels 4 (Exemplary), 3 (Proficient), 2 (Developing), 1 (Beginning). ' +
      'Be strict about evidence: justify each score in one or two sentences with specifics from the paper. ' +
      'Output ONLY valid JSON.';
    var rubricJson = {
      maxPoints: maxPoints,
      criteria: rubric.criteria.map(function (cr) {
        return {
          criterionId: cr.id,
          name: cr.name,
          weightPct: cr.weight,
          levels: {
            4: cr.descriptors.exemplary,
            3: cr.descriptors.proficient,
            2: cr.descriptors.developing,
            1: cr.descriptors.beginning
          }
        };
      })
    };
    var user = [
      'RUBRIC (JSON):',
      JSON.stringify(rubricJson),
      '',
      'Return JSON: { "scores": [ { "criterionId": string, "score": 1|2|3|4, "justification": string } ] }',
      'Include exactly one entry per criterionId.',
      '',
      'STUDENT PAPER (possibly truncated):',
      String(paperText || '').slice(0, MAX_PAPER_CHARS)
    ].join('\n');
    return chat(sys, user, 0.1).then(function (text) {
      var scores = global.GradeAlignRubric.parseAiScoresJson(text, rubric);
      if (!scores) { throw new Error('The AI response could not be parsed into criterion scores.'); }
      var missing = rubric.criteria.filter(function (cr) { return !scores[cr.id]; });
      if (missing.length) {
        throw new Error('The AI response omitted scores for: ' + missing.map(function (m) { return m.name; }).join(', '));
      }
      return scores;
    });
  }

  global.GradeAlignAI = {
    getSettings: getSettings,
    saveSettings: saveSettings,
    clearSettings: clearSettings,
    isConfigured: isConfigured,
    chat: chat,
    generateRubric: generateRubric,
    scorePaper: scorePaper,
    MAX_PAPER_CHARS: MAX_PAPER_CHARS
  };
})(typeof window !== 'undefined' ? window : globalThis);
