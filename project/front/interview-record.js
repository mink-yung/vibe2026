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

let irPendingDeleteId = null;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const MODE_LABELS = {
  quick: '빠른면접',
  basic: '기본면접',
  real: '실전면접',
  quick_audio: '빠른면접 음성',
  basic_audio: '기본면접 음성',
};

const PERSONA_LABELS = {
  friendly: '친절한 면접관',
  sharp: '까칠한 면접관',
  pressure: '압박 면접관',
};

function scoreClass(s) {
  if (s >= 90) return 's-green';
  if (s >= 80) return 's-blue';
  return 's-orange';
}

function modeToTypeName(mode) {
  return MODE_LABELS[mode] || mode || '-';
}

function personaToLabel(persona) {
  return PERSONA_LABELS[persona] || persona || '-';
}

function badgeClassFromMode(mode) {
  if (mode === 'quick' || mode === 'quick_audio') return 'quick';
  if (mode === 'basic' || mode === 'basic_audio') return 'basic';
  if (mode === 'real') return 'deep';
  return 'basic';
}

function badgeClass(type) {
  if (type === 'quick') return 'quick';
  if (type === 'basic') return 'basic';
  return 'deep';
}

function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRecordDate(createdAt) {
  const d = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(d.getTime())) {
    return { date: '-', day: '-', full: '-' };
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${y}.${mo}.${da}`,
    day: WEEKDAYS[d.getDay()],
    full: `${y}.${mo}.${da} ${h}:${mi}`,
  };
}

function showIrToast(message, type) {
  const el = document.getElementById('ir-toast');
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'ir-toast';
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = 'ir-toast' + (type === 'error' ? ' ir-toast-error' : ' ir-toast-success');
  clearTimeout(showIrToast._timer);
  showIrToast._timer = setTimeout(() => showIrToast('', ''), 4000);
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

  const tb = document.getElementById('irTableBody');
  if (!tb) return;

  tb.innerHTML = records?.length
    ? records
        .map(
          r => `
        <tr data-interview-id="${escHtml(r.interviewId)}">
          <td><span class="ir-date">${escHtml(r.date)}</span><span class="ir-day">(${escHtml(r.day)})</span></td>
          <td><span class="ir-badge ${badgeClass(r.type)}">${escHtml(r.typeName)}</span></td>
          <td><span class="ir-category">${escHtml(r.category)}</span></td>
          <td><span class="ir-time">${escHtml(r.time)}</span></td>
          <td><span class="ir-score ${scoreClass(r.score)}">${escHtml(r.score)}점</span></td>
          <td>
            <div class="ir-actions">
              <button type="button" class="ir-btn ir-btn-detail" data-interview-id="${escHtml(r.interviewId)}">상세보기</button>
              <button type="button" class="ir-btn ir-btn-delete" data-interview-id="${escHtml(r.interviewId)}">삭제</button>
            </div>
          </td>
        </tr>`
        )
        .join('')
    : '<tr><td colspan="6" style="text-align:center;padding:40px 0;color:#adb5bd;">면접 기록이 없습니다.</td></tr>';
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
    if (Number.isNaN(s)) return;
    if (m === 'quick' || m === 'quick_audio') byMode.quick.push(s);
    if (m === 'basic' || m === 'basic_audio') byMode.basic.push(s);
    if (m === 'real') byMode.real.push(s);
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
    const type = badgeClassFromMode(mode);
    const cat = (h.questionText && String(h.questionText).trim()) || (h.summary && String(h.summary).slice(0, 40)) || '-';
    const sc = Number(h.overallScore);
    return {
      interviewId: h.interviewId,
      mode,
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

function renderDetailModalContent(interview) {
  const iv = interview || {};
  const dt = formatRecordDate(iv.createdAt);
  const score = iv.overallScore != null ? Number(iv.overallScore) : null;
  const feedbacks = Array.isArray(iv.feedbacks) ? iv.feedbacks : [];

  const feedbackHtml = feedbacks.length
    ? feedbacks
        .map(
          (fb, i) => `
      <div class="ir-feedback-block">
        <div class="ir-feedback-persona">${escHtml(personaToLabel(fb.persona))}${feedbacks.length > 1 ? ' (' + (i + 1) + ')' : ''}</div>
        <div class="ir-detail-field">
          <div class="ir-detail-label">피드백</div>
          <div class="ir-detail-value">${escHtml(fb.feedback || '-')}</div>
        </div>
        <div class="ir-detail-field" style="margin-bottom:0;">
          <div class="ir-detail-label">다음 질문</div>
          <div class="ir-detail-value">${escHtml(fb.nextQuestion || '-')}</div>
        </div>
      </div>`
        )
        .join('')
    : '<p class="ir-detail-value">피드백이 없습니다.</p>';

  return `
    <div class="ir-detail-field">
      <div class="ir-detail-label">면접 유형</div>
      <div class="ir-detail-value">${escHtml(modeToTypeName(iv.mode))}</div>
    </div>
    <div class="ir-detail-field">
      <div class="ir-detail-label">생성일</div>
      <div class="ir-detail-value">${escHtml(dt.full)}</div>
    </div>
    <div class="ir-detail-field">
      <div class="ir-detail-label">점수</div>
      <div class="ir-detail-value">${score != null && !Number.isNaN(score) ? escHtml(score) + '점' : '-'}</div>
    </div>
    <div class="ir-detail-field">
      <div class="ir-detail-label">질문</div>
      <div class="ir-detail-value">${escHtml(iv.questionText || '-')}</div>
    </div>
    <div class="ir-detail-field">
      <div class="ir-detail-label">답변</div>
      <div class="ir-detail-value">${escHtml(iv.answerText || '-')}</div>
    </div>
    <div class="ir-detail-field">
      <div class="ir-detail-label">요약</div>
      <div class="ir-detail-value">${escHtml(iv.summary || '-')}</div>
    </div>
    <div class="ir-detail-field ir-detail-feedbacks">
      <div class="ir-detail-label">면접관 피드백</div>
      ${feedbackHtml}
    </div>
  `;
}

function openIrDetailModal(interviewId) {
  const modal = document.getElementById('irDetailModal');
  const body = document.getElementById('ir-detail-body');
  if (!modal || !body) return;

  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    showIrToast('로그인이 필요합니다.', 'error');
    if (typeof openLoginModal === 'function') openLoginModal();
    else location.href = 'dashboard.html#login';
    return;
  }

  body.innerHTML = '<p class="ir-detail-loading">불러오는 중…</p>';
  modal.classList.add('open');

  getInterviewDetail(interviewId)
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        if (typeof clearStoredAuth === 'function') clearStoredAuth();
        closeIrDetailModal();
        location.href = 'dashboard.html#login';
        return;
      }
      if (!res.ok) {
        body.innerHTML = `<p class="ir-detail-loading">${escHtml(data.message || '상세 정보를 불러오지 못했습니다.')}</p>`;
        return;
      }
      if (!data.interview) {
        body.innerHTML = '<p class="ir-detail-loading">면접 기록을 찾을 수 없습니다.</p>';
        return;
      }
      body.innerHTML = renderDetailModalContent(data.interview);
    })
    .catch(e => {
      if (e && e.message === 'LOGIN_REQUIRED') {
        closeIrDetailModal();
        location.href = 'dashboard.html#login';
        return;
      }
      body.innerHTML = '<p class="ir-detail-loading">서버와 통신할 수 없습니다.</p>';
    });
}

function closeIrDetailModal() {
  const modal = document.getElementById('irDetailModal');
  if (modal) modal.classList.remove('open');
}

function irDetailModalOutside(e) {
  if (e.target.id === 'irDetailModal') closeIrDetailModal();
}

function openIrDeleteModal(interviewId) {
  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    showIrToast('로그인이 필요합니다.', 'error');
    if (typeof openLoginModal === 'function') openLoginModal();
    else location.href = 'dashboard.html#login';
    return;
  }
  irPendingDeleteId = interviewId;
  const modal = document.getElementById('irDeleteModal');
  if (modal) modal.classList.add('open');
}

function closeIrDeleteModal() {
  irPendingDeleteId = null;
  const modal = document.getElementById('irDeleteModal');
  if (modal) modal.classList.remove('open');
}

function irDeleteModalOutside(e) {
  if (e.target.id === 'irDeleteModal') closeIrDeleteModal();
}

async function confirmIrDelete() {
  const id = irPendingDeleteId;
  if (id == null) return;

  const confirmBtn = document.querySelector('.ir-delete-confirm');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const res = await deleteInterview(id);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      closeIrDeleteModal();
      location.href = 'dashboard.html#login';
      return;
    }

    if (!res.ok) {
      showIrToast(data.message || '삭제에 실패했습니다.', 'error');
      return;
    }

    closeIrDeleteModal();
    showIrToast(data.message || '면접 기록이 삭제되었습니다.', 'success');
    await loadInterviewRecordPage();
  } catch (e) {
    if (e && e.message === 'LOGIN_REQUIRED') {
      location.href = 'dashboard.html#login';
      return;
    }
    showIrToast('서버와 통신할 수 없습니다.', 'error');
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function bindInterviewRecordTableActions() {
  const tb = document.getElementById('irTableBody');
  if (!tb || tb.dataset.irBound === '1') return;
  tb.dataset.irBound = '1';
  tb.addEventListener('click', e => {
    const detailBtn = e.target.closest('.ir-btn-detail');
    const deleteBtn = e.target.closest('.ir-btn-delete');
    if (detailBtn) {
      const id = detailBtn.getAttribute('data-interview-id');
      if (id) openIrDetailModal(id);
    }
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-interview-id');
      if (id) openIrDeleteModal(id);
    }
  });
}

async function loadInterviewRecordPage() {
  const tb = document.getElementById('irTableBody');
  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    renderInterviewRecord({ stats: interviewRecordData.stats, types: [], records: [] });
    if (tb) {
      tb.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:40px 0;color:#adb5bd;">' +
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
        tb.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px 0;color:#adb5bd;">${escHtml(data.message || '기록을 불러오지 못했습니다.')}</td></tr>`;
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

function initInterviewRecordPage() {
  if (!document.getElementById('irSection')) return;
  bindInterviewRecordTableActions();
  loadInterviewRecordPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInterviewRecordPage);
} else {
  initInterviewRecordPage();
}
