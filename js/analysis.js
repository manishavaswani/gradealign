/* GradeAlign — js/analysis.js
 * Deviation analysis: pure statistics, SVG chart builders, plain-language
 * interpretation, CSV builders, and the .docx report. All math runs in Node
 * for the smoke tests; docx/SVG helpers need a browser only for PNG
 * rasterization of charts (docx falls back gracefully).
 *
 * Conventions:
 *   - deviation      = rubricScore − professorGrade  (positive ⇒ rubric/AI higher)
 *   - std dev        = population standard deviation (divide by n)
 *   - Pearson r      = sample Pearson product-moment correlation coefficient
 * Exposed as window.GradeAlignAnalysis / globalThis.GradeAlignAnalysis.
 */
(function (global) {
  'use strict';

  /* ------------------------------- statistics ------------------------------- */

  function mean(xs) {
    if (!xs.length) { return null; }
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  }

  /* Population standard deviation. */
  function stdDev(xs) {
    if (!xs.length) { return null; }
    var m = mean(xs);
    var v = xs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / xs.length;
    return Math.sqrt(v);
  }

  /* Pearson product-moment correlation; null if undefined (n<2 or zero variance). */
  function pearson(xs, ys) {
    if (xs.length !== ys.length || xs.length < 2) { return null; }
    var mx = mean(xs), my = mean(ys);
    var sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < xs.length; i++) {
      var dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx === 0 || syy === 0) { return null; }
    return sxy / Math.sqrt(sxx * syy);
  }

  function round1(x) { return x == null ? null : Math.round(x * 10) / 10; }
  function round2(x) { return x == null ? null : Math.round(x * 100) / 100; }

  /* Build the full deviation analysis.
   * papers: [{id, label, professorGrade, rubricScore, scores:{criterionId:{score}}}]
   * rubric: rubric object; settings: {maxPoints, thresholdPct}            */
  function computeAnalysis(papers, rubric, settings) {
    var maxPoints = settings.maxPoints || 100;
    var thresholdPct = settings.thresholdPct != null ? settings.thresholdPct : 10;
    var rows = [];
    papers.forEach(function (p) {
      if (p.professorGrade == null || p.rubricScore == null) { return; }
      var dev = p.rubricScore - p.professorGrade;
      var devPct = (dev / maxPoints) * 100;
      rows.push({
        id: p.id,
        label: p.label,
        professorGrade: p.professorGrade,
        rubricScore: p.rubricScore,
        deviation: dev,
        deviationPct: devPct,
        flagged: Math.abs(devPct) > thresholdPct,
        scores: p.scores || {}
      });
    });
    var devs = rows.map(function (r) { return r.deviation; });
    var absDevs = devs.map(Math.abs);
    var prof = rows.map(function (r) { return r.professorGrade; });
    var rub = rows.map(function (r) { return r.rubricScore; });

    /* Per-criterion averages + correlation of each criterion's score with
     * the signed deviation (where deviation concentrates). */
    var criteriaStats = rubric.criteria.map(function (cr) {
      var vals = [], withDev = [];
      rows.forEach(function (r) {
        var e = r.scores[cr.id];
        if (e && e.score != null) {
          vals.push(e.score);
          withDev.push({ score: e.score, deviation: r.deviation });
        }
      });
      var corr = null;
      if (withDev.length >= 2) {
        corr = pearson(withDev.map(function (w) { return w.score; }), withDev.map(function (w) { return w.deviation; }));
      }
      return {
        id: cr.id,
        name: cr.name,
        weight: cr.weight,
        meanScore: mean(vals),
        n: vals.length,
        deviationCorrelation: corr
      };
    });

    var meanDev = mean(devs);
    return {
      rows: rows,
      n: rows.length,
      thresholdPct: thresholdPct,
      maxPoints: maxPoints,
      meanDeviation: meanDev,
      meanAbsoluteDeviation: mean(absDevs),
      stdDeviation: stdDev(devs),
      pearson: pearson(prof, rub),
      flaggedCount: rows.filter(function (r) { return r.flagged; }).length,
      criteriaStats: criteriaStats,
      biasDirection: meanDev == null ? null : (Math.abs(meanDev) < 0.05 ? 'none' : (meanDev > 0 ? 'higher' : 'lower'))
    };
  }

  /* --------------------------- interpretation text --------------------------- */

  function consistencyLabel(analysis) {
    var r = analysis.pearson;
    var madPct = analysis.meanAbsoluteDeviation == null ? null : (analysis.meanAbsoluteDeviation / analysis.maxPoints) * 100;
    if (analysis.n < 2) { return 'insufficient data'; }
    var score = 0;
    if (r != null) { score += r >= 0.9 ? 2 : r >= 0.7 ? 1 : 0; }
    if (madPct != null) { score += madPct <= 5 ? 2 : madPct <= 10 ? 1 : 0; }
    return score >= 4 ? 'high' : score >= 2 ? 'moderate' : 'low';
  }

  function interpret(analysis, scoreSource) {
    if (!analysis.n) { return ['No papers have both a professor grade and a rubric score yet.']; }
    var who = scoreSource === 'ai' ? 'AI' : 'rubric';
    var out = [];
    var label = consistencyLabel(analysis);
    out.push('Overall consistency between professor grades and ' + who + ' scores is ' + label.toUpperCase() +
      ' across ' + analysis.n + ' paper' + (analysis.n === 1 ? '' : 's') + '.');

    if (analysis.pearson != null) {
      out.push('Pearson correlation r = ' + round2(analysis.pearson) + ' — ' +
        (analysis.pearson >= 0.9 ? 'the two orderings agree very strongly.' :
         analysis.pearson >= 0.7 ? 'the two orderings largely agree, with some rank shuffling.' :
         analysis.pearson >= 0.4 ? 'only moderate agreement in how the two rank the papers.' :
         'little agreement in how the two rank the papers — review the rubric or the grading.'));
    } else {
      out.push('Pearson correlation is undefined here (need at least 2 papers with variance in both score sets).');
    }

    if (analysis.meanDeviation != null) {
      var d = round1(analysis.meanDeviation);
      if (Math.abs(d) < 0.05) {
        out.push('No systematic bias: ' + who + ' scores average level with professor grades.');
      } else {
        out.push('Bias: ' + who + ' scores average ' + Math.abs(d) + ' pts ' +
          (d > 0 ? 'higher' : 'lower') + ' than professor grades (on ' + analysis.maxPoints + ' pts).');
      }
      out.push('Mean absolute deviation is ' + round1(analysis.meanAbsoluteDeviation) + ' pts (' +
        round1((analysis.meanAbsoluteDeviation / analysis.maxPoints) * 100) + '%), standard deviation of deviations ' +
        round1(analysis.stdDeviation) + ' pts.');
    }

    out.push(analysis.flaggedCount + ' of ' + analysis.n + ' papers exceed the |deviation| threshold of ' +
      analysis.thresholdPct + '%.');

    /* Where deviation concentrates */
    var ranked = analysis.criteriaStats
      .filter(function (cs) { return cs.deviationCorrelation != null && cs.n >= 2; })
      .sort(function (a, b) { return Math.abs(b.deviationCorrelation) - Math.abs(a.deviationCorrelation); });
    if (ranked.length) {
      var top = ranked[0];
      var dir = top.deviationCorrelation > 0
        ? 'higher ' + who + ' scores on this criterion track larger positive deviations'
        : 'lower ' + who + ' scores on this criterion track larger deviations';
      out.push('Deviation concentrates most in "' + top.name + '" (|r| = ' +
        round2(Math.abs(top.deviationCorrelation)) + '): ' + dir + '. This criterion is the first place to calibrate.');
      if (ranked.length > 1 && Math.abs(ranked[1].deviationCorrelation) >= 0.4) {
        out.push('Next: "' + ranked[1].name + '" (|r| = ' + round2(Math.abs(ranked[1].deviationCorrelation)) + ').');
      }
    } else {
      var weakest = analysis.criteriaStats.filter(function (cs) { return cs.meanScore != null; })
        .sort(function (a, b) { return a.meanScore - b.meanScore; })[0];
      if (weakest) {
        out.push('Lowest average ' + who + ' criterion score: "' + weakest.name + '" (' +
          round2(weakest.meanScore) + ' of 4).');
      }
    }
    return out;
  }

  /* -------------------------------- SVG charts -------------------------------- */

  var SVG_INK = '#35302a', SVG_SOFT = '#6b6357', SVG_LINE = '#e2d9c9',
      SVG_ACCENT = '#a4543a', SVG_OK = '#5c7351', SVG_BAD = '#9c4a3c';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Scatter: professor grade (x) vs rubric/AI score (y), dashed y=x line. */
  function scatterSvg(analysis, opts) {
    opts = opts || {};
    var W = opts.width || 520, H = opts.height || 400;
    var padL = 54, padR = 18, padT = 18, padB = 48;
    var iw = W - padL - padR, ih = H - padT - padB;
    var max = analysis.maxPoints;
    function X(v) { return padL + (v / max) * iw; }
    function Y(v) { return padT + ih - (v / max) * ih; }
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter plot of professor grades versus rubric scores">');
    parts.push('<rect width="' + W + '" height="' + H + '" fill="#fffdf8"/>');
    // gridlines + ticks at 0,25,50,75,100% of max
    for (var t = 0; t <= 4; t++) {
      var v = (max * t) / 4;
      parts.push('<line x1="' + X(v) + '" y1="' + padT + '" x2="' + X(v) + '" y2="' + (padT + ih) + '" stroke="' + SVG_LINE + '" stroke-width="1"/>');
      parts.push('<line x1="' + padL + '" y1="' + Y(v) + '" x2="' + (padL + iw) + '" y2="' + Y(v) + '" stroke="' + SVG_LINE + '" stroke-width="1"/>');
      parts.push('<text x="' + X(v) + '" y="' + (H - padB + 16) + '" text-anchor="middle" font-size="11" fill="' + SVG_SOFT + '" font-family="sans-serif">' + v + '</text>');
      parts.push('<text x="' + (padL - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="' + SVG_SOFT + '" font-family="sans-serif">' + v + '</text>');
    }
    // axes
    parts.push('<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (padL + iw) + '" y2="' + (padT + ih) + '" stroke="' + SVG_INK + '" stroke-width="1.5"/>');
    parts.push('<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + ih) + '" stroke="' + SVG_INK + '" stroke-width="1.5"/>');
    // y = x reference
    parts.push('<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(max) + '" y2="' + Y(max) + '" stroke="' + SVG_SOFT + '" stroke-width="1.5" stroke-dasharray="6 5"/>');
    parts.push('<text x="' + (X(max) - 6) + '" y="' + (Y(max) + 16) + '" text-anchor="end" font-size="11" fill="' + SVG_SOFT + '" font-family="sans-serif" font-style="italic">y = x (perfect agreement)</text>');
    // points
    analysis.rows.forEach(function (r) {
      var color = r.flagged ? SVG_BAD : SVG_ACCENT;
      parts.push('<circle cx="' + X(r.professorGrade).toFixed(1) + '" cy="' + Y(r.rubricScore).toFixed(1) + '" r="6" fill="' + color + '" fill-opacity="0.82" stroke="#fffdf8" stroke-width="1"><title>' + esc(r.label) + ': professor ' + round1(r.professorGrade) + ', rubric ' + round1(r.rubricScore) + ' (dev ' + (r.deviation >= 0 ? '+' : '') + round1(r.deviation) + ')</title></circle>');
    });
    // axis labels
    parts.push('<text x="' + (padL + iw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="12" fill="' + SVG_INK + '" font-family="sans-serif">Professor grade</text>');
    parts.push('<text x="14" y="' + (padT + ih / 2) + '" text-anchor="middle" font-size="12" fill="' + SVG_INK + '" font-family="sans-serif" transform="rotate(-90 14 ' + (padT + ih / 2) + ')">Rubric / AI score</text>');
    parts.push('</svg>');
    return parts.join('');
  }

  /* Per-criterion bars: average rubric/AI level (1–4) per criterion. */
  function criterionBarsSvg(analysis, opts) {
    opts = opts || {};
    var stats = analysis.criteriaStats.filter(function (cs) { return cs.meanScore != null; });
    var barH = 26, gap = 10, padL = 190, padR = 46, padT = 14, padB = 30;
    var W = opts.width || 560;
    var H = padT + padB + stats.length * (barH + gap);
    var iw = W - padL - padR;
    function X(v) { return padL + (v / 4) * iw; }
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Average rubric score per criterion">');
    parts.push('<rect width="' + W + '" height="' + H + '" fill="#fffdf8"/>');
    for (var t = 0; t <= 4; t++) {
      parts.push('<line x1="' + X(t) + '" y1="' + padT + '" x2="' + X(t) + '" y2="' + (H - padB) + '" stroke="' + SVG_LINE + '" stroke-width="1"/>');
      parts.push('<text x="' + X(t) + '" y="' + (H - padB + 16) + '" text-anchor="middle" font-size="11" fill="' + SVG_SOFT + '" font-family="sans-serif">' + t + '</text>');
    }
    stats.forEach(function (cs, i) {
      var y = padT + i * (barH + gap);
      var w = X(cs.meanScore) - padL;
      var hot = cs.deviationCorrelation != null && Math.abs(cs.deviationCorrelation) >= 0.5 && stats.length > 1;
      var label = cs.name.length > 26 ? cs.name.slice(0, 24) + '…' : cs.name;
      parts.push('<text x="' + (padL - 8) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end" font-size="12" fill="' + SVG_INK + '" font-family="sans-serif">' + esc(label) + '</text>');
      parts.push('<rect x="' + padL + '" y="' + y + '" width="' + Math.max(1, w).toFixed(1) + '" height="' + barH + '" fill="' + (hot ? SVG_BAD : SVG_OK) + '" fill-opacity="0.85"><title>' + esc(cs.name) + ': mean ' + round2(cs.meanScore) + ' of 4 across ' + cs.n + ' papers' + (cs.deviationCorrelation != null ? '; deviation |r| = ' + round2(Math.abs(cs.deviationCorrelation)) : '') + '</title></rect>');
      parts.push('<text x="' + (padL + Math.max(1, w) + 6) + '" y="' + (y + barH / 2 + 4) + '" font-size="11" fill="' + SVG_SOFT + '" font-family="sans-serif">' + round2(cs.meanScore) + '</text>');
    });
    parts.push('<text x="' + (padL + iw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="12" fill="' + SVG_INK + '" font-family="sans-serif">Average criterion score (1–4); red = criterion most correlated with deviation</text>');
    parts.push('</svg>');
    return parts.join('');
  }

  /* Rasterize an SVG string to a PNG ArrayBuffer (browser only). */
  function svgToPngArrayBuffer(svgString, width, height) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = width * 2; canvas.height = height * 2; // 2x for legibility
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fffdf8';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('Canvas export failed')); return; }
            blob.arrayBuffer().then(resolve, reject);
          }, 'image/png');
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('SVG rasterization failed')); };
      img.src = url;
    });
  }

  /* --------------------------------- CSV builders --------------------------------- */

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function scoresCsv(analysis, rubric) {
    var head = ['paper', 'professor_grade', 'rubric_score', 'deviation_pts', 'deviation_pct', 'flagged']
      .concat(rubric.criteria.map(function (cr) { return 'criterion: ' + cr.name; }));
    var lines = [head.map(csvCell).join(',')];
    analysis.rows.forEach(function (r) {
      var row = [r.label, r.professorGrade, round2(r.rubricScore), round2(r.deviation), round2(r.deviationPct), r.flagged ? 'yes' : 'no'];
      rubric.criteria.forEach(function (cr) {
        var e = r.scores[cr.id];
        row.push(e && e.score != null ? e.score : '');
      });
      lines.push(row.map(csvCell).join(','));
    });
    return lines.join('\r\n');
  }

  /* ------------------------------- docx report ------------------------------- */

  function buildReportDocx(analysis, rubric, meta, chartPngs) {
    var Rubric = global.GradeAlignRubric;
    return Rubric.loadDocx().then(function (dx) {
      var children = [];
      function p(text, opts) { return new dx.Paragraph(Object.assign({ children: [new dx.TextRun(typeof text === 'string' ? { text: text } : text)] }, opts || {})); }

      children.push(p('GradeAlign — Grading Consistency Report', { heading: dx.HeadingLevel.HEADING_1 }));
      var metaBits = [];
      if (meta && meta.generatedAt) { metaBits.push('Generated ' + meta.generatedAt); }
      if (meta && meta.scoreSource) { metaBits.push('Scores: ' + meta.scoreSource); }
      metaBits.push('Standard: ' + rubric.standardName);
      metaBits.push(rubric.attribution || '');
      metaBits.filter(Boolean).forEach(function (m) {
        children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: m, size: 18, color: '6b6357' })] }));
      });

      children.push(p('Summary statistics', { heading: dx.HeadingLevel.HEADING_2 }));
      [
        ['Papers compared', String(analysis.n)],
        ['Mean deviation (rubric − professor)', round1(analysis.meanDeviation) + ' pts'],
        ['Mean absolute deviation', round1(analysis.meanAbsoluteDeviation) + ' pts (' + round1(analysis.meanAbsoluteDeviation == null ? null : analysis.meanAbsoluteDeviation / analysis.maxPoints * 100) + '%)'],
        ['Std deviation of deviations', round1(analysis.stdDeviation) + ' pts'],
        ['Pearson correlation', analysis.pearson == null ? 'undefined' : String(round2(analysis.pearson))],
        ['Flagged (|dev| > ' + analysis.thresholdPct + '%)', analysis.flaggedCount + ' of ' + analysis.n],
        ['Consistency', consistencyLabel(analysis).toUpperCase()]
      ].forEach(function (kv) {
        children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: kv[0] + ': ', bold: true }), new dx.TextRun(kv[1])] }));
      });

      children.push(p('Interpretation', { heading: dx.HeadingLevel.HEADING_2 }));
      interpret(analysis, meta && meta.scoreSource).forEach(function (line) {
        children.push(new dx.Paragraph({ children: [new dx.TextRun(line)], bullet: { level: 0 } }));
      });

      children.push(p('Per-paper deviations', { heading: dx.HeadingLevel.HEADING_2 }));
      var head = ['Paper', 'Professor', 'Rubric/AI', 'Deviation (pts)', 'Deviation (%)', 'Flag'];
      var rows = [new dx.TableRow({
        children: head.map(function (h) { return new dx.TableCell({ children: [new dx.Paragraph({ children: [new dx.TextRun({ text: h, bold: true })] })] }); }),
        tableHeader: true
      })];
      analysis.rows.forEach(function (r) {
        rows.push(new dx.TableRow({
          children: [r.label, round1(r.professorGrade), round1(r.rubricScore), (r.deviation >= 0 ? '+' : '') + round1(r.deviation), (r.deviationPct >= 0 ? '+' : '') + round1(r.deviationPct) + '%', r.flagged ? 'FLAGGED' : '']
            .map(function (v) { return new dx.TableCell({ children: [new dx.Paragraph({ children: [new dx.TextRun(String(v))] })] }); })
        }));
      });
      children.push(new dx.Table({ rows: rows, width: { size: 100, type: dx.WidthType.PERCENTAGE } }));

      children.push(p('Per-criterion averages', { heading: dx.HeadingLevel.HEADING_2 }));
      var crow = [new dx.TableRow({
        children: ['Criterion', 'Weight', 'Mean score (1–4)', 'Deviation |r|'].map(function (h) {
          return new dx.TableCell({ children: [new dx.Paragraph({ children: [new dx.TextRun({ text: h, bold: true })] })] });
        }), tableHeader: true
      })];
      analysis.criteriaStats.forEach(function (cs) {
        crow.push(new dx.TableRow({
          children: [cs.name, cs.weight + '%', cs.meanScore == null ? '—' : String(round2(cs.meanScore)), cs.deviationCorrelation == null ? '—' : String(round2(Math.abs(cs.deviationCorrelation)))]
            .map(function (v) { return new dx.TableCell({ children: [new dx.Paragraph({ children: [new dx.TextRun(String(v))] })] }); })
        }));
      });
      children.push(new dx.Table({ rows: crow, width: { size: 100, type: dx.WidthType.PERCENTAGE } }));

      if (chartPngs && chartPngs.scatter) {
        children.push(p('Charts', { heading: dx.HeadingLevel.HEADING_2 }));
        children.push(p('Professor grade vs rubric/AI score (dashed line = perfect agreement)'));
        children.push(new dx.Paragraph({ children: [new dx.ImageRun({ data: chartPngs.scatter, transformation: { width: 480, height: 369 }, type: 'png' })] }));
        if (chartPngs.bars) {
          children.push(p('Average rubric/AI score per criterion'));
          children.push(new dx.Paragraph({ children: [new dx.ImageRun({ data: chartPngs.bars, transformation: { width: 500, height: Math.round(500 * chartPngs.barsRatio) }, type: 'png' })] }));
        }
      } else {
        children.push(p('Charts', { heading: dx.HeadingLevel.HEADING_2 }));
        children.push(p('(Charts are available in the on-screen report; image embedding was unavailable in this environment.)'));
      }

      children.push(p('Rubric', { heading: dx.HeadingLevel.HEADING_2 }));
      rubric.criteria.forEach(function (cr, i) {
        children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: (i + 1) + '. ' + cr.name + ' (' + cr.weight + '%)', bold: true })] }));
        rubric.levels.forEach(function (l) {
          children.push(new dx.Paragraph({ children: [new dx.TextRun({ text: l.name + ': ', italics: true }), new dx.TextRun({ text: cr.descriptors[l.key] || '', size: 20 })], bullet: { level: 0 } }));
        });
      });

      var doc = new dx.Document({ creator: 'GradeAlign', title: 'GradeAlign consistency report', sections: [{ children: children }] });
      return dx.Packer.toBlob(doc);
    });
  }

  global.GradeAlignAnalysis = {
    mean: mean,
    stdDev: stdDev,
    pearson: pearson,
    round1: round1,
    round2: round2,
    computeAnalysis: computeAnalysis,
    consistencyLabel: consistencyLabel,
    interpret: interpret,
    scatterSvg: scatterSvg,
    criterionBarsSvg: criterionBarsSvg,
    svgToPngArrayBuffer: svgToPngArrayBuffer,
    scoresCsv: scoresCsv,
    csvCell: csvCell,
    buildReportDocx: buildReportDocx
  };
})(typeof window !== 'undefined' ? window : globalThis);
