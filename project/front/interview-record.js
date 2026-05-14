const interviewRecordData = {
  stats: {
    total: null,
    avg: null,
    best: null,
    bestSub: null,
    totalTime: null,
    weekly: null,
  },
  types: null,
  records: null,
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

  document.getElementById('ir-total').textContent = stats?.total ?? '-';
  document.getElementById('ir-avg').textContent = stats?.avg ?? '-';
  document.getElementById('ir-best').textContent = stats?.best ?? '-';
  document.getElementById('ir-best-sub').textContent = stats?.bestSub ?? '';
  document.getElementById('ir-total-time').textContent = stats?.totalTime ?? '-';
  document.getElementById('ir-weekly').textContent = stats?.weekly ?? '-';

  [
    { id: 'quick', scoreEl: 'ir-quick-score', circleEl: 'ir-quick-circle' },
    { id: 'basic', scoreEl: 'ir-basic-score', circleEl: 'ir-basic-circle' },
    { id: 'deep', scoreEl: 'ir-deep-score', circleEl: 'ir-deep-circle' },
  ].forEach(({ id, scoreEl, circleEl }) => {
    const t = types?.find(x => x.id === id);
    const score = t?.score ?? null;
    document.getElementById(scoreEl).textContent = score ?? '-';
    document.getElementById(circleEl).setAttribute(
      'stroke-dasharray',
      score != null ? `${(C * score / 100).toFixed(1)} ${(C * (1 - score / 100)).toFixed(1)}` : '0.1 276.4'
    );
  });

  document.getElementById('irTableBody').innerHTML = records?.length
    ? records
        .map(
          r => `
        <tr>
          <td><span class="ir-date">${r.date}</span><span class="ir-day">(${r.day})</span></td>
          <td><span class="ir-badge ${badgeClass(r.type)}">${r.typeName}</span></td>
          <td><span class="ir-category">${r.category}</span></td>
          <td><span class="ir-time">${r.time}</span></td>
          <td><span class="ir-score ${scoreClass(r.score)}">${r.score}점</span></td>
        </tr>`
        )
        .join('')
    : '<tr><td colspan="5" style="text-align:center;padding:40px 0;color:#adb5bd;">면접 기록이 없습니다.</td></tr>';
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function modeToTypeName(mode) {
  if (mode === 'quick') return '빠른면접';
  if (mode === 'basic') return '기본면접';
  if (mode === 'real') return '실전면접';
  return mode || '-';
}

function mapHistoryToRecordData(history) {
  const list = Array.isArray(history) ? history : [];
  const scores = list.map(h => Number(h.overallScore)).filter(n => !Number.isNaN(n));
  const total = list.length;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  let best = null;
  let bestSub = '';
  list.forEach(h => {
    const s = Number(h.overallScore);
    if (Number.isNaN(s)) return;
    if (best == null || s > best) {
      best = s;
      const d = formatRecordDate(h.createdAt);
      bestSub = `${modeToTypeName(h.mode)} · ${d.date}`;
    }
  });

  const byMode = { quick: [], basic: [], real: [] };
  list.forEach(h => {
    const m = h.mode;
    const s = Number(h.overallScore);
    if (m === 'quick' && !Number.isNaN(s)) byMode.quick.push(s);
    if (m === 'basic' && !Number.isNaN(s)) byMode.basic.push(s);
    if (m === 'real' && !Number.isNaN(s)) byMode.real.push(s);
  });
  const avgMode = arr => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const types = [
    { id: 'quick', score: avgMode(byMode.quick) },
    { id: 'basic', score: avgMode(byMode.basic) },
    { id: 'deep', score: avgMode(byMode.real) },
  ];

  const records = list.map(h => {
    const { date, day } = formatRecordDate(h.createdAt);
    const mode = h.mode || 'basic';
    const type = mode === 'real' ? 'deep' : mode;
    const cat = (h.questionText && String(h.questionText).trim()) || (h.summary && String(h.summary).slice(0, 40)) || '-';
    const sc = Number(h.overallScore);
    return {
      date,
      day,
      type,
      typeName: modeToTypeName(mode),
      category: cat.length > 48 ? `${cat.slice(0, 48)}…` : cat,
      time: '-',
      score: Number.isNaN(sc) ? 0 : sc,
    };
  });

  return {
    stats: {
      total: total || null,
      avg,
      best,
      bestSub,
      totalTime: null,
      weekly: null,
    },
    types,
    records,
  };
}

function formatRecordDate(createdAt) {
  const d = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(d.getTime())) {
    return { date: '-', day: '-' };
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return { date: `${y}.${mo}.${da}`, day: WEEKDAYS[d.getDay()] };
}

async function loadInterviewRecordPage() {
  const tb = document.getElementById('irTableBody');
  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    renderInterviewRecord({ stats: interviewRecordData.stats, types: [], records: [] });
    if (tb) {
      tb.innerHTML =
        '<tr><td colspan="5" style="text-align:center;padding:40px 0;color:#adb5bd;">' +
        '<a href="dashboard.html#login" style="color:#339af0;font-weight:600;">로그인</a> 후 면접 기록을 확인할 수 있습니다.</td></tr>';
    }
    return;
  }
  try {
    const res = await apiGetInterviewsHistory();
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      location.href = 'dashboard.html#login';
      return;
    }
    if (!res.ok) {
      renderInterviewRecord(interviewRecordData);
      if (tb) {
        tb.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px 0;color:#adb5bd;">${data.message || '기록을 불러오지 못했습니다.'}</td></tr>`;
      }
      return;
    }
    renderInterviewRecord(mapHistoryToRecordData(data.history));
  } catch (e) {
    if (e && e.message === 'LOGIN_REQUIRED') {
      location.href = 'dashboard.html#login';
      return;
    }
    renderInterviewRecord(interviewRecordData);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadInterviewRecordPage);
} else {
  loadInterviewRecordPage();
}
