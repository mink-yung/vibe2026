/** 면접관 이미지 경로 — assets/interviewers/ */
const INTERVIEWER_IMAGES = {
  pressure: 'assets/interviewers/interviewer-pressure.jpg',
  friendly: 'assets/interviewers/interviewer-friendly.jpg',
  strict: 'assets/interviewers/interviewer-strict.png',
  default: 'assets/interviewers/interviewer-friendly.jpg',
};

/** 백엔드 persona / 실전 면접 패널 번호 → 이미지 키 */
const INTERVIEWER_BY_PERSONA = {
  friendly: 'friendly',
  pressure: 'pressure',
  sharp: 'strict',
  strict: 'strict',
};

/** 실전 면접: AI 면접관 1=친절, 2=까칠, 3=압박 */
const REAL_PANEL_TO_KEY = {
  1: 'friendly',
  2: 'strict',
  3: 'pressure',
};

const MODE_DEFAULT_KEY = {
  quick: 'friendly',
  basic: 'friendly',
  real: 'friendly',
  mock: 'friendly',
};

function resolveInterviewerKey(opts) {
  const o = opts || {};
  if (o.key && INTERVIEWER_IMAGES[o.key]) return o.key;
  if (o.persona && INTERVIEWER_BY_PERSONA[o.persona]) return INTERVIEWER_BY_PERSONA[o.persona];
  const panel = Number(o.panel || o.interviewer);
  if (panel >= 1 && panel <= 3 && REAL_PANEL_TO_KEY[panel]) {
    return REAL_PANEL_TO_KEY[panel];
  }
  if (o.mode && MODE_DEFAULT_KEY[o.mode]) return MODE_DEFAULT_KEY[o.mode];
  return 'default';
}

function getInterviewerImageSrc(opts) {
  const key = typeof opts === 'string' ? opts : resolveInterviewerKey(opts);
  return INTERVIEWER_IMAGES[key] || INTERVIEWER_IMAGES.default;
}

function applyInterviewerImg(imgEl, opts) {
  if (!imgEl) return resolveInterviewerKey(opts);
  const key = resolveInterviewerKey(opts);
  imgEl.src = getInterviewerImageSrc(key);
  imgEl.alt = imgEl.alt || 'AI 면접관';
  imgEl.classList.add('interviewer-img');
  imgEl.dataset.interviewerKey = key;
  imgEl.onerror = function handleInterviewerImgError() {
    if (imgEl.dataset.fallbackUsed === '1') {
      imgEl.style.display = 'none';
      var ph = imgEl.parentElement && imgEl.parentElement.querySelector('.interviewer-img-fallback');
      if (ph) ph.hidden = false;
      return;
    }
    imgEl.dataset.fallbackUsed = '1';
    imgEl.src = INTERVIEWER_IMAGES.default;
  };
  return key;
}

function setInterviewerAreaState(wrapEl, state) {
  if (!wrapEl) return;
  wrapEl.classList.remove(
    'interviewer-speaking',
    'interviewer-listening',
    'interviewer-thinking'
  );
  if (state === 'speaking' || state === 'listening' || state === 'thinking') {
    wrapEl.classList.add('interviewer-' + state);
  }
}

/** 실전 면접 3패널 이미지 일괄 적용 */
function applyRealInterviewPanelImages(root) {
  const scope = root || document;
  [1, 2, 3].forEach(function (n) {
    var panel = scope.querySelector('[data-interviewer="' + n + '"]');
    if (!panel) return;
    var img = panel.querySelector('img.interviewer-img');
    if (!img) return;
    applyInterviewerImg(img, { panel: n, mode: 'real' });
  });
}

/** 빠른면접 단일 이미지 */
function initQuickInterviewInterviewer() {
  var img = document.getElementById('qi-interviewer-img');
  if (img) applyInterviewerImg(img, { mode: 'quick' });
}

/** 기본 카메라 면접 단일 이미지 */
function initBasicCameraInterviewer() {
  var img = document.getElementById('vi-interviewer-img');
  if (img) applyInterviewerImg(img, { mode: 'basic' });
}

/** 실전 카메라 면접 패널 */
function initRealCameraInterviewers() {
  applyRealInterviewPanelImages(document.getElementById('basicInterviewSection'));
}

/** 모의면접 카드 썸네일 */
function initMockInterviewCardImages() {
  var cards = document.querySelectorAll('#mockSection .mock-card');
  if (cards[0]) {
    var img0 = cards[0].querySelector('.mock-interviewer-img');
    if (img0) applyInterviewerImg(img0, { mode: 'quick' });
  }
  if (cards[1]) {
    var img1 = cards[1].querySelector('.mock-interviewer-img');
    if (img1) applyInterviewerImg(img1, { mode: 'basic' });
  }
  if (cards[2]) {
    var img2 = cards[2].querySelector('.mock-interviewer-img');
    if (img2) applyInterviewerImg(img2, { key: 'pressure' });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('quickInterviewSection')) initQuickInterviewInterviewer();
  if (document.getElementById('videoInterviewSection')) initBasicCameraInterviewer();
  if (document.getElementById('basicInterviewSection')) initRealCameraInterviewers();
  if (document.getElementById('mockSection')) initMockInterviewCardImages();
});
