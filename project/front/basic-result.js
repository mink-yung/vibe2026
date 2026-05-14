var replayIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// API에서 받아온 데이터를 여기에 채우면 됩니다
const basicResultData = {
  subtitle: null,       // 예: '총 4분 58초에 면접을 완료했습니다.'
  radar1: {
    labels: null,       // 예: ['의사소통','직무역량','자신감','논리적사고','문제해결력']
    values: null,       // 예: [9, 9, 9, 9, 9]  (0~10)
    scores: null,       // 예: ['9/10', '9/10', ...]
  },
  radar2: {
    labels: null,       // 예: ['표정','시선','자세 안정성','억양','말하기 속도']
    values: null,       // 예: [10, 9, 8, 10, 10]
    scores: null,       // 예: ['10/10', '9/10', ...]
  },
  feedback: {
    summary: null,      // 예: '전반적으로 논리적인 답변을 잘 구성했습니다.'
    strengths: null,    // 예: [{ title:'명확한 의사 표현', desc:'...' }, ...]
    weaknesses: null,   // 예: [{ title:'답변 구체성 부족', desc:'...' }, ...]
    recommends: null,   // 예: [{ title:'STAR 기법으로 답변 구성하기' }, ...]
  },
  questions: null,      // 예: [{ title:'자기소개를 해주세요.', feedback:'...' }, ...]
  summary: {
    time: null,         // 예: '04:58'
    count: null,        // 예: '3개'
    avg: null,          // 예: '01:39'
  },
};

function drawRadarChart(svgId, cx, cy, maxR, labels, values, scores, maxVal) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';
  const n = labels.length;
  const levels = 5;
  const ns = 'http://www.w3.org/2000/svg';

  function angle(i) { return (Math.PI * 2 * i / n) - Math.PI / 2; }
  function point(r, i) { return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) }; }
  function toPoints(pts) { return pts.map(p => `${p.x},${p.y}`).join(' '); }

  for (let lv = 1; lv <= levels; lv++) {
    const pts = Array.from({length: n}, (_, i) => point(maxR * lv / levels, i));
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', toPoints(pts));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#e9ecef');
    poly.setAttribute('stroke-width', '1');
    svg.appendChild(poly);
  }

  for (let i = 0; i < n; i++) {
    const p = point(maxR, i);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', cx); line.setAttribute('y1', cy);
    line.setAttribute('x2', p.x); line.setAttribute('y2', p.y);
    line.setAttribute('stroke', '#e9ecef'); line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  }

  const dataPts = values.map((v, i) => point(maxR * v / maxVal, i));
  const dataPoly = document.createElementNS(ns, 'polygon');
  dataPoly.setAttribute('points', toPoints(dataPts));
  dataPoly.setAttribute('fill', 'rgba(116,192,252,0.25)');
  dataPoly.setAttribute('stroke', '#74c0fc');
  dataPoly.setAttribute('stroke-width', '2');
  svg.appendChild(dataPoly);

  dataPts.forEach(p => {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '3'); circle.setAttribute('fill', '#74c0fc');
    svg.appendChild(circle);
  });

  labels.forEach((label, i) => {
    const labelR = svgId === 'radarChart' ? maxR + 18 : maxR + 22;
    const p = point(labelR, i);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', p.x); text.setAttribute('y', p.y);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '11');
    text.setAttribute('fill', '#495057'); text.setAttribute('font-weight', '600');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    text.textContent = label;
    svg.appendChild(text);

    if (scores) {
      const scoreEl = document.createElementNS(ns, 'text');
      scoreEl.setAttribute('x', p.x); scoreEl.setAttribute('y', p.y + 13);
      scoreEl.setAttribute('text-anchor', 'middle'); scoreEl.setAttribute('font-size', '10');
      scoreEl.setAttribute('fill', '#868e96');
      scoreEl.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
      scoreEl.textContent = scores[i];
      svg.appendChild(scoreEl);
    }
  });
}

function renderBasicResult(data) {
  const { subtitle, radar1, radar2, feedback, questions, summary } = data;

  if (subtitle) document.getElementById('bs-subtitle').textContent = subtitle;
  if (summary?.time) document.getElementById('bs-time').textContent = summary.time;
  if (summary?.count) document.getElementById('bs-count').textContent = summary.count;
  if (summary?.avg) document.getElementById('bs-avg').textContent = summary.avg;

  const r1 = radar1;
  if (r1?.labels && r1?.values) {
    drawRadarChart('radarChart', 130, 130, 80, r1.labels, r1.values, r1.scores, 10);
  }

  const r2 = radar2;
  if (r2?.labels && r2?.values) {
    drawRadarChart('radarChart2', 140, 140, 80, r2.labels, r2.values, r2.scores, 10);
  }

  if (feedback) {
    if (feedback.summary) document.getElementById('bs-fb-summary').textContent = feedback.summary;
    if (feedback.strengths) document.getElementById('bs-fb-strengths').innerHTML = feedback.strengths.map(i => `
      <div class="fb-item">
        <div class="fb-item-dot"></div>
        <div><div class="fb-item-title">${i.title}</div><div class="fb-item-text">${i.desc}</div></div>
      </div>`).join('');
    if (feedback.weaknesses) document.getElementById('bs-fb-weaknesses').innerHTML = feedback.weaknesses.map(i => `
      <div class="fb-item">
        <div class="fb-item-dot"></div>
        <div><div class="fb-item-title">${i.title}</div><div class="fb-item-text">${i.desc}</div></div>
      </div>`).join('');
    if (feedback.recommends) document.getElementById('bs-fb-recommends').innerHTML = feedback.recommends.map(i => `
      <div class="fb-item">
        <div class="fb-item-dot"></div>
        <div class="fb-item-text">${i.title}</div>
      </div>`).join('');
  }

  if (!questions) return;
  document.getElementById('bs-questions').innerHTML = questions.map((q, i) => `
    <div class="record-q-item">
      <div class="record-q-num">${i + 1}</div>
      <div class="record-q-content">
        <div class="record-q-title">${q.title}</div>
        <div class="record-q-feedback">${q.feedback}</div>
      </div>
      <button class="replay-btn">${replayIcon} 답변 다시 듣기</button>
    </div>`).join('');
}

function truncateText(s, max) {
  const t = String(s || '');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function buildBasicResultFromRealApi(d) {
  const strengths = (d.feedbacks || []).map(f => ({
    title: f.name || f.persona || '면접관',
    desc: truncateText(f.feedback, 220),
  }));
  return {
    subtitle: '실전 면접 결과가 저장되었습니다.',
    radar1: null,
    radar2: null,
    feedback: {
      summary: d.summary || '',
      strengths: strengths.length ? strengths : null,
      weaknesses: null,
      recommends: null,
    },
    questions: [{ title: d.questionText || '질문', feedback: truncateText(d.summary, 500) }],
    summary: { time: '-', count: '-', avg: '-' },
  };
}

(function initBasicResultFromSession() {
  const raw = sessionStorage.getItem('basicInterviewLastResult');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      sessionStorage.removeItem('basicInterviewLastResult');
      renderBasicResult(buildBasicResultFromRealApi(parsed));
      return;
    } catch (_) {
      sessionStorage.removeItem('basicInterviewLastResult');
    }
  }
  renderBasicResult(basicResultData);
})();
