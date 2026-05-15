/** 기본/실전 면접 카메라 UI (영상 파일 업로드·AI 영상 분석 없음) */
let activeCameraStream = null;
let activeCameraConfig = null;

/** 페이지(기본/실전)별 상태 — 전역 공유 시 다른 섹션 init이 상태를 리셋할 수 있음 */
const cameraInterviewStates = new WeakMap();

const END_ANSWER_ENABLE_DELAY_MS = 400;

function getCameraInterviewState(cfg) {
  if (!cfg) {
    return {
      isStarted: false,
      isRecording: false,
      isSubmitting: false,
      endActionsEnabled: false,
    };
  }
  if (!cameraInterviewStates.has(cfg)) {
    cameraInterviewStates.set(cfg, {
      isStarted: false,
      isRecording: false,
      isSubmitting: false,
      endActionsEnabled: false,
      currentQuestionIndex: 0,
      answers: [],
    });
  }
  return cameraInterviewStates.get(cfg);
}

function stopActiveCameraInterviewStream() {
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(t => {
      try {
        t.stop();
      } catch (_) {}
    });
    activeCameraStream = null;
  }
  const cfg = activeCameraConfig;
  if (cfg?.videoEl) {
    cfg.videoEl.srcObject = null;
  }
  if (cfg?.avatarEl) cfg.avatarEl.style.display = '';
}

function formatInterviewTimer(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setCamError(cfg, message) {
  if (!cfg.errorEl) return;
  if (message) {
    cfg.errorEl.textContent = message;
    cfg.errorEl.hidden = false;
  } else {
    cfg.errorEl.textContent = '';
    cfg.errorEl.hidden = true;
  }
}

function updateCameraInterviewUi(cfg) {
  const state = getCameraInterviewState(cfg);
  const { isStarted, isRecording, isSubmitting, endActionsEnabled } = state;
  const showEndAnswer = isRecording && !isSubmitting && endActionsEnabled;

  if (cfg.startBtn) {
    cfg.startBtn.hidden = isStarted || isSubmitting;
    cfg.startBtn.disabled = isSubmitting || (cfg.errorEl && !cfg.errorEl.hidden);
  }
  const endBtns = [cfg.endAnswerBtn, cfg.endAnswerBtnTop].filter(Boolean);
  endBtns.forEach(btn => {
    btn.hidden = !showEndAnswer;
    btn.disabled = isSubmitting || !endActionsEnabled;
    btn.style.pointerEvents = showEndAnswer ? '' : 'none';
  });
  if (cfg.recBadge) {
    cfg.recBadge.hidden = !isRecording || isSubmitting;
  }
  if (cfg.userWrap) {
    cfg.userWrap.classList.toggle('cam-recording', isRecording && !isSubmitting);
  }
}

function getQuestionItem(cfg, idx) {
  const raw = cfg.questions?.[idx];
  if (raw && typeof raw === 'object') return raw;
  return { interviewer: 1, question: raw || '' };
}

function collectCameraAnswer(cfg, questionItem) {
  const q = typeof questionItem === 'object' ? questionItem.question : questionItem;
  let answer = '';
  if (typeof cfg.getTranscript === 'function') {
    answer = (cfg.getTranscript() || '').trim();
  } else if (cfg.transcriptEl) {
    answer = (cfg.transcriptEl.textContent || '').trim();
  }
  if (!answer) {
    answer =
      cfg.placeholderAnswer ||
      '면접 답변(음성 인식 미연동 — 추후 STT·카메라 AI 분석 연동 예정)';
  }
  if (typeof cfg.resetTranscript === 'function') cfg.resetTranscript();
  return {
    question: q,
    answer: answer,
    interviewer: questionItem && questionItem.interviewer,
  };
}

function updateQuestionDisplay(cfg) {
  const state = getCameraInterviewState(cfg);
  const total = cfg.questions?.length || 1;
  const idx = state.currentQuestionIndex || 0;
  const item = getQuestionItem(cfg, idx);
  const qText = item.question || '';

  if (cfg.qProgressEl) {
    cfg.qProgressEl.textContent = idx + 1 + ' / ' + total;
  }
  if (cfg.qInfoEl) {
    cfg.qInfoEl.textContent = 'Q' + (idx + 1) + '/' + total + ' | ' + qText;
  }

  if (cfg.mode === 'real' && cfg.interviewerPanels) {
    [1, 2, 3].forEach(function (n) {
      const panel = cfg.interviewerPanels[n];
      const caption = cfg.interviewerCaptions && cfg.interviewerCaptions[n];
      const isActive = item.interviewer === n;
      if (panel) panel.classList.toggle('active', isActive);
      if (caption) {
        if (isActive && state.isStarted) {
          caption.textContent = qText;
          caption.hidden = false;
        } else {
          caption.textContent = '';
          caption.hidden = true;
        }
      }
    });
    return;
  }

  if (cfg.qLabelEl) cfg.qLabelEl.textContent = 'Q' + (idx + 1);
  if (cfg.qTextEl) cfg.qTextEl.textContent = qText;
  if (cfg.captionWrapEl) {
    cfg.captionWrapEl.hidden = !state.isStarted;
  }
}

function scheduleEnableEndAnswerActions(cfg) {
  const state = getCameraInterviewState(cfg);
  if (cfg.endEnableTimerId) {
    clearTimeout(cfg.endEnableTimerId);
    cfg.endEnableTimerId = null;
  }
  state.endActionsEnabled = false;
  updateCameraInterviewUi(cfg);
  cfg.endEnableTimerId = setTimeout(() => {
    cfg.endEnableTimerId = null;
    if (!state.isRecording || state.isSubmitting) return;
    state.endActionsEnabled = true;
    updateCameraInterviewUi(cfg);
  }, END_ANSWER_ENABLE_DELAY_MS);
}

function showCameraAnalyzing(cfg, message) {
  if (cfg.analyzingTextEl) cfg.analyzingTextEl.textContent = message || cfg.analyzingDefaultText;
  if (cfg.analyzingErrorEl) {
    cfg.analyzingErrorEl.hidden = true;
    cfg.analyzingErrorEl.textContent = '';
  }
  if (cfg.analyzingRetryBtn) cfg.analyzingRetryBtn.hidden = true;
  if (cfg.analyzingOverlay) cfg.analyzingOverlay.hidden = false;
}

function hideCameraAnalyzing(cfg) {
  if (cfg.analyzingOverlay) cfg.analyzingOverlay.hidden = true;
  if (cfg.analyzingRetryBtn) cfg.analyzingRetryBtn.hidden = true;
}

function showCameraAnalyzingError(cfg, message) {
  if (cfg.analyzingTextEl) cfg.analyzingTextEl.textContent = cfg.analyzingDefaultText;
  if (cfg.analyzingErrorEl) {
    cfg.analyzingErrorEl.textContent = message || '요청에 실패했습니다.';
    cfg.analyzingErrorEl.hidden = false;
  }
  if (cfg.analyzingRetryBtn) cfg.analyzingRetryBtn.hidden = false;
  if (cfg.analyzingOverlay) cfg.analyzingOverlay.hidden = false;
}

async function requestCameraStream(cfg) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCamError(cfg, '이 브라우저는 카메라를 지원하지 않습니다. Chrome 사용을 권장합니다.');
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    activeCameraStream = stream;
    activeCameraConfig = cfg;
    if (cfg.videoEl) {
      cfg.videoEl.srcObject = stream;
      cfg.videoEl.hidden = false;
    }
    if (cfg.avatarEl) cfg.avatarEl.style.display = 'none';
    setCamError(cfg, null);
    return stream;
  } catch (e) {
    console.error(e);
    if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
      setCamError(cfg, '카메라·마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.');
    } else {
      setCamError(cfg, '카메라를 시작할 수 없습니다. 다른 프로그램에서 사용 중인지 확인해 주세요.');
    }
    return null;
  }
}

async function onCameraInterviewStart(cfg, event) {
  const state = getCameraInterviewState(cfg);
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (state.isSubmitting) return;
  if (typeof getStoredAuthToken === 'function' && !getStoredAuthToken()) {
    setCamError(cfg, '로그인이 필요합니다.');
    if (typeof openLoginModal === 'function') openLoginModal();
    else location.href = 'dashboard.html#login';
    return;
  }

  setCamError(cfg, null);
  const stream = await requestCameraStream(cfg);
  if (!stream) return;

  state.isStarted = true;
  state.isRecording = true;
  state.endActionsEnabled = false;
  cfg.interviewStartedAt = Date.now();

  if (cfg.timerEl) {
    if (cfg.timerIntervalId) clearInterval(cfg.timerIntervalId);
    cfg.timerIntervalId = setInterval(() => {
      if (cfg.timerEl && cfg.interviewStartedAt) {
        cfg.timerEl.textContent = formatInterviewTimer(Date.now() - cfg.interviewStartedAt);
      }
    }, 1000);
    cfg.timerEl.textContent = '00:00';
  }

  if (cfg.multiQuestion) {
    state.currentQuestionIndex = 0;
    updateQuestionDisplay(cfg);
  }

  updateCameraInterviewUi(cfg);
  scheduleEnableEndAnswerActions(cfg);
}

async function onCameraInterviewEndAnswer(cfg, event) {
  const state = getCameraInterviewState(cfg);
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (!state.isStarted || !state.isRecording || state.isSubmitting || !state.endActionsEnabled) {
    return;
  }
  if (typeof cfg.submitFn !== 'function') return;

  if (cfg.endEnableTimerId) {
    clearTimeout(cfg.endEnableTimerId);
    cfg.endEnableTimerId = null;
  }

  if (cfg.multiQuestion && cfg.questions?.length) {
    const item = getQuestionItem(cfg, state.currentQuestionIndex);
    state.answers.push(collectCameraAnswer(cfg, item));
    if (state.currentQuestionIndex < cfg.questions.length - 1) {
      state.currentQuestionIndex += 1;
      updateQuestionDisplay(cfg);
      scheduleEnableEndAnswerActions(cfg);
      return;
    }
  }

  state.isSubmitting = true;
  state.isRecording = false;
  state.endActionsEnabled = false;
  updateCameraInterviewUi(cfg);
  showCameraAnalyzing(cfg, cfg.analyzingDefaultText);

  const elapsedMs = cfg.interviewStartedAt ? Date.now() - cfg.interviewStartedAt : null;
  const sessionData = {
    elapsedMs: elapsedMs,
    questionCount: cfg.questions?.length || state.answers.length || 1,
  };
  if (state.answers.length) {
    sessionData.answers = state.answers;
    sessionData.questionRecords = state.answers.map(function (a) {
      return {
        question: a.question,
        answer: a.answer,
        interviewer: a.interviewer,
      };
    });
  }
  const result = await cfg.submitFn({
    silent: true,
    sessionData: sessionData,
    onEnd: () => {
      state.isSubmitting = false;
      updateCameraInterviewUi(cfg);
    },
  });

  if (result && result.ok) {
    stopActiveCameraInterviewStream();
    hideCameraAnalyzing(cfg);
    return;
  }

  state.isSubmitting = false;
  state.isRecording = true;
  scheduleEnableEndAnswerActions(cfg);
  showCameraAnalyzingError(cfg, (result && result.message) || '저장에 실패했습니다. 다시 시도해 주세요.');
}

function initCameraInterviewPage(cfg) {
  if (!cfg || !cfg.sectionEl) return;
  if (cfg.sectionEl.dataset.camInterviewBound === '1') return;
  cfg.sectionEl.dataset.camInterviewBound = '1';

  activeCameraConfig = cfg;
  const state = getCameraInterviewState(cfg);
  state.isStarted = false;
  state.isRecording = false;
  state.isSubmitting = false;
  state.endActionsEnabled = false;
  state.currentQuestionIndex = 0;
  state.answers = [];

  hideCameraAnalyzing(cfg);
  if (cfg.multiQuestion) {
    if (cfg.captionWrapEl) cfg.captionWrapEl.hidden = true;
    if (cfg.interviewerPanels) {
      [1, 2, 3].forEach(function (n) {
        const panel = cfg.interviewerPanels[n];
        const caption = cfg.interviewerCaptions && cfg.interviewerCaptions[n];
        if (panel) panel.classList.remove('active');
        if (caption) {
          caption.textContent = '';
          caption.hidden = true;
        }
      });
    }
  }

  if (cfg.startBtn && cfg.startBtn.dataset.camClickBound !== '1') {
    cfg.startBtn.dataset.camClickBound = '1';
    cfg.startBtn.addEventListener('click', e => onCameraInterviewStart(cfg, e));
  }
  [cfg.endAnswerBtn, cfg.endAnswerBtnTop].filter(Boolean).forEach(btn => {
    if (btn.dataset.camClickBound === '1') return;
    btn.dataset.camClickBound = '1';
    btn.addEventListener('click', e => onCameraInterviewEndAnswer(cfg, e));
  });
  if (cfg.exitBtn && cfg.exitBtn.dataset.camClickBound !== '1') {
    cfg.exitBtn.dataset.camClickBound = '1';
    cfg.exitBtn.addEventListener('click', e => {
      e.preventDefault();
      stopActiveCameraInterviewStream();
      location.href = 'mock-interview.html';
    });
  }
  if (cfg.analyzingRetryBtn && cfg.analyzingRetryBtn.dataset.camClickBound !== '1') {
    cfg.analyzingRetryBtn.dataset.camClickBound = '1';
    cfg.analyzingRetryBtn.addEventListener('click', () => {
      hideCameraAnalyzing(cfg);
      onCameraInterviewEndAnswer(cfg);
    });
  }

  updateCameraInterviewUi(cfg);

  if (!window.__camInterviewUnloadBound) {
    window.__camInterviewUnloadBound = true;
    window.addEventListener('beforeunload', stopActiveCameraInterviewStream);
    window.addEventListener('pagehide', stopActiveCameraInterviewStream);
  }
}

function buildVideoInterviewCameraConfig() {
  const section = document.getElementById('videoInterviewSection');
  if (!section) return null;

  const questions =
    typeof BASIC_INTERVIEW_QUESTIONS !== 'undefined'
      ? BASIC_INTERVIEW_QUESTIONS
      : ['자기소개를 해주세요.'];

  const captionWrap = section.querySelector('.vi-interviewer-caption-overlay');

  const cfg = {
    sectionEl: section,
    mode: 'basic',
    videoEl: document.getElementById('vi-user-video'),
    avatarEl: section.querySelector('.vi-video-wrap.user .vi-avatar'),
    userWrap: section.querySelector('.vi-video-wrap.user'),
    startBtn: document.getElementById('vi-cam-start'),
    endAnswerBtn: document.getElementById('vi-cam-end-answer'),
    endAnswerBtnTop: null,
    exitBtn: document.getElementById('vi-exit-interview'),
    qLabelEl: document.getElementById('vi-q-label'),
    qTextEl: document.getElementById('vi-q-text'),
    qInfoEl: document.getElementById('vi-q-info'),
    qProgressEl: document.getElementById('vi-q-progress'),
    captionWrapEl: captionWrap,
    questions: questions,
    multiQuestion: true,
    placeholderAnswer:
      '기본 면접 답변(텍스트·STT는 추후 연동, 표정·자세·시선은 추후 카메라 AI 분석 API로 대체 예정)',
    recBadge: document.getElementById('vi-rec-badge'),
    errorEl: document.getElementById('vi-cam-error'),
    analyzingOverlay: document.getElementById('vi-analyzing-overlay'),
    analyzingTextEl: document.getElementById('vi-analyzing-text'),
    analyzingErrorEl: document.getElementById('vi-analyzing-error'),
    analyzingRetryBtn: document.getElementById('vi-analyzing-retry'),
    analyzingDefaultText: 'AI가 답변을 분석 중입니다...',
    timerEl: document.getElementById('vi-timer'),
    submitFn: hooks => finishBasicVideoInterviewSubmit(hooks),
  };
  if (captionWrap) captionWrap.hidden = true;
  return cfg;
}

function buildBasicInterviewCameraConfig() {
  const section = document.getElementById('basicInterviewSection');
  if (!section) return null;

  const questions =
    typeof REAL_INTERVIEW_QUESTIONS !== 'undefined'
      ? REAL_INTERVIEW_QUESTIONS
      : [];

  const interviewerPanels = {};
  const interviewerCaptions = {};
  [1, 2, 3].forEach(function (n) {
    interviewerPanels[n] = section.querySelector('[data-interviewer="' + n + '"]');
    interviewerCaptions[n] = document.getElementById('bi-q-caption-' + n);
  });

  return {
    sectionEl: section,
    mode: 'real',
    videoEl: document.getElementById('bi-user-video'),
    avatarEl: section.querySelector('.bi-video-main .bi-avatar'),
    userWrap: section.querySelector('.bi-video-main'),
    startBtn: document.getElementById('bi-cam-start'),
    endAnswerBtn: document.getElementById('bi-cam-end-answer'),
    endAnswerBtnTop: null,
    exitBtn: document.getElementById('bi-exit-interview'),
    qProgressEl: document.getElementById('bi-q-progress'),
    qInfoEl: document.getElementById('bi-q-info'),
    questions: questions,
    multiQuestion: true,
    interviewerPanels: interviewerPanels,
    interviewerCaptions: interviewerCaptions,
    recBadge: document.getElementById('bi-rec-badge'),
    errorEl: document.getElementById('bi-cam-error'),
    analyzingOverlay: document.getElementById('bi-analyzing-overlay'),
    analyzingTextEl: document.getElementById('bi-analyzing-text'),
    analyzingErrorEl: document.getElementById('bi-analyzing-error'),
    analyzingRetryBtn: document.getElementById('bi-analyzing-retry'),
    analyzingDefaultText: '3명의 AI 면접관이 답변을 분석 중입니다...',
    timerEl: document.getElementById('bi-timer'),
    placeholderAnswer:
      '실전 면접 답변(텍스트·STT는 추후 연동, 표정·자세·시선은 추후 카메라 AI 분석 API로 대체 예정)',
    submitFn: hooks => finishRealInterviewSubmit(hooks),
  };
}

(function initCameraInterviewPages() {
  function run() {
    const vi = buildVideoInterviewCameraConfig();
    if (vi) initCameraInterviewPage(vi);
    const bi = buildBasicInterviewCameraConfig();
    if (bi) initCameraInterviewPage(bi);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
