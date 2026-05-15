const quickQuestions = [
  '자기소개를 해주세요.',
  '팀 프로젝트에서 본인이 맡은 역할은 무엇인가요?',
  '본인의 강점과 보완할 점을 말해주세요.',
];

const QUICK_QUESTION_COUNT = quickQuestions.length;

const state = {
  currentQuestionIndex: 0,
  isStarted: false,
  isListening: false,
  transcripts: ['', '', ''],
  currentTranscript: '',
  isSubmitting: false,
  result: null,
  error: null,
  selectedLang: 'ko-KR',
};

let recognition = null;
let recognitionFinalBuffer = '';
let interviewTimerId = null;
let interviewStartedAt = null;

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function $(id) {
  return document.getElementById(id);
}

function setError(message) {
  state.error = message || null;
  const el = $('qi-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

function setStatus(text) {
  const el = $('qi-status');
  if (el) el.textContent = text || '';
}

function setVoiceNote(text) {
  const el = $('qi-voice-note-text');
  if (el) el.textContent = text || '';
}

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startInterviewTimer() {
  interviewStartedAt = Date.now();
  const timerEl = $('qi-timer');
  if (interviewTimerId) clearInterval(interviewTimerId);
  interviewTimerId = setInterval(() => {
    if (timerEl && interviewStartedAt) {
      timerEl.textContent = formatElapsed(Date.now() - interviewStartedAt);
    }
  }, 1000);
}

function stopInterviewTimer() {
  if (interviewTimerId) {
    clearInterval(interviewTimerId);
    interviewTimerId = null;
  }
}

function updateProgress() {
  const idx = state.isStarted ? state.currentQuestionIndex : 0;
  const label = $('qi-progress');
  const bar = $('qi-progress-bar');
  if (label) {
    label.textContent = state.isStarted
      ? `질문 ${Math.min(idx + 1, QUICK_QUESTION_COUNT)} / ${QUICK_QUESTION_COUNT}`
      : '-';
  }
  if (bar) {
    const pct = state.isStarted
      ? Math.min(100, ((idx + (state.isListening ? 0.3 : 0.85)) / QUICK_QUESTION_COUNT) * 100)
      : 0;
    bar.style.width = `${pct}%`;
  }
}

function updateQuestionDisplay() {
  const qEl = $('qi-question');
  const subEl = $('qi-question-sub');
  if (!state.isStarted) {
    if (qEl) qEl.textContent = '면접 시작 버튼을 눌러 주세요.';
    if (subEl) subEl.textContent = '';
    return;
  }
  if (state.isSubmitting || state.currentQuestionIndex >= QUICK_QUESTION_COUNT) {
    if (qEl) qEl.textContent = '모든 질문에 답변했습니다.';
    if (subEl) subEl.textContent = '';
    return;
  }
  if (qEl) qEl.textContent = quickQuestions[state.currentQuestionIndex];
  if (subEl) subEl.textContent = '마이크에 대고 답변해 주세요.';
}

function updateLiveTranscript() {
  const el = $('qi-live-transcript');
  if (!el) return;
  if (!state.isStarted || state.isSubmitting) {
    el.textContent = '';
    return;
  }
  if (state.currentTranscript) {
    el.textContent = state.currentTranscript;
  } else if (state.isListening) {
    el.textContent = '음성을 인식하는 중…';
  } else {
    el.textContent = '';
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAnswersLog() {
  const el = $('qi-answers-log');
  if (!el) return;
  const parts = [];
  for (let i = 0; i < state.currentQuestionIndex; i++) {
    const ans = (state.transcripts[i] || '').trim();
    if (!ans) continue;
    parts.push(
      '<div class="qi-answer-item">' +
        '<div class="qi-answer-q">질문 ' +
        (i + 1) +
        '. ' +
        escapeHtml(quickQuestions[i]) +
        '</div>' +
        '<div class="qi-answer-a">' +
        escapeHtml(ans) +
        '</div></div>'
    );
  }
  el.innerHTML = parts.join('');
}

function setWaveformActive(active) {
  const wf = $('waveform');
  if (wf) wf.classList.toggle('qi-waveform-active', !!active);
}

function updateUi() {
  const startBtn = $('qi-start-btn');
  const stopBtn = $('qi-stop-btn');
  const langSelect = $('qi-lang-select');

  if (startBtn) {
    startBtn.hidden = state.isStarted;
    startBtn.disabled = state.isSubmitting || !SpeechRecognitionCtor;
  }

  if (stopBtn) {
    stopBtn.hidden = !state.isStarted;
    stopBtn.disabled = state.isSubmitting || state.currentQuestionIndex >= QUICK_QUESTION_COUNT;
    if (state.isSubmitting) {
      stopBtn.textContent = '피드백 생성 중…';
    } else {
      stopBtn.innerHTML = '■&nbsp; 답변 중지';
    }
  }

  if (langSelect) {
    langSelect.disabled = state.isStarted && (state.isListening || state.isSubmitting);
    langSelect.value = state.selectedLang;
  }

  const voiceIcon = document.querySelector('.voice-icon');
  if (voiceIcon) voiceIcon.classList.toggle('qi-mic-active', state.isListening);

  setWaveformActive(state.isListening);

  if (state.isSubmitting) {
    setStatus('피드백 생성 중…');
    setVoiceNote('AI가 답변을 분석하고 있습니다. 잠시만 기다려 주세요.');
  } else if (state.isListening) {
    setStatus('답변 중…');
    setVoiceNote('답변이 끝나면 「답변 중지」를 눌러 다음 질문으로 이동하세요.');
  } else if (state.isStarted) {
    setStatus('');
    setVoiceNote('질문을 읽고 답변을 시작하면 음성 인식이 자동으로 진행됩니다.');
  } else {
    setStatus('');
    setVoiceNote('면접 시작 후 질문이 표시되고 음성 인식이 진행됩니다.');
  }

  updateProgress();
  updateQuestionDisplay();
  updateLiveTranscript();
  renderAnswersLog();
}

function initSpeechUnsupportedBanner() {
  const banner = $('qi-speech-unsupported');
  if (!banner) return;
  banner.hidden = !!SpeechRecognitionCtor;
}

function createRecognition() {
  if (!SpeechRecognitionCtor) return null;
  const r = new SpeechRecognitionCtor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = state.selectedLang;

  r.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        recognitionFinalBuffer += piece;
      } else {
        interim += piece;
      }
    }
    state.currentTranscript = (recognitionFinalBuffer + interim).trim();
    updateLiveTranscript();
  };

  r.onerror = (event) => {
    state.isListening = false;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setError('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.');
    } else if (event.error === 'no-speech') {
      setError('음성이 감지되지 않았습니다. 다시 말씀해 주세요.');
    } else if (event.error !== 'aborted') {
      setError('음성 인식 오류: ' + event.error);
    }
    updateUi();
  };

  r.onend = () => {
    if (state.isListening && recognition === r) {
      try {
        r.start();
      } catch (_) {
        state.isListening = false;
        updateUi();
      }
    }
  };

  return r;
}

function startListening() {
  if (!SpeechRecognitionCtor) {
    setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 사용을 권장합니다.');
    return;
  }
  setError(null);
  recognitionFinalBuffer = '';
  state.currentTranscript = '';
  recognition = createRecognition();
  if (!recognition) return;

  try {
    recognition.start();
    state.isListening = true;
    updateUi();
  } catch (e) {
    setError('음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    console.error(e);
  }
}

function stopListening() {
  state.isListening = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {}
    recognition = null;
  }
  updateUi();
}

function requireLogin() {
  if (typeof getStoredAuthToken === 'function' && getStoredAuthToken()) return true;
  setError('로그인이 필요합니다.');
  if (typeof openLoginModal === 'function') {
    openLoginModal();
  } else {
    location.href = 'dashboard.html#login';
  }
  return false;
}

function onStartInterview() {
  if (!requireLogin()) return;
  if (!SpeechRecognitionCtor) {
    setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 사용을 권장합니다.');
    return;
  }
  setError(null);
  state.isStarted = true;
  state.currentQuestionIndex = 0;
  state.transcripts = ['', '', ''];
  state.currentTranscript = '';
  state.isSubmitting = false;
  state.result = null;
  startInterviewTimer();
  updateUi();
  startListening();
}

function buildCombinedPayload() {
  const questionText = quickQuestions.map((q, i) => '질문' + (i + 1) + ': ' + q).join('\n');
  const transcript = quickQuestions
    .map((q, i) => '질문' + (i + 1) + ' 답변: ' + state.transcripts[i])
    .join('\n\n');
  return { questionText, transcript };
}

function saveQuickResultAndGo(data) {
  const elapsedMs = interviewStartedAt ? Date.now() - interviewStartedAt : null;
  const questionRecords = quickQuestions.map(function (q, i) {
    return { question: q, answer: state.transcripts[i] || '' };
  });
  sessionStorage.setItem(
    'quickInterviewLastResult',
    JSON.stringify({
      interviewId: data.interviewId,
      mode: data.mode || 'quick_audio',
      overallScore: data.overallScore,
      summary: data.summary,
      feedback: data.feedback,
      nextQuestion: data.nextQuestion,
      questionText: data.questionText,
      answerText: data.answerText || data.transcript,
      elapsedMs: elapsedMs,
      questionCount: QUICK_QUESTION_COUNT,
      questionRecords: questionRecords,
    })
  );
  location.href = 'quick-result.html';
}

async function submitQuickAudioInterview() {
  if (state.isSubmitting) return;
  if (!requireLogin()) return;

  state.isSubmitting = true;
  setError(null);
  updateUi();

  try {
    const res = await createQuickAudioInterview(buildCombinedPayload());
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      state.isSubmitting = false;
      if (typeof openLoginModal === 'function') openLoginModal();
      else location.href = 'dashboard.html#login';
      updateUi();
      return;
    }

    if (!res.ok) {
      state.isSubmitting = false;
      setError(data.message || '피드백 생성에 실패했습니다.');
      updateUi();
      return;
    }

    state.result = data;
    stopInterviewTimer();
    saveQuickResultAndGo(data);
  } catch (e) {
    state.isSubmitting = false;
    if (e && e.message === 'LOGIN_REQUIRED') {
      setError('로그인이 필요합니다.');
      if (typeof openLoginModal === 'function') openLoginModal();
      else location.href = 'dashboard.html#login';
    } else {
      console.error(e);
      setError('서버와 통신할 수 없습니다.');
    }
    updateUi();
  }
}

function onStopAnswerClick() {
  if (!state.isStarted || state.isSubmitting) return;

  if (!state.isListening) {
    startListening();
    return;
  }

  stopListening();
  const text = state.currentTranscript.trim();
  if (!text) {
    setError('답변이 인식되지 않았습니다. 다시 답변해주세요.');
    startListening();
    return;
  }

  state.transcripts[state.currentQuestionIndex] = text;
  state.currentTranscript = '';
  recognitionFinalBuffer = '';

  const nextIndex = state.currentQuestionIndex + 1;
  state.currentQuestionIndex = nextIndex;

  if (nextIndex >= QUICK_QUESTION_COUNT) {
    updateUi();
    submitQuickAudioInterview();
    return;
  }

  updateUi();
  startListening();
}

function onLangChange() {
  const sel = $('qi-lang-select');
  if (!sel) return;
  state.selectedLang = sel.value === 'en-US' ? 'en-US' : 'ko-KR';
  if (state.isListening) {
    stopListening();
    startListening();
  }
}

function initWaveform() {
  const wf = $('waveform');
  if (!wf || wf.childElementCount) return;
  const heights = [8, 14, 22, 30, 18, 26, 34, 20, 28, 12, 32, 24, 10, 30, 22, 34, 16, 26, 12, 30, 20, 24, 32, 14, 28, 22, 18, 26, 10, 30, 24, 20];
  heights.forEach((h) => {
    const span = document.createElement('span');
    span.style.height = h + 'px';
    wf.appendChild(span);
  });
}

function bindQuickInterviewUi() {
  const startBtn = $('qi-start-btn');
  const stopBtn = $('qi-stop-btn');
  const langSelect = $('qi-lang-select');
  if (startBtn) startBtn.addEventListener('click', onStartInterview);
  if (stopBtn) stopBtn.addEventListener('click', onStopAnswerClick);
  if (langSelect) langSelect.addEventListener('change', onLangChange);
}

/** 레거시 텍스트 빠른면접 (POST /api/interviews/quick) */
async function finishQuickInterviewSubmit() {
  if (!requireLogin()) return;
  const answerText = '빠른면접 연습 답변 제출';
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
        mode: data.mode || 'quick',
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

function initQuickInterviewPage() {
  if (!$('quickInterviewSection')) return;
  initWaveform();
  initSpeechUnsupportedBanner();
  bindQuickInterviewUi();
  updateUi();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQuickInterviewPage);
} else {
  initQuickInterviewPage();
}
