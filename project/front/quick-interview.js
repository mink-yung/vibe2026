function setActive(el) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

const heights = [8, 14, 22, 30, 18, 26, 34, 20, 28, 12, 32, 24, 10, 30, 22, 34, 16, 26, 12, 30, 20, 24, 32, 14, 28, 22, 18, 26, 10, 30, 24, 20];
const wf = document.getElementById('waveform');
if (wf) {
  heights.forEach(h => {
    const span = document.createElement('span');
    span.style.height = h + 'px';
    wf.appendChild(span);
  });
}

async function finishQuickInterviewSubmit() {
  if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
    alert('로그인이 필요합니다.');
    location.href = 'dashboard.html#login';
    return;
  }
  const qEl = document.getElementById('qi-question');
  const subEl = document.getElementById('qi-question-sub');
  const q = (qEl?.textContent || '').trim();
  const sub = (subEl?.textContent || '').trim();
  const answerText =
    q && q !== '-'
      ? [sub ? `(${sub})` : '', q, '', '(음성 STT 연동 전: 화면 기준 질문·답변 요약 제출)'].filter(Boolean).join('\n')
      : '빠른면접 연습 답변 제출';
  try {
    const res = await apiPostInterviewsQuick({ answerText });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      location.href = 'dashboard.html#login';
      return;
    }
    if (!res.ok) {
      alert(data.message || '저장에 실패했습니다.');
      return;
    }
    sessionStorage.setItem(
      'quickInterviewLastResult',
      JSON.stringify({
        overallScore: data.overallScore,
        summary: data.summary,
        feedback: data.feedback,
        nextQuestion: data.nextQuestion,
      })
    );
    location.href = 'quick-result.html';
  } catch (e) {
    if (e && e.message === 'LOGIN_REQUIRED') {
      location.href = 'dashboard.html#login';
      return;
    }
    console.error(e);
    alert('서버와 통신할 수 없습니다.');
  }
}
