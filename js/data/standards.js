/* GradeAlign — js/data/standards.js
 * Standards and rubric-template database.
 *
 * COPYRIGHT NOTE: every criterion descriptor below is ORIGINAL text written
 * for GradeAlign. Templates are "aligned to" the named standards'
 * published *dimensions / competency-goal categories* only — no wording is
 * copied from AAC&U VALUE rubrics or any other copyrighted rubric. Each
 * entry records sourceUrl + lastChecked (2026-10-12).
 *
 * Research sources (lastChecked 2026-10-12):
 *  - AACSB 2020 Guiding Principles and Standards for Business Accreditation,
 *    Standard 5 (Assurance of Learning): competency goals (knowledge, skills,
 *    abilities) assessed via direct + indirect measures at program level.
 *    https://www.aacsb.edu/-/media/documents/accreditation/_2020-aacsb-business-accreditation-standards-_final--july-1-2024.pdf
 *  - AACSB 2020 Interpretive Guidance (July 2024 update), Standard 5:
 *    example competency goals include communication skills (oral/written),
 *    technical business knowledge.
 *    https://www.aacsb.edu/-/media/documents/accreditation/2020-interpretive-guidance-july-1-2024_fnl.pdf
 *  - AACSB Insights, "Transforming Assurance of Learning for Lasting Impact"
 *    (May 2021): AoL = systematic processes demonstrating learners achieve
 *    program-level competencies. https://www.aacsb.edu/insights/articles/2021/05/transforming-assurance-of-learning-for-lasting-impact
 *  - AAC&U VALUE rubrics: 16 rubrics across Intellectual and Practical
 *    Skills, Personal and Social Responsibility, Integrative and Applied
 *    Learning; each rubric articulates 5-6 fundamental dimensions with
 *    progressively more sophisticated performance descriptors.
 *    https://www.aacu.org/value-rubrics
 *
 * Exposed as window.GradeAlignStandards / globalThis.GradeAlignStandards.
 * Pure data + helpers — no DOM, no fetch — so it loads in Node smoke tests.
 */
(function (global) {
  'use strict';

  var LAST_CHECKED = '2026-10-12';

  /* Four fixed performance levels, highest first. Score value = array index
   * mapping is handled in js/rubric.js (Exemplary=4 … Beginning=1). */
  var LEVELS = [
    { key: 'exemplary', name: 'Exemplary', score: 4 },
    { key: 'proficient', name: 'Proficient', score: 3 },
    { key: 'developing', name: 'Developing', score: 2 },
    { key: 'beginning', name: 'Beginning', score: 1 }
  ];

  /* Helper to keep criteria terse: c(name, desc, [exemplary, proficient, developing, beginning]) */
  function c(name, description, d) {
    return {
      name: name,
      description: description,
      descriptors: { exemplary: d[0], proficient: d[1], developing: d[2], beginning: d[3] }
    };
  }

  /* ------------------------------------------------------------------ *
   * AACSB Assurance of Learning — competency-goal template
   * Aligned to the competency categories typical of AACSB 2020 Standard 5
   * AoL programs (written/oral communication, analytical reasoning,
   * ethical reasoning, quantitative & technological agility, disciplinary
   * knowledge). Descriptors are original.
   * ------------------------------------------------------------------ */
  var AACSB_AOL = {
    id: 'aacsb-aol',
    kind: 'standard',
    name: 'AACSB Assurance of Learning (2020 standards)',
    shortName: 'AACSB AoL',
    description: 'Competency-goal rubric aligned to AACSB\'s 2020 accreditation standards philosophy: program-level competency goals (knowledge, skills, abilities) demonstrated through direct assessment of student work. Categories reflect the competency goals commonly used in AoL portfolios.',
    attribution: 'Original descriptors written for GradeAlign, aligned to AACSB 2020 Standards, Standard 5 (Assurance of Learning). No AACSB text is reproduced.',
    sourceUrl: 'https://www.aacsb.edu/-/media/documents/accreditation/_2020-aacsb-business-accreditation-standards-_final--july-1-2024.pdf',
    lastChecked: LAST_CHECKED,
    criteria: [
      c('Written Communication', 'Clarity, organization, and professional quality of business writing.', [
        'Writing is precise, well organized, and appropriately professional; the argument is easy to follow and free of distracting errors.',
        'Writing is clear and organized with a mostly professional tone; minor lapses in flow or mechanics do not impede understanding.',
        'Writing is understandable but uneven: organization drifts, phrasing is sometimes awkward, or errors occasionally obscure meaning.',
        'Writing is difficult to follow: disorganized, informal where professionalism is required, or errors substantially impede understanding.'
      ]),
      c('Critical Thinking & Analytical Reasoning', 'Identification of issues, evaluation of evidence, and quality of conclusions.', [
        'Frames the central issue sharply, weighs competing evidence and alternatives, and reaches well-justified conclusions that acknowledge limitations.',
        'Identifies the main issue and supports conclusions with relevant evidence; alternatives and limitations are considered but thinly.',
        'Identifies an issue but analysis is partial: evidence is accepted uncritically, alternatives are few, or conclusions outrun the support offered.',
        'Misidentifies or overlooks the issue; assertions rest on opinion rather than analysis, and conclusions are unsupported.'
      ]),
      c('Ethical Reasoning', 'Recognition of ethical dimensions and reasoned treatment of stakeholders and consequences.', [
        'Recognizes the ethical dimensions unprompted, identifies affected stakeholders, and evaluates options against explicit ethical principles and consequences.',
        'Recognizes the main ethical issue and considers stakeholders, though the evaluation of alternatives is general rather than principle-based.',
        'Mentions an ethical concern but treats it superficially, or reduces it to legality/compliance without reasoning.',
        'Overlooks the ethical dimension of a situation where it is material.'
      ]),
      c('Quantitative & Technological Agility', 'Selection, execution, and interpretation of quantitative methods and tools.', [
        'Chooses appropriate quantitative methods or tools, executes them accurately, and interprets results correctly in context, including their limits.',
        'Uses appropriate methods with minor errors; interpretation is mostly correct and connected to the decision at hand.',
        'Uses quantitative methods mechanically: some errors in execution, or results reported without meaningful interpretation.',
        'Avoids quantitative evidence where it is needed, or applies methods incorrectly and draws invalid conclusions from them.'
      ]),
      c('Disciplinary Knowledge Application', 'Correct use of business concepts, frameworks, and terminology from the discipline.', [
        'Applies disciplinary concepts and frameworks accurately and purposefully, choosing tools that fit the situation and adapting them where needed.',
        'Applies the expected concepts correctly, with sound if conventional choices of framework.',
        'Names relevant concepts but applies them loosely, with terminology errors or frameworks used as checklists rather than analysis tools.',
        'Demonstrates little command of the disciplinary concepts the assignment targets.'
      ]),
      c('Evidence & Information Use', 'Quality, relevance, and integration of sources and data.', [
        'Draws on credible, well-chosen evidence; integrates it smoothly into the argument and represents sources fairly.',
        'Uses credible evidence that supports most claims; integration is occasionally abrupt or sources are taken at face value.',
        'Evidence is thin, dated, or loosely connected to claims; sources are summarized rather than used.',
        'Claims are largely unsupported, or sources are misrepresented or unreliable.'
      ]),
      c('Oral & Visual Communication', 'Effectiveness of spoken delivery and supporting visuals (for presentation components).', [
        'Delivers a well-paced, engaging presentation; visuals clarify rather than decorate; questions are handled with command of the material.',
        'Delivers a clear, organized presentation with serviceable visuals; handles most questions adequately.',
        'Delivery is uneven or over-reliant on notes/slides; visuals are cluttered or disconnected from the talk.',
        'Delivery impedes the message; visuals are missing, unreadable, or a substitute for preparation.'
      ])
    ]
  };

  /* ------------------------------------------------------------------ *
   * AAC&U VALUE-aligned template.
   * Dimensions inspired by the seven VALUE outcomes most relevant to
   * written/coursework assignments. All descriptor wording is ORIGINAL;
   * nothing is copied from the VALUE rubrics (which are free for
   * institutional use but whose text we do not reproduce here).
   * ------------------------------------------------------------------ */
  var AACU_VALUE = {
    id: 'aacu-value',
    kind: 'standard',
    name: 'AAC&U VALUE-aligned (liberal education outcomes)',
    shortName: 'AAC&U VALUE-aligned',
    description: 'Aligned to the dimension structure of the AAC&U VALUE rubrics (Valid Assessment of Learning in Undergraduate Education): a small set of fundamental dimensions per outcome, with descriptors of progressively more sophisticated attainment. Covers the VALUE outcomes most relevant to coursework: critical thinking, written communication, information literacy, quantitative literacy, ethical reasoning, teamwork, and oral communication.',
    attribution: 'Original descriptors written for GradeAlign, aligned to the dimension categories of the AAC&U VALUE rubrics. No VALUE rubric text is reproduced.',
    sourceUrl: 'https://www.aacu.org/value-rubrics',
    lastChecked: LAST_CHECKED,
    criteria: [
      c('Critical Thinking — Explanation of Issues', 'How clearly and completely the problem or question at hand is stated and contextualized.', [
        'States the issue precisely and completely, conveying all information necessary for a full understanding of what is at stake.',
        'States the issue clearly with enough context for understanding, leaving only minor ambiguities.',
        'States the issue but leaves important aspects vague, unexplored, or presumed.',
        'States the issue inaccurately or so vaguely that the analysis that follows is unmoored.'
      ]),
      c('Critical Thinking — Evidence & Analysis', 'Selection and use of information to investigate a point of view or reach a conclusion.', [
        'Examines information from well-chosen sources with enough depth to develop a comprehensive analysis; questions assumptions and addresses counter-evidence.',
        'Uses information from credible sources to develop a coherent analysis; interpretation is sound with limited interrogation of assumptions.',
        'Uses information that is partly relevant; analysis repeats rather than examines, and opposing views are noted only in passing.',
        'Uses information without scrutiny; analysis is superficial or absent.'
      ]),
      c('Written Communication — Content & Development', 'Depth of ideas and the extent to which the writing develops its purpose.', [
        'Develops ideas fully and compellingly; every section earns its place in advancing the purpose.',
        'Develops ideas adequately with appropriate detail; a few passages are thin or tangential.',
        'Develops ideas unevenly; some sections are underdeveloped or drift from the purpose.',
        'Ideas are asserted rather than developed; the writing does not sustain its purpose.'
      ]),
      c('Written Communication — Organization & Mechanics', 'Structure, flow, and control of syntax and usage.', [
        'Structure is purposeful and graceful — introductions, transitions, and conclusions guide the reader; language is controlled and nearly error-free.',
        'Structure is clear and logical; language is generally controlled with errors that do not impede meaning.',
        'Structure is present but mechanical or inconsistent; errors occasionally distract or confuse.',
        'Lacks a discernible structure; errors frequently impede meaning.'
      ]),
      c('Information Literacy', 'Locating, evaluating, and ethically using information and sources.', [
        'Locates authoritative sources well matched to the question, evaluates their credibility and viewpoint, and uses them ethically with accurate attribution.',
        'Locates credible sources and attributes them correctly; evaluation of quality and viewpoint is present but brief.',
        'Relies on a narrow or mixed-quality set of sources; attribution is inconsistent or evaluation is absent.',
        'Uses few, unreliable, or unattributed sources.'
      ]),
      c('Quantitative Literacy', 'Reasoning with numbers: representation, calculation, interpretation, and communication of quantitative information.', [
        'Represents quantitative information accurately, calculates correctly, interprets results in context, and communicates what the numbers mean for the argument.',
        'Represents and calculates quantitative information with minor slips; interpretation is accurate and connected to the argument.',
        'Performs calculations with some errors, or reports numbers without interpreting what they mean.',
        'Mishandles quantitative information or omits it where the task requires it.'
      ]),
      c('Ethical Reasoning', 'Recognition of ethical issues and application of ethical perspectives to a decision.', [
        'Identifies the ethical questions in full complexity, applies ethical perspectives/concepts accurately, and weighs objections to the chosen position.',
        'Identifies the central ethical question and applies a relevant perspective, considering at least one objection.',
        'Recognizes that an ethical question exists but applies perspectives loosely or one-sidedly.',
        'Does not recognize or engage the ethical dimension of the task.'
      ]),
      c('Teamwork & Collaboration', 'Contribution to group effort, facilitation of others\' work, and constructive response to conflict (for collaborative deliverables).', [
        'Advances the team\'s work substantially, helps others contribute their best, and addresses conflict constructively while delivering on commitments.',
        'Contributes reliably and cooperates well; engagement with others\' ideas is genuine if not always proactive.',
        'Contributes inconsistently or works in parallel rather than together; limited engagement with teammates\' ideas.',
        'Contributes little, obstructs the team\'s progress, or cannot evidence individual contribution.'
      ]),
      c('Oral Communication', 'Organization, delivery, and supporting materials of spoken presentations.', [
        'Organized, confident delivery with language and supporting material adapted to the audience; holds attention and communicates the central message memorably.',
        'Clear delivery and logical organization; supporting materials are adequate and the message comes through.',
        'Delivery or organization is uneven; supporting materials partially support the message.',
        'Delivery and organization impede the message; supporting materials are missing or counterproductive.'
      ])
    ]
  };

  /* ------------------------------------------------------------------ *
   * Generic discipline templates (original).
   * ------------------------------------------------------------------ */
  var TEMPLATES = [
    {
      id: 'research-paper',
      kind: 'template',
      name: 'Research paper (generic)',
      shortName: 'Research paper',
      assignmentTypes: ['research'],
      description: 'Generic rubric for an empirical or literature-based research paper in any discipline.',
      attribution: 'Original template written for GradeAlign.',
      sourceUrl: '',
      lastChecked: LAST_CHECKED,
      criteria: [
        c('Thesis & Research Question', 'Focus, significance, and precision of the central claim or question.', [
          'Presents a precise, significant thesis or research question and sustains focus on it throughout.',
          'Presents a clear thesis or question; focus wavers only slightly.',
          'Thesis or question is broad, partly implied, or focus drifts between sections.',
          'No identifiable thesis or research question.'
        ]),
        c('Literature & Sources', 'Breadth, quality, and integration of prior work and evidence.', [
          'Synthesizes a well-chosen body of credible sources; positions the paper accurately within the existing literature.',
          'Uses credible sources that cover the topic; synthesis is present though sources are sometimes summarized serially.',
          'Sources are few, dated, or of mixed quality; literature is listed rather than synthesized.',
          'Little or no engagement with sources beyond anecdote.'
        ]),
        c('Method / Approach', 'Appropriateness and transparency of the method or analytic approach.', [
          'Method or analytic approach is well chosen, described transparently, and its limitations acknowledged.',
          'Method is appropriate and described clearly enough to follow; limitations noted briefly.',
          'Method is partially described or only loosely matched to the question.',
          'Method is absent, inappropriate, or impossible to assess.'
        ]),
        c('Analysis & Argument', 'Quality of reasoning from evidence to findings and claims.', [
          'Builds a rigorous argument: evidence is analyzed, alternative explanations weighed, and claims match the strength of the evidence.',
          'Reasoning is sound and evidence-based; alternative explanations acknowledged but not deeply examined.',
          'Reasoning is uneven: some claims unsupported, evidence described rather than analyzed.',
          'Argument is missing, circular, or contradicts the evidence presented.'
        ]),
        c('Organization & Writing', 'Structure, clarity, and mechanics of the paper.', [
          'Structure serves the argument; prose is clear, economical, and essentially error-free.',
          'Logical structure and readable prose; minor mechanical errors.',
          'Structure is formulaic or hard to follow in places; errors sometimes distract.',
          'Disorganized; errors impede comprehension.'
        ]),
        c('Citations & Academic Integrity', 'Accuracy and completeness of citation practice.', [
          'Citations are complete, accurate, and in the required style; all borrowed ideas are attributed.',
          'Citations follow the required style with occasional lapses; attribution is consistent.',
          'Citations are inconsistent in style or incomplete; occasional missing attribution.',
          'Citation practice is absent or unreliable enough to raise integrity concerns.'
        ])
      ]
    },
    {
      id: 'case-analysis',
      kind: 'template',
      name: 'Case analysis (generic)',
      shortName: 'Case analysis',
      assignmentTypes: ['case'],
      description: 'Generic rubric for a business or disciplinary case analysis with recommendations.',
      attribution: 'Original template written for GradeAlign.',
      sourceUrl: '',
      lastChecked: LAST_CHECKED,
      criteria: [
        c('Issue Identification', 'Accurate framing of the central problem in the case.', [
          'Pinpoints the central problem and its causes, distinguishing symptoms from root issues.',
          'Identifies the main problem correctly; causes treated more briefly.',
          'Identifies a problem but conflates symptoms with causes or misses a material aspect.',
          'Misidentifies the problem the case presents.'
        ]),
        c('Application of Frameworks', 'Use of course concepts and analytical frameworks.', [
          'Selects frameworks that genuinely fit the case and applies them with insight beyond mechanical steps.',
          'Applies appropriate course frameworks correctly.',
          'Applies frameworks mechanically or partially; connection to the case facts is loose.',
          'Frameworks are absent, misapplied, or misnamed.'
        ]),
        c('Use of Case Evidence', 'Grounding of analysis in the facts and data of the case.', [
          'Anchors every major claim in specific case facts and numbers; distinguishes fact from assumption.',
          'Uses case evidence to support most claims.',
          'Uses evidence selectively; some claims rest on assumption.',
          'Largely ignores the case facts.'
        ]),
        c('Alternatives & Trade-offs', 'Generation and evaluation of realistic options.', [
          'Develops genuinely distinct alternatives and evaluates their trade-offs and risks even-handedly.',
          'Presents plausible alternatives with a reasonable comparison.',
          'Alternatives are thin, straw-manned, or compared inconsistently.',
          'Offers a single course of action without considering alternatives.'
        ]),
        c('Recommendation & Implementation', 'Quality and feasibility of the proposed course of action.', [
          'Recommendation follows from the analysis and includes a concrete, feasible implementation path with success measures.',
          'Recommendation is clear, justified, and broadly feasible.',
          'Recommendation is stated but weakly linked to the analysis or short on implementation detail.',
          'Recommendation is missing, unsupported, or impractical.'
        ]),
        c('Professional Communication', 'Organization and business-appropriate presentation.', [
          'Reads like a professional brief: tight structure, executive-ready clarity, error-free.',
          'Clear and organized with minor lapses in polish.',
          'Understandable but loosely structured or unevenly written.',
          'Poorly organized or written below a professional standard.'
        ])
      ]
    },
    {
      id: 'presentation',
      kind: 'template',
      name: 'Presentation (generic)',
      shortName: 'Presentation',
      assignmentTypes: ['presentation'],
      description: 'Generic rubric for an oral presentation with slides or other visual support.',
      attribution: 'Original template written for GradeAlign.',
      sourceUrl: '',
      lastChecked: LAST_CHECKED,
      criteria: [
        c('Content & Accuracy', 'Substance, accuracy, and appropriate depth of the material presented.', [
          'Content is accurate, well researched, and pitched at exactly the right depth for the audience and time limit.',
          'Content is accurate and appropriately scoped.',
          'Content is mostly accurate but shallow, padded, or over-stuffed for the time available.',
          'Content contains significant inaccuracies or misses the assignment\'s scope.'
        ]),
        c('Organization & Storyline', 'Logical arc of the talk.', [
          'Compelling arc: a clear opening, purposeful sequence, and a conclusion that lands the takeaway.',
          'Logical sequence with a recognizable opening and close.',
          'Sequence is choppy; the audience must work to follow the thread.',
          'No discernible structure.'
        ]),
        c('Delivery', 'Vocal and physical presence.', [
          'Engaging, well-paced delivery; speaks to the audience rather than the slides; handles nerves visibly well.',
          'Clear, audible delivery with occasional reliance on notes.',
          'Delivery is monotone, rushed, or read from notes/slides.',
          'Delivery substantially impairs comprehension.'
        ]),
        c('Visual Support', 'Design and use of slides or other aids.', [
          'Visuals are clean, legible, and genuinely aid understanding; data is presented honestly.',
          'Visuals are legible and support the talk with minor clutter.',
          'Visuals are cluttered, text-heavy, or loosely connected to the talk.',
          'Visuals are missing, illegible, or misleading.'
        ]),
        c('Response to Questions', 'Handling of audience questions and challenges.', [
          'Answers questions accurately and concisely, and can defend or qualify claims under challenge.',
          'Answers most questions accurately.',
          'Answers questions superficially or deflects.',
          'Cannot answer basic questions about the material.'
        ])
      ]
    },
    {
      id: 'lab-report',
      kind: 'template',
      name: 'Lab / technical report (generic)',
      shortName: 'Lab report',
      assignmentTypes: ['lab'],
      description: 'Generic rubric for a laboratory or technical report with data collection and analysis.',
      attribution: 'Original template written for GradeAlign.',
      sourceUrl: '',
      lastChecked: LAST_CHECKED,
      criteria: [
        c('Objective & Hypothesis', 'Clarity of purpose and testable prediction.', [
          'States a precise objective and a testable, justified hypothesis.',
          'States the objective and hypothesis clearly.',
          'Objective is clear but hypothesis is vague or untestable.',
          'Objective and hypothesis are missing or incoherent.'
        ]),
        c('Methods & Procedure', 'Reproducibility and appropriateness of the procedure.', [
          'Procedure is appropriate and described precisely enough to reproduce; controls and variables are identified.',
          'Procedure is appropriate and described with minor omissions.',
          'Procedure is described in outline; key steps, controls, or quantities are missing.',
          'Procedure is missing or would not produce usable data.'
        ]),
        c('Data & Results', 'Quality of data recording and presentation.', [
          'Data is complete, correctly tabulated/graphed with units and uncertainties, and free of manipulation.',
          'Data is complete and presented with minor formatting or labeling faults.',
          'Data is incomplete or presented confusingly; units or labels are unreliable.',
          'Data is missing, fabricated in appearance, or unusable.'
        ]),
        c('Analysis & Interpretation', 'Correctness of calculations and reasoning from data.', [
          'Calculations are correct; results are interpreted against the hypothesis with error sources honestly assessed.',
          'Calculations are mostly correct; interpretation addresses the hypothesis.',
          'Calculation errors or interpretation that sidesteps the hypothesis.',
          'Analysis is absent or contradicts the data.'
        ]),
        c('Conclusions & Limitations', 'Validity of conclusions and acknowledgment of limits.', [
          'Conclusions follow strictly from the data; limitations and improvements are specific and realistic.',
          'Conclusions are supported; limitations noted generally.',
          'Conclusions overreach the data or limitations are perfunctory.',
          'Conclusions are unsupported or absent.'
        ]),
        c('Format & Technical Writing', 'Adherence to report conventions and clarity.', [
          'Follows the required format exactly; technical prose is precise, concise, and error-free.',
          'Follows the format with minor deviations; writing is clear.',
          'Format deviations and writing that occasionally obscures technical meaning.',
          'Ignores the required format; writing impedes technical understanding.'
        ])
      ]
    },
    {
      id: 'reflective-essay',
      kind: 'template',
      name: 'Reflective essay (generic)',
      shortName: 'Reflective essay',
      assignmentTypes: ['reflective'],
      description: 'Generic rubric for a reflective essay connecting experience to learning.',
      attribution: 'Original template written for GradeAlign.',
      sourceUrl: '',
      lastChecked: LAST_CHECKED,
      criteria: [
        c('Description of Experience', 'Concrete, focused account of the experience being reflected upon.', [
          'Reconstructs the experience with well-chosen, concrete detail focused on what matters for the reflection.',
          'Describes the experience clearly with adequate detail.',
          'Describes the experience in general terms; key moments are missing.',
          'Little concrete description; the reader cannot tell what happened.'
        ]),
        c('Depth of Reflection', 'Movement beyond description into examination of assumptions, feelings, and meaning.', [
          'Interrogates assumptions and reactions honestly; articulates what changed in the writer\'s thinking and why.',
          'Examines the experience thoughtfully beyond mere retelling.',
          'Reflection is present but stays close to the surface (likes/dislikes, summary).',
          'Retells events without reflection.'
        ]),
        c('Connection to Concepts', 'Integration of course concepts, readings, or theory.', [
          'Integrates course concepts precisely; uses them to illuminate the experience and vice versa.',
          'Connects the experience to relevant course concepts accurately.',
          'Mentions course concepts without genuinely integrating them.',
          'No connection to course material.'
        ]),
        c('Learning & Forward Application', 'Articulation of what was learned and how it will be applied.', [
          'Articulates specific learning and a credible plan for applying it to future situations.',
          'States what was learned and gestures at future application.',
          'Learning is stated in clichés or without application.',
          'No discernible statement of learning.'
        ]),
        c('Writing Quality', 'Voice, organization, and mechanics appropriate to reflective writing.', [
          'Authentic voice with deliberate structure; mechanics are clean.',
          'Clear voice and structure; minor mechanical errors.',
          'Understandable but loosely organized; errors sometimes distract.',
          'Disorganized; errors impede reading.'
        ])
      ]
    }
  ];

  var STANDARDS = [AACSB_AOL, AACU_VALUE].concat(TEMPLATES);

  /* Map assignment type (from heuristics) → suggested template id. */
  var TYPE_TO_TEMPLATE = {
    research: 'research-paper',
    case: 'case-analysis',
    presentation: 'presentation',
    lab: 'lab-report',
    reflective: 'reflective-essay',
    essay: 'research-paper',
    generic: 'research-paper'
  };

  /* VALUE outcome subsets suggested per assignment type (criterion names
   * within AACU_VALUE.criteria). */
  var VALUE_SUBSETS = {
    research: ['Critical Thinking — Explanation of Issues', 'Critical Thinking — Evidence & Analysis', 'Written Communication — Content & Development', 'Written Communication — Organization & Mechanics', 'Information Literacy', 'Quantitative Literacy'],
    case: ['Critical Thinking — Explanation of Issues', 'Critical Thinking — Evidence & Analysis', 'Ethical Reasoning', 'Written Communication — Content & Development', 'Quantitative Literacy'],
    presentation: ['Oral Communication', 'Critical Thinking — Evidence & Analysis', 'Information Literacy', 'Teamwork & Collaboration'],
    lab: ['Quantitative Literacy', 'Critical Thinking — Evidence & Analysis', 'Information Literacy', 'Written Communication — Organization & Mechanics'],
    reflective: ['Critical Thinking — Explanation of Issues', 'Ethical Reasoning', 'Written Communication — Content & Development', 'Written Communication — Organization & Mechanics'],
    essay: ['Critical Thinking — Explanation of Issues', 'Critical Thinking — Evidence & Analysis', 'Written Communication — Content & Development', 'Written Communication — Organization & Mechanics', 'Information Literacy'],
    generic: AACU_VALUE.criteria.map(function (cr) { return cr.name; })
  };

  function getStandard(id) {
    for (var i = 0; i < STANDARDS.length; i++) { if (STANDARDS[i].id === id) { return STANDARDS[i]; } }
    return null;
  }

  function listStandards() {
    return STANDARDS.map(function (s) {
      return { id: s.id, kind: s.kind, name: s.name, shortName: s.shortName, description: s.description, attribution: s.attribution, sourceUrl: s.sourceUrl, lastChecked: s.lastChecked, criterionCount: s.criteria.length };
    });
  }

  global.GradeAlignStandards = {
    LEVELS: LEVELS,
    STANDARDS: STANDARDS,
    TYPE_TO_TEMPLATE: TYPE_TO_TEMPLATE,
    VALUE_SUBSETS: VALUE_SUBSETS,
    getStandard: getStandard,
    listStandards: listStandards,
    LAST_CHECKED: LAST_CHECKED
  };
})(typeof window !== 'undefined' ? window : globalThis);
