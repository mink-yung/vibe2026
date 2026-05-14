// API에서 받아온 데이터를 여기에 채우면 됩니다
const interviewRecordData = {
  stats: {
    total: null,      // 예: 12
    avg: null,        // 예: 82
    best: null,       // 예: 92
    bestSub: null,    // 예: '실전면접 · 2024.05.10'
    totalTime: null,  // 예: '8시간 24분'
    weekly: null,     // 예: 2
  },
  types: null,        // 예: [{ id:'quick', score:74 }, { id:'basic', score:85 }, { id:'deep', score:76 }]
  records: null,      // 예: [{ date:'2024.05.06', day:'월', type:'quick', typeName:'빠른면접', category:'자기소개 & 경험', time:'4:10', score:78 }, ...]
};

function scoreClass(s) {
  if (s >= 90) return 's-green';
  if (s >= 80) return 's-blue';
  return 's-orange';
}

function badgeClass(type) {
  if (type === 'quick') return 'quick';
  if (type === 'basic') return 'basic';
  return 'deep';
}

function renderInterviewRecord(data) {
  if (!document.getElementById('ir-total')) return;
  const { stats, types, records } = data;
  const C = 276.5;

  // 통계 카드
  document.getElementById('ir-total').textContent = stats?.total ?? '-';
  document.getElementById('ir-avg').textContent = stats?.avg ?? '-';
  document.getElementById('ir-best').textContent = stats?.best ?? '-';
  document.getElementById('ir-best-sub').textContent = stats?.bestSub ?? '';
  document.getElementById('ir-total-time').textContent = stats?.totalTime ?? '-';
  document.getElementById('ir-weekly').textContent = stats?.weekly ?? '-';

  // 유형별 차트
  [
    { id: 'quick', scoreEl: 'ir-quick-score', circleEl: 'ir-quick-circle' },
    { id: 'basic', scoreEl: 'ir-basic-score', circleEl: 'ir-basic-circle' },
    { id: 'deep',  scoreEl: 'ir-deep-score',  circleEl: 'ir-deep-circle'  },
  ].forEach(({ id, scoreEl, circleEl }) => {
    const t = types?.find(t => t.id === id);
    const score = t?.score ?? null;
    document.getElementById(scoreEl).textContent = score ?? '-';
    document.getElementById(circleEl).setAttribute('stroke-dasharray',
      score != null ? `${(C * score / 100).toFixed(1)} ${(C * (1 - score / 100)).toFixed(1)}` : '0.1 276.4');
  });

  // 테이블
  document.getElementById('irTableBody').innerHTML = records?.length
    ? records.map(r => `
        <tr>
          <td><span class="ir-date">${r.date}</span><span class="ir-day">(${r.day})</span></td>
          <td><span class="ir-badge ${badgeClass(r.type)}">${r.typeName}</span></td>
          <td><span class="ir-category">${r.category}</span></td>
          <td><span class="ir-time">${r.time}</span></td>
          <td><span class="ir-score ${scoreClass(r.score)}">${r.score}점</span></td>
        </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:40px 0;color:#adb5bd;">면접 기록이 없습니다.</td></tr>';
}

renderInterviewRecord(interviewRecordData);
