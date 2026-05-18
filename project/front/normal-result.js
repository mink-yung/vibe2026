var replayIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

const normalResultData = {
  subtitle: null,
  score: null,
  tag: null,
  tagClass: '',
  delivery: null,
  content: null,
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

function renderNormalResult(data) {
  const { subtitle, score, tag, tagClass, delivery, content, questions, summary } = data;

  document.getElementById('ns-subtitle').textContent = subtitle ?? '\uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  document.getElementById('ns-score').textContent = score ?? '-';
  const tagEl = document.getElementById('ns-tag');
  tagEl.textContent = tag ?? '';
  tagEl.className = 'score-circle-tag' + (tagClass ? ' ' + tagClass : '');

  const circle = document.getElementById('ns-score-circle');
  if (score != null && circle) {
    const c = 427;
    circle.setAttribute('stroke-dasharray', (c * score) / 100 + ' ' + (c * (1 - score / 100)));
    circle.setAttribute(
      'stroke',
      typeof getScoreStrokeColor === 'function' ? getScoreStrokeColor(score) : '#2f9e44'
    );
  }

  document.getElementById('ns-time').textContent = summary?.time ?? '-';
  document.getElementById('ns-count').textContent = summary?.count ?? '-';
  document.getElementById('ns-avg').textContent = summary?.avg ?? '-';

  if (delivery) {
    document.getElementById('ns-delivery').innerHTML = delivery.map(metricItemHtml).join('');
  }
  if (content) {
    document.getElementById('ns-content').innerHTML = content.map(metricItemHtml).join('');
  }

  if (!questions) return;
  document.getElementById('ns-questions').innerHTML = questions
    .map(function (q, i) {
      return (
        '<div class="record-q-item"><div class="record-q-num">' +
        (i + 1) +
        '</div><div class="record-q-content"><div class="record-q-title">' +
        q.title +
        '</div><div class="record-q-feedback">' +
        q.feedback +
        '</div></div><button type="button" class="replay-btn">' +
        replayIcon +
        ' \ub2f5\ubcc0 \ub2e4\uc2dc \ub4e3\uae30</button></div>'
      );
    })
    .join('');
}

function buildNormalResultFromBasicApi(d) {
  const apiOverall = d.overallScore != null ? Number(d.overallScore) : null;
  const answerText = d.answerText || '';
  const seed = String(d.interviewId || 'basic');
  const metrics = d.metrics || null;

  let deliveryBuilt =
    typeof metricItemsFromScoresApi === 'function' && d.scores
      ? metricItemsFromScoresApi(d.scores)
      : null;
  if (!deliveryBuilt && typeof metricItemsFromDeliveryApi === 'function' && metrics?.delivery) {
    deliveryBuilt = metricItemsFromDeliveryApi(metrics.delivery, BASIC_DELIVERY_DEFS);
  }
  let contentBuilt =
    typeof metricItemsFromContentApi === 'function' && metrics?.content
      ? metricItemsFromContentApi(metrics.content, BASIC_CONTENT_DEFS)
      : null;

  if (!deliveryBuilt && typeof buildMetricDisplayList === 'function') {
    deliveryBuilt = buildMetricDisplayList(BASIC_DELIVERY_DEFS, apiOverall ?? 72, {
      answerText: answerText,
      seed: seed,
    });
  }
  if (!contentBuilt && typeof buildMetricDisplayList === 'function') {
    contentBuilt = buildMetricDisplayList(BASIC_CONTENT_DEFS, apiOverall ?? 72, {
      answerText: answerText,
      seed: seed + '-content',
    });
  }
  if (!deliveryBuilt) deliveryBuilt = { items: [], average: null };
  if (!contentBuilt) contentBuilt = { items: [], average: null };

  const allScores = deliveryBuilt.items
    .concat(contentBuilt.items)
    .map(function (m) {
      return m.score;
    });
  const score =
    typeof averageScores === 'function'
      ? averageScores(allScores)
      : apiOverall;
  const tag = score != null ? getScoreMent(score) : '';
  const tagClass = score != null ? getTagClass(score) : '';

  const fd = d.feedbackDetail || {};
  const questions = [];
  if (Array.isArray(d.questionRecords) && d.questionRecords.length) {
    d.questionRecords.forEach(function (r, i) {
      questions.push({
        title: 'Q' + (i + 1) + '. ' + (r.question || '\uc9c8\ubb38'),
        feedback: r.answer || r.feedback || '',
      });
    });
  } else {
    questions.push({
      title: d.questionText || '\uc9c8\ubb38',
      feedback: d.feedback || d.summary || fd.overall || '',
    });
  }

  let subtitle = '\uae30\ubcf8 \uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  if (d.elapsedMs && typeof formatDurationMs === 'function') {
    subtitle =
      '\ucd1d ' + formatDurationMs(d.elapsedMs) + '\uc5d0 \uba74\uc811\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.';
  }

  return {
    subtitle: subtitle,
    score: score,
    tag: tag,
    tagClass: tagClass,
    delivery: deliveryBuilt.items,
    content: contentBuilt.items,
    questions: questions,
    summary: formatSummaryFromSession({
      elapsedMs: d.elapsedMs,
      questionCount: d.questionCount || 5,
      questions: d.questionRecords,
    }),
  };
}

(function initNormalResultFromSession() {
  const raw = sessionStorage.getItem('normalInterviewLastResult');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      sessionStorage.removeItem('normalInterviewLastResult');
      renderNormalResult(buildNormalResultFromBasicApi(parsed));
      return;
    } catch (_) {
      sessionStorage.removeItem('normalInterviewLastResult');
    }
  }
  renderNormalResult(normalResultData);
})();
