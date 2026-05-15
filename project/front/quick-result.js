var replayIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

const quickResultData = {
  subtitle: null,
  score: null,
  tag: null,
  tagClass: '',
  metrics: null,
  questions: null,
  summary: { time: null, count: null, avg: null },
};

function metricItemHtml(m) {
  return (
    '<div class="metric-item">' +
    '<div class="metric-icon-wrap ' +
    m.color +
    '">' +
    m.icon +
    '</div>' +
    '<div class="metric-name">' +
    m.name +
    '</div>' +
    '<div class="metric-score ' +
    (m.scoreClass || '') +
    '">' +
    m.score +
    '<span>/100</span></div>' +
    '<div class="metric-desc">' +
    (m.desc || '') +
    '</div></div>'
  );
}

function renderQuickResult(data) {
  const { subtitle, score, tag, tagClass, metrics, questions, summary } = data;

  document.getElementById('qs-subtitle').textContent = subtitle ?? '\uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  document.getElementById('qs-score').textContent = score ?? '-';
  const tagEl = document.getElementById('qs-tag');
  tagEl.textContent = tag ?? '';
  tagEl.className = 'score-circle-tag' + (tagClass ? ' ' + tagClass : '');

  const circle = document.getElementById('qs-score-circle');
  if (score != null && circle) {
    const c = 427;
    circle.setAttribute(
      'stroke-dasharray',
      (c * score) / 100 + ' ' + (c * (1 - score / 100))
    );
    circle.setAttribute(
      'stroke',
      typeof getScoreStrokeColor === 'function' ? getScoreStrokeColor(score) : '#2f9e44'
    );
  }

  document.getElementById('qs-time').textContent = summary?.time ?? '-';
  document.getElementById('qs-count').textContent = summary?.count ?? '-';
  document.getElementById('qs-avg').textContent = summary?.avg ?? '-';

  if (metrics) {
    document.getElementById('qs-metrics').innerHTML = metrics.map(metricItemHtml).join('');
  }

  if (!questions) return;
  document.getElementById('qs-questions').innerHTML = questions
    .map(function (q, i) {
      return (
        '<div class="record-q-item">' +
        '<div class="record-q-num">' +
        (i + 1) +
        '</div>' +
        '<div class="record-q-content">' +
        '<div class="record-q-title">' +
        q.title +
        '</div>' +
        '<div class="record-q-feedback">' +
        q.feedback +
        '</div></div>' +
        '<button type="button" class="replay-btn">' +
        replayIcon +
        ' \ub2f5\ubcc0 \ub2e4\uc2dc \ub4e3\uae30</button></div>'
      );
    })
    .join('');
}

function buildQuickResultFromApiPayload(p) {
  const apiOverall = p.overallScore != null ? Number(p.overallScore) : null;
  const answerText = p.answerText || p.transcript || '';
  const built =
    typeof buildMetricDisplayList === 'function'
      ? buildMetricDisplayList(QUICK_METRIC_DEFS, apiOverall ?? 72, {
          answerText: answerText,
          seed: String(p.interviewId || 'quick'),
        })
      : { items: [], average: apiOverall };

  const score = built.average != null ? built.average : apiOverall;
  const tag = score != null ? getScoreMent(score) : '';
  const tagClass = score != null ? getTagClass(score) : '';

  const qs = [];
  if (Array.isArray(p.questionRecords) && p.questionRecords.length) {
    p.questionRecords.forEach(function (r, i) {
      qs.push({
        title: r.question || '\uc9c8\ubb38 ' + (i + 1),
        feedback: r.answer || r.feedback || '',
      });
    });
  } else {
    if (p.feedback) qs.push({ title: 'AI \ud53c\ub4dc\ubc31', feedback: String(p.feedback) });
    if (p.summary) qs.push({ title: '\uc694\uc57d', feedback: String(p.summary) });
  }

  const isAudio = p.mode === 'quick_audio';
  let subtitle = isAudio
    ? '\uc74c\uc131 \ube60\ub978\uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.'
    : '\ube60\ub978\uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  if (p.elapsedMs && typeof formatDurationMs === 'function') {
    subtitle =
      '\ucd1d ' + formatDurationMs(p.elapsedMs) + '\uc5d0 \uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  }

  return {
    subtitle: subtitle,
    score: score,
    tag: tag,
    tagClass: tagClass,
    metrics: built.items,
    questions: qs.length ? qs : null,
    summary: formatSummaryFromSession({
      elapsedMs: p.elapsedMs,
      questionCount: p.questionCount || (isAudio ? 3 : null),
      questions: p.questionRecords,
    }),
  };
}

(function initQuickResultFromSession() {
  const raw = sessionStorage.getItem('quickInterviewLastResult');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      sessionStorage.removeItem('quickInterviewLastResult');
      renderQuickResult(buildQuickResultFromApiPayload(parsed));
      return;
    } catch (_) {
      sessionStorage.removeItem('quickInterviewLastResult');
    }
  }
  renderQuickResult(quickResultData);
})();
