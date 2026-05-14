var replayIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// API에서 받아온 데이터를 여기에 채우면 됩니다
const normalResultData = {
  subtitle: null,       // 예: '총 14분 22초에 면접을 완료했습니다.'
  score: null,          // 예: 83
  tag: null,            // 예: '잘했어요!'
  delivery: null,       // 예: [{ icon:'😊', color:'green', name:'표정', score:86, desc:'...' }, ...]
  content: null,        // 예: [{ icon:'💬', color:'blue', name:'의사소통', score:85, desc:'...' }, ...]
  questions: null,      // 예: [{ title:'자기소개를 해주세요.', feedback:'...' }, ...]
  summary: {
    time: null,         // 예: '14:22'
    count: null,        // 예: '5개'
    avg: null,          // 예: '02:52'
  },
};

function renderNormalResult(data) {
  const { subtitle, score, tag, delivery, content, questions, summary } = data;

  document.getElementById('ns-subtitle').textContent = subtitle ?? '면접을 완료했습니다.';
  document.getElementById('ns-score').textContent = score ?? '-';
  document.getElementById('ns-tag').textContent = tag ?? '';
  if (score != null) {
    const c = 427;
    document.getElementById('ns-score-circle').setAttribute('stroke-dasharray', `${(c * score / 100).toFixed(1)} ${(c * (1 - score / 100)).toFixed(1)}`);
  }
  document.getElementById('ns-time').textContent = summary?.time ?? '-';
  document.getElementById('ns-count').textContent = summary?.count ?? '-';
  document.getElementById('ns-avg').textContent = summary?.avg ?? '-';

  const metricHTML = (m) => `
    <div class="metric-item">
      <div class="metric-icon-wrap ${m.color}">${m.icon}</div>
      <div class="metric-name">${m.name}</div>
      <div class="metric-score">${m.score}<span>/100</span></div>
      <div class="metric-desc">${m.desc}</div>
    </div>`;

  if (delivery) {
    document.getElementById('ns-delivery').innerHTML = delivery.map(metricHTML).join('');
  }
  if (content) {
    document.getElementById('ns-content').innerHTML = content.map(metricHTML).join('');
  }

  if (!questions) return;
  document.getElementById('ns-questions').innerHTML = questions.map((q, i) => `
    <div class="record-q-item">
      <div class="record-q-num">${i + 1}</div>
      <div class="record-q-content">
        <div class="record-q-title">${q.title}</div>
        <div class="record-q-feedback">${q.feedback}</div>
      </div>
      <button class="replay-btn">${replayIcon} 답변 다시 듣기</button>
    </div>`).join('');
}

function buildNormalResultFromBasicApi(d) {
  const score = d.overallScore != null ? Number(d.overallScore) : null;
  return {
    subtitle: d.summary ? String(d.summary) : '기본 면접 결과가 저장되었습니다.',
    score: Number.isNaN(score) ? null : score,
    tag: score != null && score >= 80 ? '잘했어요!' : score != null ? '계속 연습해 보세요' : '',
    delivery: null,
    content: null,
    questions: [{ title: d.questionText || '질문', feedback: d.feedback || d.summary || '' }],
    summary: { time: '-', count: '-', avg: '-' },
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
