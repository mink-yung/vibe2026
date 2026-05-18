/** 면접 시작 전 마이크/카메라 확인 모달 */
let deviceCheckPreviewStream = null;
let deviceCheckResolve = null;

function stopDeviceCheckPreviewStream() {
  if (deviceCheckPreviewStream) {
    try {
      deviceCheckPreviewStream.getTracks().forEach(function (t) {
        try {
          t.stop();
        } catch (_) {}
      });
    } catch (_) {}
    deviceCheckPreviewStream = null;
  }
  const video = document.getElementById('deviceCheckVideo');
  if (video) video.srcObject = null;
}

function ensureDeviceCheckModal() {
  if (document.getElementById('deviceCheckModal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'deviceCheckModal';
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-labelledby', 'deviceCheckTitle');
  overlay.innerHTML =
    '<div class="modal-box modal-box-auth modal-box-device" onclick="event.stopPropagation()">' +
    '<div class="modal-header">' +
    '<span class="modal-title" id="deviceCheckTitle">장치 확인</span>' +
    '<button type="button" class="modal-close-btn" id="deviceCheckClose" aria-label="닫기">✕</button>' +
    '</div>' +
    '<div class="modal-body">' +
    '<p class="device-check-status" id="deviceCheckDesc">면접을 시작하기 전에 마이크와 카메라를 확인합니다.</p>' +
    '<div class="device-check-mic-icon" id="deviceCheckMicIcon" hidden aria-hidden="true">' +
    '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>' +
    '</div>' +
    '<video id="deviceCheckVideo" class="device-check-preview" autoplay playsinline muted hidden></video>' +
    '<p class="device-check-status" id="deviceCheckStatus">권한 요청 중…</p>' +
    '<div class="device-check-actions">' +
    '<button type="button" class="btn-secondary" id="deviceCheckCancel">취소</button>' +
    '<button type="button" class="btn-primary" id="deviceCheckConfirm" disabled>확인하고 시작</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeDeviceCheckModal(false);
  });
  document.getElementById('deviceCheckClose').addEventListener('click', function () {
    closeDeviceCheckModal(false);
  });
  document.getElementById('deviceCheckCancel').addEventListener('click', function () {
    closeDeviceCheckModal(false);
  });
  document.getElementById('deviceCheckConfirm').addEventListener('click', function () {
    closeDeviceCheckModal(true);
  });
}

function closeDeviceCheckModal(confirmed) {
  const modal = document.getElementById('deviceCheckModal');
  if (modal) modal.classList.remove('open');
  stopDeviceCheckPreviewStream();
  const resolve = deviceCheckResolve;
  deviceCheckResolve = null;
  if (resolve) resolve(!!confirmed);
}

function setDeviceCheckUi(opts) {
  const title = document.getElementById('deviceCheckTitle');
  const desc = document.getElementById('deviceCheckDesc');
  const status = document.getElementById('deviceCheckStatus');
  const confirm = document.getElementById('deviceCheckConfirm');
  const video = document.getElementById('deviceCheckVideo');
  const micIcon = document.getElementById('deviceCheckMicIcon');

  if (title) title.textContent = opts.title || '장치 확인';
  if (desc) desc.textContent = opts.desc || '';
  if (status) {
    status.textContent = opts.statusText || '';
    status.className = 'device-check-status' + (opts.statusOk ? ' ok' : opts.statusErr ? ' err' : '');
  }
  if (confirm) confirm.disabled = !opts.canConfirm;
  if (video) video.hidden = !opts.showVideo;
  if (micIcon) {
    if (opts.showVideo) micIcon.hidden = true;
    else if (opts.statusOk) micIcon.hidden = false;
  }
}

/**
 * @param {{ mode?: 'audio'|'video', title?: string }} options
 * @returns {Promise<boolean>} 사용자가 확인하고 시작하면 true
 */
async function openDeviceCheck(options) {
  options = options || {};
  const mode = options.mode === 'video' ? 'video' : 'audio';

  ensureDeviceCheckModal();
  const modal = document.getElementById('deviceCheckModal');
  if (!modal) return false;

  stopDeviceCheckPreviewStream();

  setDeviceCheckUi({
    title: options.title || (mode === 'video' ? '카메라·마이크 확인' : '마이크 확인'),
    desc:
      mode === 'video'
        ? '카메라와 마이크가 정상적으로 보이면 「확인하고 시작」을 눌러 주세요.'
        : '마이크에 대고 말해 보시고, 인식이 되면 「확인하고 시작」을 눌러 주세요.',
    statusText: '브라우저에서 마이크' + (mode === 'video' ? '·카메라' : '') + ' 권한을 허용해 주세요.',
    canConfirm: false,
    showVideo: mode === 'video',
  });

  modal.classList.add('open');

  return new Promise(function (resolve) {
    deviceCheckResolve = resolve;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setDeviceCheckUi({
        statusText: '이 브라우저는 마이크를 지원하지 않습니다. Chrome 사용을 권장합니다.',
        statusErr: true,
        canConfirm: false,
        showVideo: mode === 'video',
      });
      return;
    }

    const constraints =
      mode === 'video' ? { video: true, audio: true } : { video: false, audio: true };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(function (stream) {
        deviceCheckPreviewStream = stream;
        const video = document.getElementById('deviceCheckVideo');
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        if (mode === 'video' && video) {
          video.srcObject = stream;
          video.hidden = false;
        }

        let statusText = '마이크가 연결되었습니다.';
        if (mode === 'video') {
          statusText =
            videoTracks.length && videoTracks[0].readyState === 'live'
              ? '카메라와 마이크가 정상적으로 연결되었습니다.'
              : '마이크는 연결되었습니다. 카메라 화면을 확인해 주세요.';
        } else if (!audioTracks.length) {
          statusText = '마이크를 찾을 수 없습니다.';
          setDeviceCheckUi({
            statusText: statusText,
            statusErr: true,
            canConfirm: false,
            showVideo: false,
          });
          return;
        }

        setDeviceCheckUi({
          statusText: statusText,
          statusOk: true,
          canConfirm: true,
          showVideo: mode === 'video',
        });
      })
      .catch(function (e) {
        console.error(e);
        let msg = '장치에 접근할 수 없습니다.';
        if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
          msg = '마이크' + (mode === 'video' ? '·카메라' : '') + ' 권한이 거부되었습니다. 주소창 옆 자물쇠에서 허용해 주세요.';
        } else if (e && e.name === 'NotFoundError') {
          msg = '마이크' + (mode === 'video' ? ' 또는 카메라' : '') + '를 찾을 수 없습니다.';
        }
        setDeviceCheckUi({
          statusText: msg,
          statusErr: true,
          canConfirm: false,
          showVideo: mode === 'video',
        });
      });
  });
}
