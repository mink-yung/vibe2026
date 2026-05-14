var replayIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// API에서 받아온 데이터를 여기에 채우면 됩니다
const quickResultData = {
  subtitle: null,       // 예: '총 4분 58초에 면접을 완료했습니다.'
  score: null,          // 예: 86
  tag: null,            // 예: '잘했어요!'
  metrics: null,        // 예: [{ icon:'⏱', color:'yellow', name:'말하기속도', score:79, desc:'...' }, ...]
  questions: null,      // 예: [{ title:'자기소개를 해주세요.', feedback:'...' }, ...]
  summary: {
    time: null,         // 예: '04:58'
    count: null,        // 예: '3개'
    avg: null,          // 예: '01:39'
  },
};

function renderQuickResult(data) {
  const { subtitle, score, tag, metrics, questions, summary } = data;

  document.getElementById('qs-subtitle').textContent = subtitle ?? '면접을 완료했습니다.';
  document.getElementById('qs-score').textContent = score ?? '-';
  document.getElementById('qs-tag').textContent = tag ?? '';
  if (score != null) {
    const c = 427;
    document.getElementById('qs-score-circle').setAttribute('stroke-dasharray', `${(c * score / 100).toFixed(1)} ${(c * (1 - score / 100)).toFixed(1)}`);
  }
  document.getElementById('qs-time').textContent = summary?.time ?? '-';
  document.getElementById('qs-count').textContent = summary?.count ?? '-';
  document.getElementById('qs-avg').textContent = summary?.avg ?? '-';

  if (metrics) {
    document.getElementById('qs-metrics').innerHTML = metrics.map(m => `
      <div class="metric-item">
        <div class="metric-icon-wrap ${m.color}">${m.icon}</div>
        <div class="metric-name">${m.name}</div>
        <div class="metric-score">${m.score}<span>/100</span></div>
        <div class="metric-desc">${m.desc}</div>
      </div>`).join('');
  }

  if (!questions) return;
  document.getElementById('qs-questions').innerHTML = questions.map((q, i) => `
    <div class="record-q-item">
      <div class="record-q-num">${i + 1}</div>
      <div class="record-q-content">
        <div class="record-q-title">${q.title}</div>
        <div class="record-q-feedback">${q.feedback}</div>
      </div>
      <button class="replay-btn">${replayIcon} 답변 다시 듣기</button>
    </div>`).join('');
}

renderQuickResult(quickResultData);
