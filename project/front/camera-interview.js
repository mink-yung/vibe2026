/** 기본/실전 면접 카메라 UI + 음성 인식(STT) */
let activeCameraStream = null;
let activeCameraConfig = null;

const cameraInterviewStates = new WeakMap();

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const END_ANSWER_ENABLE_DELAY_MS = 400;
const FINALIZE_TRANSCRIPT_MS = 1200;
const QUESTION_LISTEN_DELAY_MS = 350;
const RECOGNITION_START_RETRY_MS = 200;

const PLACEHOLDER_ANSWER_MARKERS = [
  'STT는 추후',
  '음성 인식 미연동',
  '기본 면접 답변',
  '실전 면접 답변',
  '추후 연동 예정',
];

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
      currentTranscript: '',
      recognitionFinalBuffer: '',
      volumeSamples: [],
      recognition: null,
      isListening: false,
      shouldRestartRecognition: false,
      isAdvancingQuestion: false,
      recognitionQuestionIndex: -1,
      audioContext: null,
      volumeIntervalId: null,
    });
  }
  return cameraInterviewStates.get(cfg);
}

function isPlaceholderAnswer(text) {
  const t = (text || '').trim();
  if (!t) return true;
  return PLACEHOLDER_ANSWER_MARKERS.some(function (m) {
    return t.includes(m);
  });
}

function stopActiveCameraInterviewStream() {
  const cfg = activeCameraConfig;
  if (cfg) {
    cancelScheduledListening(cfg);
    cleanupRecognition(cfg);
    stopVolumeMonitor(cfg);
  }
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(function (t) {
      try {
        t.stop();
      } catch (_) {}
    });
    activeCameraStream = null;
  }
  if (cfg?.videoEl) {
    cfg.videoEl.srcObject = null;
  }
  if (cfg?.avatarEl) cfg.avatarEl.style.display = '';
}

function formatInterviewTimer(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function setCamError(cfg, message) {
  if (!cfg?.errorEl) return;
  if (message) {
    cfg.errorEl.textContent = message;
    cfg.errorEl.hidden = false;
    console.error('[camera-interview]', message);
  } else {
    cfg.errorEl.textContent = '';
    cfg.errorEl.hidden = true;
  }
}

function updateLiveTranscript(cfg) {
  const state = getCameraInterviewState(cfg);
  const el = cfg.transcriptEl;
  if (!el) return;
  const text = (state.currentTranscript || '').trim();
  el.textContent = text || '말씀하시면 여기에 답변이 표시됩니다.';
  el.classList.toggle('cam-transcript-empty', !text);
}

function updateCameraInterviewUi(cfg) {
  const state = getCameraInterviewState(cfg);
  const showEndAnswer = state.isRecording && !state.isSubmitting && state.endActionsEnabled;

  if (cfg.startBtn) {
    const hideStart = state.isStarted || state.isSubmitting;
    cfg.startBtn.hidden = hideStart;
    cfg.startBtn.style.display = hideStart ? 'none' : '';
    cfg.startBtn.disabled = state.isSubmitting || (cfg.errorEl && !cfg.errorEl.hidden);
  }
  [cfg.endAnswerBtn, cfg.endAnswerBtnTop].filter(Boolean).forEach(function (btn) {
    btn.hidden = !showEndAnswer;
    btn.disabled = state.isSubmitting || !state.endActionsEnabled;
    btn.style.pointerEvents = showEndAnswer ? '' : 'none';
  });
  if (cfg.recBadge) {
    cfg.recBadge.hidden = !state.isRecording || state.isSubmitting;
  }
  if (cfg.userWrap) {
    cfg.userWrap.classList.toggle('cam-recording', state.isRecording && !state.isSubmitting);
  }

  if (typeof setInterviewerAreaState === 'function') {
    if (cfg.interviewerAreaEl) {
      if (state.isSubmitting) {
        setInterviewerAreaState(cfg.interviewerAreaEl, 'thinking');
      } else if (state.isRecording) {
        setInterviewerAreaState(cfg.interviewerAreaEl, 'listening');
      } else if (state.isStarted) {
        setInterviewerAreaState(cfg.interviewerAreaEl, 'speaking');
      } else {
        setInterviewerAreaState(cfg.interviewerAreaEl, null);
      }
    }
    if (cfg.mode === 'real' && cfg.interviewerPanels) {
      var item = getQuestionItem(cfg, state.currentQuestionIndex || 0);
      [1, 2, 3].forEach(function (n) {
        var panel = cfg.interviewerPanels[n];
        if (!panel) return;
        var wrap = panel.querySelector('.bi-interviewer-photo') || panel;
        if (item.interviewer === n && state.isStarted) {
          if (state.isSubmitting) {
            setInterviewerAreaState(wrap, 'thinking');
          } else if (state.isRecording) {
            setInterviewerAreaState(wrap, 'listening');
          } else {
            setInterviewerAreaState(wrap, 'speaking');
          }
        } else {
          setInterviewerAreaState(wrap, null);
        }
      });
    }
  }
}

function getQuestionItem(cfg, idx) {
  const raw = cfg.questions?.[idx];
  if (raw && typeof raw === 'object') return raw;
  return { interviewer: 1, question: raw || '' };
}

function getInterviewModeLabel(cfg) {
  return cfg && cfg.mode === 'real' ? 'real' : 'basic';
}

function resetCurrentTranscript(cfg) {
  const state = getCameraInterviewState(cfg);
  state.recognitionFinalBuffer = '';
  state.currentTranscript = '';
  updateLiveTranscript(cfg);
  console.log(
    '[interview] transcript reset:',
    state.currentQuestionIndex,
    '(' + getInterviewModeLabel(cfg) + ')'
  );
}

function cancelScheduledListening(cfg) {
  if (cfg && cfg.listenTimerId) {
    clearTimeout(cfg.listenTimerId);
    cfg.listenTimerId = null;
  }
}

function cleanupRecognition(cfg) {
  const state = getCameraInterviewState(cfg);
  cancelScheduledListening(cfg);
  state.shouldRestartRecognition = false;
  state.isListening = false;
  const active = state.recognition;
  state.recognition = null;
  if (!active) return;
  try {
    active.onresult = null;
    active.onend = null;
    active.onerror = null;
    if (typeof active.abort === 'function') {
      try {
        active.abort();
      } catch (_) {
        try {
          active.stop();
        } catch (_2) {}
      }
    } else {
      active.stop();
    }
  } catch (err) {
    console.warn('[interview] recognition cleanup warning:', err);
  }
}

function createCameraRecognition(cfg, questionIndex) {
  if (!SpeechRecognitionCtor) return null;
  const state = getCameraInterviewState(cfg);
  const boundQuestionIndex = questionIndex;
  const r = new SpeechRecognitionCtor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = cfg.speechLang || 'ko-KR';

  r.onresult = function (event) {
    if (state.recognition !== r) return;
    if (state.currentQuestionIndex !== boundQuestionIndex) return;
    if (state.isAdvancingQuestion) return;

    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        state.recognitionFinalBuffer += piece;
      } else {
        interim += piece;
      }
    }
    state.currentTranscript = (state.recognitionFinalBuffer + interim).trim();
    updateLiveTranscript(cfg);
    if (state.currentTranscript) {
      console.log(
        '[interview] transcript:',
        boundQuestionIndex,
        state.currentTranscript.slice(0, 80)
      );
    }
  };

  r.onerror = function (event) {
    if (state.recognition !== r) return;
    state.isListening = false;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setCamError(cfg, '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.');
    } else if (event.error === 'no-speech') {
      setCamError(cfg, '음성이 감지되지 않았습니다. 다시 말씀해 주세요.');
    } else if (event.error !== 'aborted') {
      setCamError(cfg, '음성 인식 오류: ' + event.error);
    }
    console.error('[interview] recognition error', boundQuestionIndex, event.error);
    updateCameraInterviewUi(cfg);
  };

  r.onend = function () {
    if (state.recognition !== r) return;
    if (state.isAdvancingQuestion) return;
    if (
      state.shouldRestartRecognition &&
      state.isListening &&
      state.currentQuestionIndex === boundQuestionIndex
    ) {
      try {
        r.start();
        console.log('[interview] recognition restarted (same question):', boundQuestionIndex);
      } catch (_) {
        state.isListening = false;
        state.shouldRestartRecognition = false;
        updateCameraInterviewUi(cfg);
      }
    }
  };

  return r;
}

function startRecognitionSafely(cfg, questionIndex) {
  const state = getCameraInterviewState(cfg);
  if (!SpeechRecognitionCtor) {
    setCamError(cfg, '이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.');
    return Promise.resolve(false);
  }
  if (state.isListening && state.recognition && state.recognitionQuestionIndex === questionIndex) {
    console.log('[interview] recognition already active:', questionIndex);
    return Promise.resolve(true);
  }

  setCamError(cfg, null);

  function tryStart() {
    state.shouldRestartRecognition = true;
    state.recognitionQuestionIndex = questionIndex;
    state.recognition = createCameraRecognition(cfg, questionIndex);
    if (!state.recognition) return false;
    state.recognition.start();
    state.isListening = true;
    state.isRecording = true;
    console.log(
      '[interview] recognition start:',
      questionIndex,
      '(' + getInterviewModeLabel(cfg) + ')'
    );
    updateLiveTranscript(cfg);
    return true;
  }

  return new Promise(function (resolve) {
    try {
      if (tryStart()) {
        resolve(true);
        return;
      }
      resolve(false);
    } catch (e) {
      console.warn('[interview] recognition start failed, retry:', questionIndex, e);
      cleanupRecognition(cfg);
      setTimeout(function () {
        try {
          if (tryStart()) {
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (e2) {
          console.error('[interview] recognition retry failed', e2);
          setCamError(cfg, '음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.');
          resolve(false);
        }
      }, RECOGNITION_START_RETRY_MS);
    }
  });
}

function startQuestionListening(cfg) {
  const state = getCameraInterviewState(cfg);
  if (!state.isStarted || state.isSubmitting) return Promise.resolve(false);

  cleanupRecognition(cfg);
  resetCurrentTranscript(cfg);

  return startRecognitionSafely(cfg, state.currentQuestionIndex);
}

function scheduleStartQuestionListening(cfg, delayMs) {
  const state = getCameraInterviewState(cfg);
  cancelScheduledListening(cfg);
  const delay = delayMs != null ? delayMs : QUESTION_LISTEN_DELAY_MS;
  cfg.listenTimerId = setTimeout(function () {
    cfg.listenTimerId = null;
    if (!state.isStarted || state.isSubmitting) return;
    Promise.resolve(startQuestionListening(cfg)).then(function (ok) {
      if (!ok) return;
      scheduleEnableEndAnswerActions(cfg);
      updateCameraInterviewUi(cfg);
    });
  }, delay);
}

/** @deprecated — cleanupRecognition 사용 */
function stopCameraRecognition(cfg, options) {
  cleanupRecognition(cfg);
}

function getCurrentTranscript(cfg) {
  const state = getCameraInterviewState(cfg);
  return (state.currentTranscript || state.recognitionFinalBuffer || '').trim();
}

function commitCurrentTranscript(cfg) {
  const state = getCameraInterviewState(cfg);
  state.shouldRestartRecognition = false;
  const text = getCurrentTranscript(cfg);
  cleanupRecognition(cfg);
  state.recognitionFinalBuffer = '';
  state.currentTranscript = '';
  updateLiveTranscript(cfg);
  console.log('[interview] stop answer:', state.currentQuestionIndex, text.slice(0, 120));
  return text;
}

function restartCurrentQuestionRecording(cfg) {
  scheduleStartQuestionListening(cfg, RECOGNITION_START_RETRY_MS);
  return true;
}

function advanceToNextQuestion(cfg) {
  const state = getCameraInterviewState(cfg);
  state.isAdvancingQuestion = true;
  cleanupRecognition(cfg);
  resetCurrentTranscript(cfg);

  state.currentQuestionIndex += 1;
  const item = getQuestionItem(cfg, state.currentQuestionIndex);
  console.log(
    '[interview] move next:',
    state.currentQuestionIndex,
    item.question ? item.question.slice(0, 60) : ''
  );

  renderQuestion(cfg);
  state.isAdvancingQuestion = false;
  state.isRecording = true;
  scheduleStartQuestionListening(cfg, QUESTION_LISTEN_DELAY_MS);
}

function finalizeCameraTranscript(cfg) {
  return new Promise(function (resolve) {
    const state = getCameraInterviewState(cfg);
    state.shouldRestartRecognition = false;
    if (!state.isListening && !state.recognition) {
      const text = getCurrentTranscript(cfg);
      console.log('[interview] transcript finalized (idle):', state.currentQuestionIndex, text.length);
      resolve(text);
      return;
    }
    const active = state.recognition;
    let settled = false;
    const finish = function () {
      if (settled) return;
      settled = true;
      const text = getCurrentTranscript(cfg);
      cleanupRecognition(cfg);
      state.recognitionFinalBuffer = '';
      state.currentTranscript = '';
      updateLiveTranscript(cfg);
      console.log('[interview] transcript finalized:', state.currentQuestionIndex, text.length);
      resolve(text);
    };
    if (!active) {
      finish();
      return;
    }
    try {
      active.onend = function () {
        finish();
      };
      active.onerror = null;
      active.onresult = null;
      active.stop();
    } catch (_) {
      finish();
    }
    setTimeout(finish, FINALIZE_TRANSCRIPT_MS);
  });
}

function renderQuestion(cfg) {
  updateQuestionDisplay(cfg);
}

function startVolumeMonitor(stream, cfg) {
  const state = getCameraInterviewState(cfg);
  stopVolumeMonitor(cfg);
  if (!stream) return;
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    state.audioContext = audioContext;
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(function (e) {
        console.warn('[camera-interview] AudioContext resume', e);
      });
    }
    state.volumeIntervalId = setInterval(function () {
      try {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        state.volumeSamples.push(avg);
        if (state.volumeSamples.length > 120) state.volumeSamples.shift();
      } catch (_) {}
    }, 200);
    console.log('[camera-interview] volume monitor started');
  } catch (e) {
    console.error('[camera-interview] volume monitor failed', e);
  }
}

function stopVolumeMonitor(cfg) {
  const state = getCameraInterviewState(cfg);
  if (state.volumeIntervalId) {
    clearInterval(state.volumeIntervalId);
    state.volumeIntervalId = null;
  }
  if (state.audioContext) {
    try {
      state.audioContext.close();
    } catch (_) {}
    state.audioContext = null;
  }
}

function updateQuestionDisplay(cfg) {
  const state = getCameraInterviewState(cfg);
  const total = cfg.questions?.length || 1;
  const idx = state.currentQuestionIndex || 0;
  const item = getQuestionItem(cfg, idx);
  const qText = item.question || '';

  console.log(
    '[interview] render question:',
    idx,
    qText ? qText.slice(0, 80) : '',
    '(' + getInterviewModeLabel(cfg) + ')'
  );

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
        caption.textContent = '';
        caption.hidden = true;
      }
    });
    if (cfg.topNameEl) {
      cfg.topNameEl.textContent = 'AI 면접관 ' + (item.interviewer || 1);
    }
    if (cfg.topLabelEl) cfg.topLabelEl.textContent = 'Q' + (idx + 1);
    if (cfg.topTextEl) cfg.topTextEl.textContent = qText;
    if (cfg.topPanelEl) cfg.topPanelEl.hidden = false;
    return;
  }

  if (cfg.qLabelEl) cfg.qLabelEl.textContent = 'Q' + (idx + 1);
  if (cfg.qTextEl) cfg.qTextEl.textContent = qText;
  if (cfg.topPanelEl) cfg.topPanelEl.hidden = false;
}

function scheduleEnableEndAnswerActions(cfg) {
  const state = getCameraInterviewState(cfg);
  if (cfg.endEnableTimerId) {
    clearTimeout(cfg.endEnableTimerId);
    cfg.endEnableTimerId = null;
  }
  state.endActionsEnabled = false;
  updateCameraInterviewUi(cfg);
  cfg.endEnableTimerId = setTimeout(function () {
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

function getMediaErrorMessage(err) {
  if (!err) return '카메라를 시작할 수 없습니다.';
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return '카메라·마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return '카메라 또는 마이크 장치를 찾을 수 없습니다. 장치 연결을 확인해 주세요.';
  }
  if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
    return '카메라 또는 마이크가 다른 프로그램에서 사용 중일 수 있습니다.';
  }
  if (err.name === 'OverconstrainedError') {
    return '요청한 카메라 설정을 사용할 수 없습니다.';
  }
  if (err.name === 'SecurityError') {
    return '보안 설정 때문에 카메라에 접근할 수 없습니다. HTTPS 또는 localhost에서 시도해 주세요.';
  }
  return '카메라를 시작할 수 없습니다. Chrome 또는 Edge 사용을 권장합니다.';
}

async function requestCameraStream(cfg) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setCamError(cfg, '이 브라우저는 카메라를 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.');
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    activeCameraStream = stream;
    activeCameraConfig = cfg;
    if (cfg.videoEl) {
      cfg.videoEl.srcObject = stream;
      cfg.videoEl.hidden = false;
      cfg.videoEl.muted = true;
      try {
        await cfg.videoEl.play();
        console.log('[camera-interview] video playing');
      } catch (playErr) {
        console.error('[camera-interview] video.play failed', playErr);
        setCamError(cfg, '카메라 영상을 표시할 수 없습니다. 페이지를 새로고침해 주세요.');
      }
    }
    if (cfg.avatarEl) cfg.avatarEl.style.display = 'none';
    setCamError(cfg, null);
    startVolumeMonitor(stream, cfg);
    console.log('[camera-interview] getUserMedia success', {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
    });
    return stream;
  } catch (e) {
    console.error('[camera-interview] getUserMedia failed', e);
    setCamError(cfg, getMediaErrorMessage(e));
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
  if (!SpeechRecognitionCtor) {
    setCamError(cfg, '이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.');
    return;
  }
  if (typeof getStoredAuthToken === 'function' && !getStoredAuthToken()) {
    setCamError(cfg, '로그인이 필요합니다.');
    if (typeof openLoginModal === 'function') openLoginModal();
    else location.href = 'dashboard.html#login';
    return;
  }

  setCamError(cfg, null);

  if (typeof openDeviceCheck === 'function') {
    const deviceOk = await openDeviceCheck({
      mode: 'video',
      title:
        cfg.mode === 'real'
          ? '실전 면접 — 카메라·마이크 확인'
          : '기본 면접 — 카메라·마이크 확인',
    });
    if (!deviceOk) return;
  }

  const stream = await requestCameraStream(cfg);
  if (!stream) return;

  state.isStarted = true;
  state.isRecording = true;
  state.endActionsEnabled = false;
  state.currentQuestionIndex = 0;
  state.answers = [];
  state.volumeSamples = [];
  cfg.interviewStartedAt = Date.now();

  if (cfg.timerEl) {
    if (cfg.timerIntervalId) clearInterval(cfg.timerIntervalId);
    cfg.timerIntervalId = setInterval(function () {
      if (cfg.timerEl && cfg.interviewStartedAt) {
        cfg.timerEl.textContent = formatInterviewTimer(Date.now() - cfg.interviewStartedAt);
      }
    }, 1000);
    cfg.timerEl.textContent = '00:00';
  }

  if (cfg.multiQuestion) {
    renderQuestion(cfg);
  }

  updateCameraInterviewUi(cfg);
  scheduleStartQuestionListening(cfg, QUESTION_LISTEN_DELAY_MS);
}

async function onCameraInterviewEndAnswer(cfg, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const state = getCameraInterviewState(cfg);
  if (!state.isStarted || !state.isRecording || state.isSubmitting || !state.endActionsEnabled) {
    return;
  }
  if (typeof cfg.submitFn !== 'function') return;

  if (cfg.endEnableTimerId) {
    clearTimeout(cfg.endEnableTimerId);
    cfg.endEnableTimerId = null;
  }

  state.endActionsEnabled = false;
  updateCameraInterviewUi(cfg);

  try {
    const isLastQuestion =
      !cfg.multiQuestion ||
      !cfg.questions?.length ||
      state.currentQuestionIndex >= cfg.questions.length - 1;

    let answerText;
    if (isLastQuestion) {
      answerText = await finalizeCameraTranscript(cfg);
    } else {
      answerText = commitCurrentTranscript(cfg);
    }

    if (!answerText || isPlaceholderAnswer(answerText)) {
      setCamError(cfg, '답변이 인식되지 않았습니다. 다시 답변해주세요.');
      state.isRecording = true;
      restartCurrentQuestionRecording(cfg);
      updateCameraInterviewUi(cfg);
      return;
    }

    setCamError(cfg, null);

    if (cfg.multiQuestion && cfg.questions?.length) {
      const item = getQuestionItem(cfg, state.currentQuestionIndex);
      state.answers.push({
        question: item.question,
        answer: answerText,
        interviewer: item.interviewer,
      });
      console.log(
        '[interview] answer saved Q' + (state.currentQuestionIndex + 1),
        '(' + getInterviewModeLabel(cfg) + ')',
        answerText.slice(0, 80)
      );

      if (state.currentQuestionIndex < cfg.questions.length - 1) {
        advanceToNextQuestion(cfg);
        updateCameraInterviewUi(cfg);
        return;
      }
    } else {
      const item = getQuestionItem(cfg, 0);
      state.answers.push({
        question: item.question,
        answer: answerText,
        interviewer: item.interviewer,
      });
    }

    state.isSubmitting = true;
    state.isRecording = false;
    stopCameraRecognition(cfg, { keepResults: true });
    updateCameraInterviewUi(cfg);
    showCameraAnalyzing(cfg, cfg.analyzingDefaultText);

    const elapsedMs = cfg.interviewStartedAt ? Date.now() - cfg.interviewStartedAt : null;
    const sessionData = {
      elapsedMs: elapsedMs,
      questionCount: cfg.questions?.length || state.answers.length || 1,
      volumeSamples: state.volumeSamples.slice(-60),
      durationSeconds: elapsedMs ? Math.max(1, Math.round(elapsedMs / 1000)) : null,
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

    console.log('[camera-interview] submitting', {
      answerCount: state.answers.length,
      totalAnswerLen: sessionData.questionRecords
        ? sessionData.questionRecords.map(function (r) { return (r.answer || '').length; }).join('+')
        : 0,
      durationSeconds: sessionData.durationSeconds,
    });

    const result = await cfg.submitFn({
      silent: true,
      sessionData: sessionData,
      onEnd: function () {
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
    scheduleStartQuestionListening(cfg, QUESTION_LISTEN_DELAY_MS);
    showCameraAnalyzingError(
      cfg,
      (result && result.message) || '저장에 실패했습니다. 다시 시도해 주세요.'
    );
  } catch (err) {
    console.error('[camera-interview] end answer error', err);
    state.isSubmitting = false;
    state.isRecording = true;
    state.endActionsEnabled = false;
    setCamError(cfg, '답변 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    scheduleStartQuestionListening(cfg, QUESTION_LISTEN_DELAY_MS);
    hideCameraAnalyzing(cfg);
  }
}

function initCameraInterviewPage(cfg) {
  if (!cfg || !cfg.sectionEl) return;
  if (cfg.sectionEl.dataset.camInterviewBound === '1') return;
  cfg.sectionEl.dataset.camInterviewBound = '1';

  activeCameraConfig = cfg;
  cancelScheduledListening(cfg);
  cleanupRecognition(cfg);
  const state = getCameraInterviewState(cfg);
  state.isStarted = false;
  state.isRecording = false;
  state.isSubmitting = false;
  state.endActionsEnabled = false;
  state.currentQuestionIndex = 0;
  state.answers = [];
  state.volumeSamples = [];

  hideCameraAnalyzing(cfg);
  updateLiveTranscript(cfg);

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
    cfg.startBtn.addEventListener('click', function (e) {
      onCameraInterviewStart(cfg, e);
    });
  }
  [cfg.endAnswerBtn, cfg.endAnswerBtnTop].filter(Boolean).forEach(function (btn) {
    if (btn.dataset.camClickBound === '1') return;
    btn.dataset.camClickBound = '1';
    btn.type = 'button';
    btn.addEventListener('click', function (e) {
      onCameraInterviewEndAnswer(cfg, e);
    });
  });
  if (cfg.exitBtn && cfg.exitBtn.dataset.camClickBound !== '1') {
    cfg.exitBtn.dataset.camClickBound = '1';
    cfg.exitBtn.addEventListener('click', function (e) {
      e.preventDefault();
      stopActiveCameraInterviewStream();
      location.href = 'mock-interview.html';
    });
  }
  if (cfg.analyzingRetryBtn && cfg.analyzingRetryBtn.dataset.camClickBound !== '1') {
    cfg.analyzingRetryBtn.dataset.camClickBound = '1';
    cfg.analyzingRetryBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      hideCameraAnalyzing(cfg);
      onCameraInterviewEndAnswer(cfg, e);
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

  const topPanel = document.getElementById('vi-interview-top-panel');

  return {
    sectionEl: section,
    mode: 'basic',
    interviewerAreaEl: section.querySelector('.vi-interviewer-photo'),
    speechLang: 'ko-KR',
    videoEl: document.getElementById('vi-user-video'),
    avatarEl: section.querySelector('.vi-video-wrap.user .vi-avatar'),
    userWrap: section.querySelector('.vi-video-wrap.user'),
    transcriptEl: document.getElementById('vi-live-transcript'),
    startBtn: document.getElementById('vi-cam-start'),
    endAnswerBtn: document.getElementById('vi-cam-end-answer'),
    endAnswerBtnTop: null,
    exitBtn: document.getElementById('vi-exit-interview'),
    qLabelEl: document.getElementById('vi-q-label'),
    qTextEl: document.getElementById('vi-q-text'),
    qInfoEl: document.getElementById('vi-q-info'),
    qProgressEl: document.getElementById('vi-q-progress'),
    topPanelEl: topPanel,
    questions: questions,
    multiQuestion: true,
    recBadge: document.getElementById('vi-rec-badge'),
    errorEl: document.getElementById('vi-cam-error'),
    analyzingOverlay: document.getElementById('vi-analyzing-overlay'),
    analyzingTextEl: document.getElementById('vi-analyzing-text'),
    analyzingErrorEl: document.getElementById('vi-analyzing-error'),
    analyzingRetryBtn: document.getElementById('vi-analyzing-retry'),
    analyzingDefaultText: 'AI가 답변을 분석 중입니다...',
    timerEl: document.getElementById('vi-timer'),
    submitFn: function (hooks) {
      return finishBasicVideoInterviewSubmit(hooks);
    },
  };
<<<<<<< HEAD
  if (topPanel) topPanel.hidden = false;
  return cfg;
=======
>>>>>>> 8ee3146888e76704c44de4d87aa6c086ef96e140
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
    speechLang: 'ko-KR',
    videoEl: document.getElementById('bi-user-video'),
    avatarEl: section.querySelector('.bi-video-main .bi-avatar'),
    userWrap: section.querySelector('.bi-video-main'),
    transcriptEl: document.getElementById('bi-live-transcript'),
    startBtn: document.getElementById('bi-cam-start'),
    endAnswerBtn: document.getElementById('bi-cam-end-answer'),
    endAnswerBtnTop: null,
    exitBtn: document.getElementById('bi-exit-interview'),
    qProgressEl: document.getElementById('bi-q-progress'),
    qInfoEl: document.getElementById('bi-q-info'),
    topPanelEl: document.getElementById('bi-interview-top-panel'),
    topNameEl: document.getElementById('bi-interviewer-name'),
    topLabelEl: document.getElementById('bi-q-label-top'),
    topTextEl: document.getElementById('bi-q-text-top'),
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
    submitFn: function (hooks) {
      return finishRealInterviewSubmit(hooks);
    },
  };
}

(function initCameraInterviewPages() {
  function run() {
    const vi = buildVideoInterviewCameraConfig();
    if (vi) {
      if (vi.captionWrapEl) vi.captionWrapEl.hidden = true;
      initCameraInterviewPage(vi);
    }
    const bi = buildBasicInterviewCameraConfig();
    if (bi) initCameraInterviewPage(bi);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
