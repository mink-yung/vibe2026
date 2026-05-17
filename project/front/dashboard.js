function setActive(btn) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/** 단일 HTML로 쪼갠 뒤, 해당 섹션이 없으면 이 경로로 이동 */
const SECTION_PAGE = {
  dash: 'dashboard.html',
  mock: 'mock-interview.html',
  analysis: 'interview-analysis.html',
  ir: 'interview-record.html',
  quickInterview: 'quick-interview.html',
  quick: 'quick-result.html',
  videoInterview: 'video-interview.html',
  normal: 'normal-result.html',
  basicInterview: 'basic-interview.html',
  basic: 'basic-result.html',
};

const SECTION_IDS = ['dashSection', 'irSection', 'mockSection', 'quickInterviewSection', 'quickSection', 'videoInterviewSection', 'normalSection', 'basicInterviewSection', 'basicSection', 'analysisSection'];

function showSection(section) {
  const id = section + 'Section';
  const el = document.getElementById(id);
  if (!el) {
    const path = SECTION_PAGE[section];
    if (path) location.href = path;
    return;
  }
  SECTION_IDS.forEach(sid => {
    const n = document.getElementById(sid);
    if (n) n.style.display = 'none';
  });
  el.style.display = (section === 'videoInterview' || section === 'basicInterview') ? 'block' : '';
  if (section === 'analysis' && !window._analysisChartsDrawn) {
    const r = document.getElementById('an-attitude-radar');
    if (r) {
      drawModalRadar('an-attitude-radar');
      drawCompetencyRadar('an-competency-radar');
      window._analysisChartsDrawn = true;
    }
  }
}


function drawRadar(id, labels, values) {
  const svg = document.getElementById(id);
  if (!svg) return;
  const C = 60, R = 42, n = labels.length;
  const ns = 'http://www.w3.org/2000/svg';

  const pt = (i, r) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };

  // 그리드
  [0.3, 0.55, 0.8, 1].forEach(lv => {
    const pts = Array.from({length: n}, (_, i) => pt(i, R * lv));
    const el = document.createElementNS(ns, 'path');
    el.setAttribute('d', pts.map(([x,y], i) => `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z');
    el.setAttribute('fill', lv < 1 ? 'rgba(248,249,250,0.8)' : 'none');
    el.setAttribute('stroke', '#dee2e6');
    el.setAttribute('stroke-width', '1');
    svg.appendChild(el);
  });

  // 축
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, R);
    const ln = document.createElementNS(ns, 'line');
    ln.setAttribute('x1', C); ln.setAttribute('y1', C);
    ln.setAttribute('x2', x.toFixed(1)); ln.setAttribute('y2', y.toFixed(1));
    ln.setAttribute('stroke', '#dee2e6'); ln.setAttribute('stroke-width', '1');
    svg.appendChild(ln);
  }

  // 데이터
  const dpts = values.map((v, i) => pt(i, (v / 100) * R));
  const dp = document.createElementNS(ns, 'path');
  dp.setAttribute('d', dpts.map(([x,y], i) => `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z');
  dp.setAttribute('fill', 'rgba(173,181,189,0.45)');
  dp.setAttribute('stroke', '#868e96');
  dp.setAttribute('stroke-width', '2');
  svg.appendChild(dp);

  // 라벨
  labels.forEach((lb, i) => {
    const [x, y] = pt(i, R + 13);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', y.toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('font-size', '8'); t.setAttribute('fill', '#868e96');
    t.setAttribute('font-family', 'sans-serif');
    t.textContent = lb;
    svg.appendChild(t);
  });
}

// 면접분석 페이지 데이터
const analysisData = {
  attitude: {
    avg: null,          // 예: 48
    diff: null,         // 예: '▲ 3.2'
    score: null,        // 예: 48
    date: null,         // 예: '2024.03 ~ 2024.05'
    radarLabels: null,  // 예: ['표정','시선','자세 안정성','억양','말하기 속도']
    radarValues: null,  // 예: [10, 9, 8, 10, 10]
    radarScores: null,  // 예: ['10/10','9/10',...]
    lineChart: null,    // 예: { dates:['03.15','03.29',...], upper:[35,42,...], lower:[35,38,...] }
  },
  competency: {
    avg: null,          // 예: 46
    diff: null,         // 예: '▲ 2.1'
    score: null,        // 예: 46
    date: null,         // 예: '2024.03 ~ 2024.05'
    radarLabels: null,  // 예: ['의사소통','직무역량','자신감','논리적사고','문제해결력']
    radarValues: null,  // 예: [9, 9, 9, 9, 9]
    radarScores: null,  // 예: ['9/10','9/10',...]
    lineChart: null,    // 예: { dates:['03.15','03.29',...], upper:[38,41,...], lower:[38,41,...] }
  },
};

function renderAnalysis(data) {
  if (!document.getElementById('an-attitude-avg')) return;
  const { attitude, competency } = data;

  document.getElementById('an-attitude-avg').textContent = attitude.avg ?? '-';
  document.getElementById('an-attitude-diff').textContent = attitude.diff ? `지난 분석 대비 ${attitude.diff}` : '';
  document.getElementById('an-attitude-score').innerHTML = `${attitude.score ?? '-'}<span>/50</span>`;
  document.getElementById('an-attitude-date').textContent = attitude.date ?? '-';

  document.getElementById('an-competency-avg').textContent = competency.avg ?? '-';
  document.getElementById('an-competency-diff').textContent = competency.diff ? `지난 분석 대비 ${competency.diff}` : '';
  document.getElementById('an-competency-score').innerHTML = `${competency.score ?? '-'}<span>/50</span>`;
  document.getElementById('an-competency-date').textContent = competency.date ?? '-';

  drawModalRadar('an-attitude-radar', attitude.radarLabels, attitude.radarValues, attitude.radarScores, 10);
  drawCompetencyRadar('an-competency-radar', competency.radarLabels, competency.radarValues, competency.radarScores, 10);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function overallScoreToScore50(overallScore) {
  const n = Number(overallScore);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(50, Math.round((n * 50) / 100)));
}

function setAnalysisRingGauge(circleId, score50) {
  const el = document.getElementById(circleId);
  if (!el || score50 == null) return;
  const c = 264;
  const pct = Math.max(0, Math.min(1, score50 / 50));
  el.setAttribute('stroke-dasharray', `${(c * pct).toFixed(1)} ${(c * (1 - pct)).toFixed(1)}`);
}

function radarValuesFromOverall100(overallScore, len) {
  const n = Number(overallScore);
  const base = Number.isNaN(n) ? 7 : Math.min(10, Math.max(5, Math.round(n / 10)));
  return Array.from({ length: len }, (_, i) => Math.min(10, Math.max(5, base + ((i % 3) - 1))));
}

/** API mode → 면접 기록·네비와 동일한 표기 */
function interviewModeLabelKo(mode) {
  if (mode == null || String(mode).trim() === '') return '';
  const m = String(mode).trim().toLowerCase();
  if (m === 'quick') return '빠른면접';
  if (m === 'basic') return '기본면접';
  if (m === 'real') return '실전면접';
  return escapeHtml(String(mode).trim());
}

function renderInterviewAnalysisApiTextBlock(t) {
  const sumEl = document.getElementById('an-api-summary');
  const listsEl = document.getElementById('an-api-lists');
  if (!sumEl || !listsEl) return;
  const sumL = (t.summaryLine && String(t.summaryLine).trim()) || '';
  const rec = (t.recommendation && String(t.recommendation).trim()) || '';
  const body = [];
  if (sumL) body.push(sumL);
  if (rec && rec !== sumL) body.push(rec);
  sumEl.textContent = body.length ? body.join('\n\n') : '표시할 요약이 없습니다.';
  const section = (title, arr) => {
    if (!Array.isArray(arr) || !arr.length) return '';
    const items = arr
      .map(x => `<li style="margin:6px 0;color:#495057;font-size:14px;line-height:1.5;">${escapeHtml(String(x))}</li>`)
      .join('');
    return `<div style="margin-top:10px;"><div style="font-size:12px;font-weight:700;color:#212529;margin-bottom:6px;">${escapeHtml(title)}</div><ul style="margin:0;padding-left:18px;">${items}</ul></div>`;
  };
  listsEl.innerHTML =
    section('강점', t.strengths) +
    section('보완점', t.weaknesses) +
    (t.mode
      ? `<p style="margin-top:14px;font-size:12px;color:#868e96;">최근 모드: ${interviewModeLabelKo(t.mode)}</p>`
      : '');
}

/** GET /api/interviews/recent/analysis (+요약) → 면접분석 단독 페이지 */
function mergeAnalysisPageFromApiPayload(apiAnalysis, summaryFromSummaryEndpoint) {
  const a = apiAnalysis || {};
  const overall = a.overallScore;
  const score50 = overallScoreToScore50(overall);
  const attLabels = ['표정', '시선', '자세 안정성', '억양', '말하기 속도'];
  const compLabels = ['의사소통', '직무역량', '자신감', '논리적사고', '문제해결력'];
  const attVals = radarValuesFromOverall100(overall, attLabels.length);
  const compVals = radarValuesFromOverall100((Number(overall) || 75) - 2, compLabels.length);
  const dt = a.createdAt ? new Date(a.createdAt) : null;
  let dateStr = '-';
  if (dt && !Number.isNaN(dt.getTime())) {
    dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
  }
  const compScore50 = score50 != null ? Math.max(0, Math.min(50, score50 - 2)) : null;
  Object.assign(analysisData, {
    attitude: {
      avg: score50,
      diff: null,
      score: score50,
      date: dateStr,
      radarLabels: attLabels,
      radarValues: attVals,
      radarScores: attVals.map(v => `${v}/10`),
      lineChart: null,
    },
    competency: {
      avg: compScore50,
      diff: null,
      score: compScore50,
      date: dateStr,
      radarLabels: compLabels,
      radarValues: compVals,
      radarScores: compVals.map(v => `${v}/10`),
      lineChart: null,
    },
  });
  renderAnalysis(analysisData);
  setAnalysisRingGauge('an-attitude-gauge', score50);
  setAnalysisRingGauge('an-competency-gauge', compScore50);
  renderInterviewAnalysisApiTextBlock({
    strengths: a.strengths,
    weaknesses: a.weaknesses,
    recommendation: a.recommendation,
    summaryLine: summaryFromSummaryEndpoint,
    mode: a.mode,
  });
}

function formatFeedbackDateKey(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

async function loadAiFeedbackPageFromApi() {
  if (document.body.getAttribute('data-page') !== 'ai-feedback') return;
  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    const sum = document.getElementById('fbSummary');
    if (sum) sum.textContent = '로그인 후 최근 면접 피드백을 불러올 수 있습니다.';
    return;
  }
  try {
    const [ar, sr] = await Promise.all([apiGetInterviewsRecentAnalysis(), apiGetInterviewsRecentSummary()]);
    if (ar.status === 401 || sr.status === 401) {
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      location.href = 'dashboard.html#login';
      return;
    }
    const aj = ar.ok ? await ar.json().catch(() => ({})) : {};
    if (!ar.ok && ar.status === 404) {
      const sum = document.getElementById('fbSummary');
      if (sum) sum.textContent = aj.message || '아직 면접 기록이 없습니다.';
      return;
    }
    if (!ar.ok) {
      const sum = document.getElementById('fbSummary');
      if (sum) sum.textContent = aj.message || '피드백을 불러오지 못했습니다.';
      return;
    }
    const analysis = aj.analysis || {};
    const sj = sr.ok ? await sr.json().catch(() => ({})) : {};
    const summaryLine = (sj.summary && String(sj.summary).trim()) || '';
    const recommend = (analysis.recommendation && String(analysis.recommendation).trim()) || summaryLine;
    const createdAtStr = formatFeedbackDateKey(sj.createdAt || analysis.createdAt);
    const strengths = (analysis.strengths || []).map(s => ({ title: String(s), desc: '' }));
    const weaknesses = (analysis.weaknesses || []).map(s => ({ title: String(s), desc: '' }));
    const summaryTop =
      summaryLine ||
      recommend ||
      '최근 면접 분석이 있습니다. 아래 강점·보완점을 확인해 보세요.';
    feedbackData = {
      [createdAtStr]: {
        summary: summaryTop,
        strengths: strengths.length ? strengths : [{ title: '—', desc: '등록된 강점 문구가 없습니다.' }],
        weaknesses: weaknesses.length ? weaknesses : [{ title: '—', desc: '등록된 보완 문구가 없습니다.' }],
        recommends: recommend ? [{ title: recommend, link: '' }] : [{ title: '추가 코멘트가 없습니다.', link: '' }],
      },
    };
    currentFeedbackDate = createdAtStr;
    renderFeedback(feedbackData);
  } catch (e) {
    if (e && e.message === 'LOGIN_REQUIRED') {
      location.href = 'dashboard.html#login';
      return;
    }
    const sum = document.getElementById('fbSummary');
    if (sum) sum.textContent = '서버와 통신할 수 없습니다.';
  }
}

renderAnalysis(analysisData);

// API에서 받아온 데이터를 여기에 채우면 됩니다
const dashboardData = {
  attitude: {
    score: null,
    diff: null,
    radarLabels: ['끌림','망양','자태명성','달가뇨','시선'],
    radarValues: null,
  },
  competency: {
    score: null,
    diff: null,
    radarLabels: ['의사소통','논리적사고','자신감','문제해결력','팀워크'],
    radarValues: null,
  },
  records: null,
};

function renderDashboard(data) {
  if (!document.getElementById('attitude-score')) return;
  const { attitude, competency, records } = data;

  document.getElementById('attitude-score').textContent = attitude.score ?? '-';
  document.getElementById('attitude-diff').textContent = attitude.diff ? `지난 분석 대비 ▲ ${attitude.diff}` : '-';

  document.getElementById('competency-score').textContent = competency.score ?? '-';
  document.getElementById('competency-diff').textContent = competency.diff ? `지난 분석 대비 ▲ ${competency.diff}` : '-';

  const recordList = document.getElementById('record-list');
  if (records && records.length > 0) {
    recordList.innerHTML = records.map(r => `
      <div>
        <div style="font-size:12px;font-weight:600;color:#343a40;margin-bottom:10px;">${r.label}</div>
        <div style="font-size:26px;font-weight:800;color:#212529;line-height:1;">${r.score}</div>
        <div style="font-size:10px;color:#adb5bd;margin-top:4px;">${r.date}</div>
      </div>
    `).join('');
  } else {
    recordList.innerHTML = '<div style="color:#adb5bd;font-size:13px;grid-column:span 4;text-align:center;padding:40px 0;">면접 기록이 없습니다.</div>';
  }

  if (attitude.radarValues) drawRadar('radar1', attitude.radarLabels, attitude.radarValues);
  if (competency.radarValues) drawRadar('radar2', competency.radarLabels, competency.radarValues);
}

renderDashboard(dashboardData);

// 모달
let modalChartsDrawn = false;

function openAttitudeModal() {
  const modal = document.getElementById('attitudeModal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!modalChartsDrawn) {
    const att = analysisData.attitude;
    drawModalRadar('modalRadar', att.radarLabels, att.radarValues, att.radarScores, 10);
    drawModalLineChart(att.lineChart);
    modalChartsDrawn = true;
  }
}

function closeAttitudeModal() {
  const modal = document.getElementById('attitudeModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOutside(e) {
  if (e.target.id === 'attitudeModal') closeAttitudeModal();
}

function openLoginModal() {
  const el = document.getElementById('loginModal');
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  clearLoginError();
}

function closeLoginModal() {
  const el = document.getElementById('loginModal');
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
  clearLoginError();
}

function closeLoginOutside(e) {
  if (e.target.id === 'loginModal') closeLoginModal();
}

const INTERVIEW_EXIT_SKIP_KEY = { basic: 'interviewExitWarnDontShow_basic', real: 'interviewExitWarnDontShow_real' };
const INTERVIEW_EXIT_SECTION = { basic: 'normal', real: 'basic' };

function openInterviewExitWarnModal(kind) {
  if (kind !== 'basic' && kind !== 'real') return;
  try {
    if (localStorage.getItem(INTERVIEW_EXIT_SKIP_KEY[kind]) === '1') {
      showSection(INTERVIEW_EXIT_SECTION[kind]);
      return;
    }
  } catch (_) {}
  window.__interviewExitPendingKind = kind;
  const m = document.getElementById('interviewExitWarnModal');
  if (m) {
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    showSection(INTERVIEW_EXIT_SECTION[kind]);
    window.__interviewExitPendingKind = null;
  }
}

function closeInterviewExitWarnModal() {
  const m = document.getElementById('interviewExitWarnModal');
  if (m) m.classList.remove('open');
  document.body.style.overflow = '';
  window.__interviewExitPendingKind = null;
}

function closeInterviewExitWarnOutside(e) {
  if (e.target.id === 'interviewExitWarnModal') closeInterviewExitWarnModal();
}

function interviewExitWarnConfirmLeave(dontShowAgain) {
  const kind = window.__interviewExitPendingKind;
  closeInterviewExitWarnModal();
  if (kind !== 'basic' && kind !== 'real') return;
  if (typeof stopActiveCameraInterviewStream === 'function') {
    stopActiveCameraInterviewStream();
  }
  if (dontShowAgain) {
    try {
      localStorage.setItem(INTERVIEW_EXIT_SKIP_KEY[kind], '1');
    } catch (_) {}
  }
  showSection(INTERVIEW_EXIT_SECTION[kind]);
}

function getLoginErrorEl() {
  return document.getElementById('login-error');
}

function setLoginError(message) {
  const el = getLoginErrorEl();
  if (!el) return;
  el.textContent = message || '로그인에 실패했습니다.';
  el.hidden = false;
}

function clearLoginError() {
  const el = getLoginErrorEl();
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAuthDisplayName(user) {
  if (!user || typeof user !== 'object') return '내 계정';
  const n = user.name != null ? String(user.name).trim() : '';
  if (n) return n;
  if (user.email) return String(user.email);
  return '내 계정';
}

function renderAuthTopbar() {
  const el = document.getElementById('authTopbar');
  if (!el) return;
  const token = typeof getStoredAuthToken === 'function' ? getStoredAuthToken() : null;
  if (token) {
    const user = typeof getStoredAuthUser === 'function' ? getStoredAuthUser() : null;
    const name = escapeHtml(getAuthDisplayName(user));
    el.innerHTML = `
      <details class="auth-top-details">
        <summary class="auth-user-summary">${name}</summary>
        <div class="auth-dropdown-panel">
          <a href="mypage.html">마이페이지</a>
          <button type="button" class="auth-logout-btn">로그아웃</button>
        </div>
      </details>`;
    const btn = el.querySelector('.auth-logout-btn');
    if (btn) btn.addEventListener('click', handleAuthLogout);
  } else {
    el.innerHTML = `
      <button type="button" class="btn-join" onclick="openLoginModal()">로그인</button>
      <button type="button" class="btn-join" onclick="location.href='signup.html'">회원가입</button>`;
  }
}

function handleAuthLogout(e) {
  if (e) e.preventDefault();
  if (typeof clearStoredAuth === 'function') clearStoredAuth();
  closeLoginModal();
  const det = document.querySelector('.auth-top-details');
  if (det) det.removeAttribute('open');
  renderAuthTopbar();
}

/** API JSON에서 실패 사유 문자열 추출 (백엔드 필드명에 맞게 확장 가능) */
function pickLoginErrorMessage(data) {
  if (!data || typeof data !== 'object') return '이메일 또는 비밀번호를 확인해 주세요.';
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  const first = Array.isArray(data.errors) ? data.errors[0] : null;
  if (first && typeof first.message === 'string' && first.message.trim()) return first.message.trim();
  return '이메일 또는 비밀번호를 확인해 주세요.';
}

/**
 * 로그인 API 호출. 응답 본문을 받아 { ok, message } 로 맞추면 됩니다.
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function requestLoginApi(email, password) {
  const response = await apiPostAuthLogin({
    email: email,
    password: password,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, message: pickLoginErrorMessage(data) };
  }
  if (data && (data.success === false || data.ok === false)) {
    return { ok: false, message: pickLoginErrorMessage(data) };
  }
  if (!data.token) {
    return { ok: false, message: '로그인 응답에 토큰이 없습니다.' };
  }
  saveAuthToStorage(data.token, data.user);
  return { ok: true, data };
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  clearLoginError();
  const form = e.target;
  const email = (form.elements.email && form.elements.email.value)
    ? form.elements.email.value.trim()
    : '';
  const password = form.elements.password ? form.elements.password.value : '';
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const result = await requestLoginApi(email, password);
    if (!result || !result.ok) {
      setLoginError(result && result.message);
      return;
    }
    form.reset();
    closeLoginModal();
    renderAuthTopbar();
  } catch (err) {
    console.error(err);
    setLoginError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function drawModalRadar(svgId, labels, values, scores, maxVal) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';
  if (!labels || !values) return;
  const cx = 140, cy = 140, maxR = 85;
  maxVal = maxVal || 10;
  const n = labels.length;
  const ns = 'http://www.w3.org/2000/svg';

  function angle(i) { return (Math.PI * 2 * i / n) - Math.PI / 2; }
  function point(r, i) { return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) }; }
  function toPoints(pts) { return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '); }

  for (let lv = 1; lv <= 5; lv++) {
    const pts = Array.from({length: n}, (_, i) => point(maxR * lv / 5, i));
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
    line.setAttribute('x2', p.x.toFixed(1)); line.setAttribute('y2', p.y.toFixed(1));
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
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1));
    c.setAttribute('r', '3'); c.setAttribute('fill', '#74c0fc');
    svg.appendChild(c);
  });

  labels.forEach((label, i) => {
    const p = point(maxR + 22, i);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', p.x.toFixed(1)); t.setAttribute('y', p.y.toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11');
    t.setAttribute('fill', '#495057'); t.setAttribute('font-weight', '600');
    t.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    t.textContent = label;
    svg.appendChild(t);

    const s = document.createElementNS(ns, 'text');
    s.setAttribute('x', p.x.toFixed(1)); s.setAttribute('y', (p.y + 13).toFixed(1));
    s.setAttribute('text-anchor', 'middle'); s.setAttribute('font-size', '10');
    s.setAttribute('fill', '#868e96');
    s.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    s.textContent = scores[i];
    svg.appendChild(s);
  });
}

// AI 피드백 모달 · ai-feedback.html (`data-page="ai-feedback"`)에서 API로 채움
// 예: { '2024.05.10': { summary:'...', strengths:[{title,desc},...], weaknesses:[...], recommends:[{title,link},...] }, ... }
let feedbackData = null;

let currentFeedbackDate = null;

function renderFeedback(data) {
  if (!data) return;
  const dates = Object.keys(data);
  if (!dates.length) return;
  const latest = data[dates[0]];
  const fs = document.getElementById('feedback-strength');
  if (fs) fs.textContent = latest.strengths?.[0]?.title ?? '-';
  const fw = document.getElementById('feedback-weakness');
  if (fw) fw.textContent = latest.weaknesses?.[0]?.title ?? '-';
  const fr = document.getElementById('feedback-recommend');
  if (fr) fr.textContent = latest.recommends?.[0]?.title ?? '-';
}

renderFeedback(feedbackData);

function openFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  if (!feedbackData) return;
  const dates = Object.keys(feedbackData);
  if (!dates.length) return;
  if (!currentFeedbackDate) currentFeedbackDate = dates[0];
  renderFeedbackTabs(dates);
  renderFeedbackContent(currentFeedbackDate);
}

function closeFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function closeFeedbackOutside(e) {
  if (e.target.id === 'feedbackModal') closeFeedbackModal();
}

function renderFeedbackTabs(dates) {
  const tabs = document.getElementById('fbDateTabs');
  if (!tabs) return;
  tabs.innerHTML = dates.map(d => `
    <button class="fb-date-tab ${d === currentFeedbackDate ? 'active' : ''}" onclick="selectFeedbackDate('${d}')">${d}</button>
  `).join('');
}

function selectFeedbackDate(date) {
  if (!feedbackData) return;
  currentFeedbackDate = date;
  renderFeedbackTabs(Object.keys(feedbackData));
  renderFeedbackContent(date);
}

function renderFeedbackContent(date) {
  const data = feedbackData[date];
  const sum = document.getElementById('fbSummary');
  const st = document.getElementById('fbStrengths');
  const wk = document.getElementById('fbWeaknesses');
  const rc = document.getElementById('fbRecommends');
  if (!sum || !st || !wk || !rc || !data) return;
  sum.textContent = data.summary;
  st.innerHTML = (data.strengths || []).map(i => `
    <div class="fb-item">
      <div class="fb-item-dot"></div>
      <div><div class="fb-item-title">${escapeHtml(i.title)}</div><div class="fb-item-text">${escapeHtml(i.desc)}</div></div>
    </div>`).join('');
  wk.innerHTML = (data.weaknesses || []).map(i => `
    <div class="fb-item">
      <div class="fb-item-dot"></div>
      <div><div class="fb-item-title">${escapeHtml(i.title)}</div><div class="fb-item-text">${escapeHtml(i.desc)}</div></div>
    </div>`).join('');
  rc.innerHTML = (data.recommends || []).map(i => `
    <div class="fb-item">
      <div class="fb-item-dot"></div>
      <div class="fb-item-text">${escapeHtml(i.title)}</div>
    </div>`).join('');
}

// 역량 분석 모달
let competencyChartsDrawn = false;

function openCompetencyModal() {
  const modal = document.getElementById('competencyModal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!competencyChartsDrawn) {
    const comp = analysisData.competency;
    drawCompetencyRadar('competencyRadar', comp.radarLabels, comp.radarValues, comp.radarScores, 10);
    drawCompetencyLineChart(comp.lineChart);
    competencyChartsDrawn = true;
  }
}

function closeCompetencyModal() {
  const modal = document.getElementById('competencyModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function closeCompetencyOutside(e) {
  if (e.target.id === 'competencyModal') closeCompetencyModal();
}

function drawCompetencyRadar(svgId, labels, values, scores, maxVal) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';
  if (!labels || !values) return;
  const cx = 140, cy = 140, maxR = 85;
  maxVal = maxVal || 10;
  const n = labels.length;
  const ns = 'http://www.w3.org/2000/svg';

  function angle(i) { return (Math.PI * 2 * i / n) - Math.PI / 2; }
  function point(r, i) { return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) }; }
  function toPoints(pts) { return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '); }

  for (let lv = 1; lv <= 5; lv++) {
    const pts = Array.from({length: n}, (_, i) => point(maxR * lv / 5, i));
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
    line.setAttribute('x2', p.x.toFixed(1)); line.setAttribute('y2', p.y.toFixed(1));
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
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1));
    c.setAttribute('r', '3'); c.setAttribute('fill', '#74c0fc');
    svg.appendChild(c);
  });

  labels.forEach((label, i) => {
    const p = point(maxR + 22, i);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', p.x.toFixed(1)); t.setAttribute('y', p.y.toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11');
    t.setAttribute('fill', '#495057'); t.setAttribute('font-weight', '600');
    t.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    t.textContent = label;
    svg.appendChild(t);

    const s = document.createElementNS(ns, 'text');
    s.setAttribute('x', p.x.toFixed(1)); s.setAttribute('y', (p.y + 13).toFixed(1));
    s.setAttribute('text-anchor', 'middle'); s.setAttribute('font-size', '10');
    s.setAttribute('fill', '#868e96');
    s.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif');
    s.textContent = scores[i];
    svg.appendChild(s);
  });
}

function drawCompetencyLineChart(data) {
  const svg = document.getElementById('competencyLineChart');
  if (!svg) return;
  svg.innerHTML = '';
  if (!data) return;
  const ns = 'http://www.w3.org/2000/svg';
  const ml = 38, mr = 16, mt = 16, mb = 28;
  const W = 520, H = 150;
  const cw = W - ml - mr, ch = H - mt - mb;

  const { dates, upper, lower } = data;
  const allVals = [...upper, ...lower];
  const yMin = Math.floor(Math.min(...allVals) / 5) * 5 - 5;
  const yMax = Math.ceil(Math.max(...allVals) / 5) * 5 + 2;
  const n = dates.length;

  function X(i) { return ml + (i / (n - 1)) * cw; }
  function Y(v) { return mt + ch - ((v - yMin) / (yMax - yMin)) * ch; }

  [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMin + t * (yMax - yMin))).forEach(v => {
    const y = Y(v);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', ml); line.setAttribute('y1', y.toFixed(1));
    line.setAttribute('x2', W - mr); line.setAttribute('y2', y.toFixed(1));
    line.setAttribute('stroke', '#e9ecef'); line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', ml - 6); t.setAttribute('y', (y + 3).toFixed(1));
    t.setAttribute('text-anchor', 'end'); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#adb5bd');
    t.textContent = v;
    svg.appendChild(t);
  });

  const areaD = [
    ...upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`),
    ...[...lower].reverse().map((v, i) => `L${X(n - 1 - i).toFixed(1)},${Y(v).toFixed(1)}`),
    'Z'
  ].join(' ');
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaD); area.setAttribute('fill', 'rgba(116,192,252,0.15)');
  svg.appendChild(area);

  const upperD = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const uLine = document.createElementNS(ns, 'path');
  uLine.setAttribute('d', upperD); uLine.setAttribute('fill', 'none');
  uLine.setAttribute('stroke', '#74c0fc'); uLine.setAttribute('stroke-width', '2');
  uLine.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(uLine);

  const lowerD = lower.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const lLine = document.createElementNS(ns, 'path');
  lLine.setAttribute('d', lowerD); lLine.setAttribute('fill', 'none');
  lLine.setAttribute('stroke', '#74c0fc'); lLine.setAttribute('stroke-width', '1.5');
  lLine.setAttribute('stroke-dasharray', '4,3'); lLine.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(lLine);

  upper.forEach((v, i) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', X(i).toFixed(1)); c.setAttribute('cy', Y(v).toFixed(1));
    c.setAttribute('r', '3'); c.setAttribute('fill', '#74c0fc');
    svg.appendChild(c);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', X(i).toFixed(1)); t.setAttribute('y', (Y(v) - 7).toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9');
    t.setAttribute('fill', '#495057'); t.setAttribute('font-weight', '600');
    t.textContent = v;
    svg.appendChild(t);
  });

  lower.forEach((v, i) => {
    if (i === 0) return;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', X(i).toFixed(1)); c.setAttribute('cy', Y(v).toFixed(1));
    c.setAttribute('r', '2.5'); c.setAttribute('fill', '#fff');
    c.setAttribute('stroke', '#74c0fc'); c.setAttribute('stroke-width', '1.5');
    svg.appendChild(c);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', X(i).toFixed(1)); t.setAttribute('y', (Y(v) + 14).toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#868e96');
    t.textContent = v;
    svg.appendChild(t);
  });

  dates.forEach((d, i) => {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', X(i).toFixed(1)); t.setAttribute('y', H - 6);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#adb5bd');
    t.textContent = d;
    svg.appendChild(t);
  });
}

function drawModalLineChart(data) {
  const svg = document.getElementById('modalLineChart');
  if (!svg) return;
  svg.innerHTML = '';
  if (!data) return;
  const ns = 'http://www.w3.org/2000/svg';
  const ml = 38, mr = 16, mt = 16, mb = 28;
  const W = 520, H = 150;
  const cw = W - ml - mr, ch = H - mt - mb;

  const { dates, upper, lower } = data;
  const allVals = [...upper, ...lower];
  const yMin = Math.floor(Math.min(...allVals) / 5) * 5 - 5;
  const yMax = Math.ceil(Math.max(...allVals) / 5) * 5 + 2;
  const n = dates.length;

  function X(i) { return ml + (i / (n - 1)) * cw; }
  function Y(v) { return mt + ch - ((v - yMin) / (yMax - yMin)) * ch; }

  // 그리드
  [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMin + t * (yMax - yMin))).forEach(v => {
    const y = Y(v);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', ml); line.setAttribute('y1', y.toFixed(1));
    line.setAttribute('x2', W - mr); line.setAttribute('y2', y.toFixed(1));
    line.setAttribute('stroke', '#e9ecef'); line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', ml - 6); t.setAttribute('y', (y + 3).toFixed(1));
    t.setAttribute('text-anchor', 'end'); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#adb5bd');
    t.textContent = v;
    svg.appendChild(t);
  });

  // 채운 영역
  const areaD = [
    ...upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`),
    ...[...lower].reverse().map((v, i) => `L${X(n - 1 - i).toFixed(1)},${Y(v).toFixed(1)}`),
    'Z'
  ].join(' ');
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaD);
  area.setAttribute('fill', 'rgba(116,192,252,0.15)');
  svg.appendChild(area);

  // 상단 선
  const upperD = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const uLine = document.createElementNS(ns, 'path');
  uLine.setAttribute('d', upperD); uLine.setAttribute('fill', 'none');
  uLine.setAttribute('stroke', '#74c0fc'); uLine.setAttribute('stroke-width', '2');
  uLine.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(uLine);

  // 하단 선 (점선)
  const lowerD = lower.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const lLine = document.createElementNS(ns, 'path');
  lLine.setAttribute('d', lowerD); lLine.setAttribute('fill', 'none');
  lLine.setAttribute('stroke', '#74c0fc'); lLine.setAttribute('stroke-width', '1.5');
  lLine.setAttribute('stroke-dasharray', '4,3'); lLine.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(lLine);

  // 데이터 포인트 및 라벨
  upper.forEach((v, i) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', X(i).toFixed(1)); c.setAttribute('cy', Y(v).toFixed(1));
    c.setAttribute('r', '3'); c.setAttribute('fill', '#74c0fc');
    svg.appendChild(c);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', X(i).toFixed(1)); t.setAttribute('y', (Y(v) - 7).toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9');
    t.setAttribute('fill', '#495057'); t.setAttribute('font-weight', '600');
    t.textContent = v;
    svg.appendChild(t);
  });

  lower.forEach((v, i) => {
    if (i === 0) return;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', X(i).toFixed(1)); c.setAttribute('cy', Y(v).toFixed(1));
    c.setAttribute('r', '2.5'); c.setAttribute('fill', '#fff');
    c.setAttribute('stroke', '#74c0fc'); c.setAttribute('stroke-width', '1.5');
    svg.appendChild(c);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', X(i).toFixed(1)); t.setAttribute('y', (Y(v) + 14).toFixed(1));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#868e96');
    t.textContent = v;
    svg.appendChild(t);
  });

  // X축 라벨
  dates.forEach((d, i) => {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', X(i).toFixed(1)); t.setAttribute('y', H - 6);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9'); t.setAttribute('fill', '#adb5bd');
    t.textContent = d;
    svg.appendChild(t);
  });
}

function normalizeCameraSubmitHooks(hooks) {
  if (hooks && typeof hooks === 'object' && ('silent' in hooks || 'onEnd' in hooks || 'sessionData' in hooks)) {
    return hooks;
  }
  return {};
}

async function finishBasicVideoInterviewSubmit(hooks) {
  const ui = normalizeCameraSubmitHooks(hooks);
  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    if (!ui.silent) {
      alert('로그인이 필요합니다.');
      location.href = 'dashboard.html#login';
    }
    return { ok: false, message: 'LOGIN_REQUIRED' };
  }
  const sd = ui.sessionData || {};
  let questionText = '기본 면접';
  let answerText = '기본 면접 화면에서 제출한 연습 답변(텍스트·STT는 추후 연동 예정)';
  if (Array.isArray(sd.questionRecords) && sd.questionRecords.length) {
    questionText = sd.questionRecords
      .map(function (r, i) {
        return '질문' + (i + 1) + ': ' + (r.question || '');
      })
      .join('\n');
    answerText = sd.questionRecords
      .map(function (r, i) {
        return '질문' + (i + 1) + ' 답변: ' + (r.answer || '');
      })
      .join('\n\n');
  } else {
    const labelEl = document.getElementById('vi-q-label');
    const textEl = document.getElementById('vi-q-text');
    const qLabel = (labelEl?.textContent || '').trim();
    const qText = (textEl?.textContent || '').trim();
    questionText = [qLabel, qText].filter(Boolean).join(' ').trim() || questionText;
  }
  try {
    const res = await apiPostInterviewsBasic({ questionText, answerText });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      ui.onEnd?.();
      location.href = 'dashboard.html#login';
      return { ok: false, message: 'UNAUTHORIZED' };
    }
    if (!res.ok) {
      ui.onEnd?.();
      const msg = data.message || '저장에 실패했습니다.';
      if (!ui.silent) alert(msg);
      return { ok: false, message: msg };
    }
    const payload = Object.assign({}, data, {
      questionRecords: sd.questionRecords || null,
      elapsedMs: sd.elapsedMs || null,
      questionCount: sd.questionCount || (sd.questionRecords ? sd.questionRecords.length : 5),
    });
    sessionStorage.setItem('normalInterviewLastResult', JSON.stringify(payload));
    location.href = 'normal-result.html';
    return { ok: true };
  } catch (e) {
    ui.onEnd?.();
    if (e && e.message === 'LOGIN_REQUIRED') {
      location.href = 'dashboard.html#login';
      return { ok: false, message: 'LOGIN_REQUIRED' };
    }
    console.error(e);
    const msg = '서버와 통신할 수 없습니다.';
    if (!ui.silent) alert(msg);
    return { ok: false, message: msg };
  }
}

async function finishRealInterviewSubmit(hooks) {
  const ui = normalizeCameraSubmitHooks(hooks);
  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    if (!ui.silent) {
      alert('로그인이 필요합니다.');
      location.href = 'dashboard.html#login';
    }
    return { ok: false, message: 'LOGIN_REQUIRED' };
  }
  const sd = ui.sessionData || {};
  let questionText = '실전 면접';
  let answerText =
    '실전 면접 화면에서 제출한 연습 답변(텍스트·STT는 추후 연동, 표정·자세·시선은 추후 카메라 AI 분석 API로 대체 예정)';
  if (Array.isArray(sd.questionRecords) && sd.questionRecords.length) {
    questionText = sd.questionRecords
      .map(function (r, i) {
        const iv = r.interviewer || 1;
        return 'AI 면접관 ' + iv + ' 질문' + (i + 1) + ': ' + (r.question || '');
      })
      .join('\n');
    answerText = sd.questionRecords
      .map(function (r, i) {
        return '질문' + (i + 1) + ' 답변: ' + (r.answer || '');
      })
      .join('\n\n');
  } else {
    const infoEl = document.getElementById('bi-q-info');
    questionText = (infoEl?.textContent || '').trim() || questionText;
  }
  try {
    const res = await apiPostInterviewsReal({ questionText, answerText });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      ui.onEnd?.();
      location.href = 'dashboard.html#login';
      return { ok: false, message: 'UNAUTHORIZED' };
    }
    if (!res.ok) {
      ui.onEnd?.();
      const msg = data.message || '저장에 실패했습니다.';
      if (!ui.silent) alert(msg);
      return { ok: false, message: msg };
    }
    const payload = Object.assign({}, data, {
      questionRecords: sd.questionRecords || null,
      elapsedMs: sd.elapsedMs || null,
      questionCount: sd.questionCount || (sd.questionRecords ? sd.questionRecords.length : 12),
    });
    sessionStorage.setItem('basicInterviewLastResult', JSON.stringify(payload));
    location.href = 'basic-result.html';
    return { ok: true };
  } catch (e) {
    ui.onEnd?.();
    if (e && e.message === 'LOGIN_REQUIRED') {
      location.href = 'dashboard.html#login';
      return { ok: false, message: 'LOGIN_REQUIRED' };
    }
    console.error(e);
    const msg = '서버와 통신할 수 없습니다.';
    if (!ui.silent) alert(msg);
    return { ok: false, message: msg };
  }
}

(function initDashboardInterviewApi() {
  async function run() {
    if (!document.getElementById('dashSection')) return;
    if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) return;
    try {
      const [histRes, analRes] = await Promise.all([apiGetInterviewsHistory(), apiGetInterviewsRecentAnalysis()]);
      if (histRes.status === 401 || analRes.status === 401) {
        if (typeof clearStoredAuth === 'function') clearStoredAuth();
        return;
      }
      const histJson = histRes.ok ? await histRes.json().catch(() => ({})) : {};
      let analJson = null;
      if (analRes.ok) analJson = await analRes.json().catch(() => null);

      const hist = histJson.history;
      const modeLabel = m => (m === 'quick' ? '빠른' : m === 'basic' ? '기본' : m === 'real' ? '실전' : m || '-');
      const nextDash = { ...dashboardData };
      if (Array.isArray(hist) && hist.length) {
        nextDash.records = hist.slice(0, 4).map(h => {
          const dt = h.createdAt ? new Date(h.createdAt) : null;
          const dateStr =
            dt && !Number.isNaN(dt.getTime())
              ? `${dt.getMonth() + 1}.${String(dt.getDate()).padStart(2, '0')}`
              : '-';
          return {
            label: modeLabel(h.mode),
            score: h.overallScore != null ? `${h.overallScore}점` : '-',
            date: dateStr,
          };
        });
      }
      const overall = analJson?.analysis?.overallScore;
      if (overall != null) {
        nextDash.attitude = { ...dashboardData.attitude, score: overall };
        nextDash.competency = { ...dashboardData.competency, score: overall };
      }
      renderDashboard(nextDash);

      const a = analJson?.analysis;
      if (a) {
        const fs = document.getElementById('feedback-strength');
        if (fs && a.strengths?.[0]) fs.textContent = a.strengths[0];
        const fw = document.getElementById('feedback-weakness');
        if (fw && a.weaknesses?.[0]) fw.textContent = a.weaknesses[0];
        const fr = document.getElementById('feedback-recommend');
        if (fr && a.recommendation) fr.textContent = a.recommendation;
      }

      try {
        const sumRes = await apiGetInterviewsRecentSummary();
        if (sumRes.status === 401) {
          if (typeof clearStoredAuth === 'function') clearStoredAuth();
        } else if (sumRes.ok) {
          const sj = await sumRes.json().catch(() => ({}));
          const rec = document.getElementById('feedback-recommend');
          if (rec && sj.summary && !(a && a.recommendation)) rec.textContent = sj.summary;
        }
      } catch (_) {}
    } catch (e) {
      if (e && e.message === 'LOGIN_REQUIRED') return;
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

(function initAuthTopbarOnLoad() {
  function run() {
    renderAuthTopbar();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

/** 회원가입 등에서 `dashboard.html#login`으로 온 경우 로그인 모달 자동 오픈 */
(function initOpenLoginFromHash() {
  function tryOpen() {
    if (window.location.hash !== '#login') return;
    openLoginModal();
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryOpen);
  } else {
    tryOpen();
  }
})();

/** `ai-feedback.html`: API로 최근 분석·요약 로드 후 탭·본문 표시 */
(function initAiFeedbackInlinePage() {
  async function run() {
    if (document.body.getAttribute('data-page') !== 'ai-feedback') return;
    await loadAiFeedbackPageFromApi();
    if (!document.getElementById('fbDateTabs')) return;
    if (!feedbackData || !Object.keys(feedbackData).length) return;
    if (!currentFeedbackDate) currentFeedbackDate = Object.keys(feedbackData)[0];
    renderFeedbackTabs(Object.keys(feedbackData));
    renderFeedbackContent(currentFeedbackDate);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

/** `interview-analysis.html`: 면접분석 단독 페이지에 recent/analysis·summary 반영 */
(function initInterviewAnalysisStandaloneApi() {
  async function run() {
    if (!document.getElementById('analysisSection') || document.getElementById('dashSection')) return;
    const sumEl = document.getElementById('an-api-summary');
    if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
      if (sumEl) sumEl.textContent = '로그인 후 최근 면접 분석을 확인할 수 있습니다.';
      const listsEl = document.getElementById('an-api-lists');
      if (listsEl) {
        listsEl.innerHTML =
          '<p style="color:#868e96;font-size:13px;"><a href="dashboard.html#login" style="color:#339af0;font-weight:600;">로그인</a></p>';
      }
      return;
    }
    try {
      const [ar, sr] = await Promise.all([apiGetInterviewsRecentAnalysis(), apiGetInterviewsRecentSummary()]);
      if (ar.status === 401) {
        if (typeof clearStoredAuth === 'function') clearStoredAuth();
        location.href = 'dashboard.html#login';
        return;
      }
      const aj = await ar.json().catch(() => ({}));
      if (ar.status === 404) {
        if (sumEl) sumEl.textContent = aj.message || '최근 면접 기록이 없습니다.';
        const listsEl = document.getElementById('an-api-lists');
        if (listsEl) listsEl.innerHTML = '';
        return;
      }
      if (!ar.ok) {
        if (sumEl) sumEl.textContent = aj.message || '분석을 불러오지 못했습니다.';
        return;
      }
      const sj = sr.ok && sr.status !== 401 ? await sr.json().catch(() => ({})) : {};
      const summaryLine = (sj.summary && String(sj.summary).trim()) || '';
      mergeAnalysisPageFromApiPayload(aj.analysis, summaryLine);
    } catch (e) {
      if (e && e.message === 'LOGIN_REQUIRED') {
        location.href = 'dashboard.html#login';
        return;
      }
      if (sumEl) sumEl.textContent = '서버와 통신할 수 없습니다.';
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
