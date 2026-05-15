(function () {
  var PROFILE_FIELDS = [
    { key: 'age', label: '나이', kind: 'number' },
    { key: 'university', label: '출신대학', kind: 'text' },
    { key: 'major', label: '전공', kind: 'text' },
    { key: 'hobby', label: '취미', kind: 'text' },
    { key: 'specialty', label: '특기', kind: 'text' },
    { key: 'desired_position', label: '희망 직무', kind: 'text' },
    { key: 'career_level', label: '경력 수준', kind: 'text' },
    { key: 'skills', label: '기술/역량', kind: 'textarea' },
    { key: 'certifications', label: '자격증', kind: 'textarea' },
    { key: 'projects', label: '프로젝트 경험', kind: 'textarea' },
    { key: 'experience', label: '경력/활동 경험', kind: 'textarea' },
    { key: 'portfolio_url', label: '포트폴리오 링크', kind: 'text' },
    { key: 'github_url', label: '깃허브 링크', kind: 'text' },
  ];

  var lastLoadedProfile = {};

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatJoinDate(createdAt) {
    if (!createdAt) return '-';
    var d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function emptyProfile() {
    var o = {};
    PROFILE_FIELDS.forEach(function (f) {
      o[f.key] = f.kind === 'number' ? null : '';
    });
    return o;
  }

  function normalizeProfileFromApi(p) {
    var o = emptyProfile();
    if (!p) return o;
    PROFILE_FIELDS.forEach(function (f) {
      var v = p[f.key];
      if (v === undefined || v === null) return;
      if (f.kind === 'number') {
        o[f.key] = v;
      } else {
        o[f.key] = String(v);
      }
    });
    return o;
  }

  function profileHasContent(p) {
    if (!p) return false;
    for (var i = 0; i < PROFILE_FIELDS.length; i++) {
      var f = PROFILE_FIELDS[i];
      var raw = p[f.key];
      if (f.kind === 'number') {
        if (raw != null && String(raw).trim() !== '' && !Number.isNaN(Number(raw))) return true;
      } else if (raw != null && String(raw).trim() !== '') {
        return true;
      }
    }
    return false;
  }

  function fieldEl(key) {
    return document.getElementById('mp-p-' + key);
  }

  function fillDetailForm(p) {
    p = p || emptyProfile();
    PROFILE_FIELDS.forEach(function (f) {
      var el = fieldEl(f.key);
      if (!el) return;
      var v = p[f.key];
      if (f.kind === 'number') {
        el.value = v != null && String(v).trim() !== '' && !Number.isNaN(Number(v)) ? String(v) : '';
      } else {
        el.value = v != null ? String(v) : '';
      }
    });
  }

  function collectDetailForm() {
    var body = {};
    PROFILE_FIELDS.forEach(function (f) {
      var el = fieldEl(f.key);
      if (!el) return;
      body[f.key] = el.value;
    });
    return body;
  }

  function renderDetailSummary(p) {
    var box = document.getElementById('mp-detail-summary');
    if (!box) return;
    var html = '<dl style="margin:0;">';
    PROFILE_FIELDS.forEach(function (f) {
      var raw = p[f.key];
      var has = false;
      var inner = '';
      if (f.kind === 'number') {
        if (raw != null && String(raw).trim() !== '' && !Number.isNaN(Number(raw))) {
          has = true;
          inner = esc(String(raw)) + '세';
        }
      } else {
        var s = raw != null ? String(raw).trim() : '';
        if (s) {
          has = true;
          inner = esc(s);
        }
      }
      html +=
        '<dt>' +
        esc(f.label) +
        '</dt><dd>' +
        (has ? inner : '<span style="color:#adb5bd;">미입력</span>') +
        '</dd>';
    });
    html += '</dl>';
    box.innerHTML = html;
  }

  function setDetailMode(mode) {
    var sum = document.getElementById('mp-detail-summary');
    var form = document.getElementById('mp-detail-form');
    var viewAct = document.getElementById('mp-detail-view-actions');
    var editAct = document.getElementById('mp-detail-edit-actions');
    var isView = mode === 'view';
    var isEdit = mode === 'edit';
    if (sum) sum.hidden = !isView;
    if (form) form.hidden = !isEdit;
    if (viewAct) viewAct.hidden = !isView;
    if (editAct) editAct.hidden = !isEdit;
  }

  function mpOpenDiscardEditModal() {
    var m = document.getElementById('mpDiscardEditModal');
    if (m) {
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  window.mpCloseDiscardEditModal = function () {
    var m = document.getElementById('mpDiscardEditModal');
    if (m) {
      m.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  window.mpDiscardEditOutside = function (e) {
    if (e.target.id === 'mpDiscardEditModal') mpCloseDiscardEditModal();
  };

  window.mpConfirmDiscardEdit = function () {
    mpCloseDiscardEditModal();
    fillDetailForm(lastLoadedProfile);
    if (profileHasContent(lastLoadedProfile)) {
      setDetailMode('view');
    } else {
      setDetailMode('edit');
    }
    var st = document.getElementById('mp-detail-status');
    if (st) st.hidden = true;
  };

  window.mpEnterDetailEdit = function () {
    fillDetailForm(lastLoadedProfile);
    setDetailMode('edit');
    var st = document.getElementById('mp-detail-status');
    if (st) st.hidden = true;
  };

  window.mpCancelDetailEdit = function () {
    mpOpenDiscardEditModal();
  };

  window.mpSaveDetail = async function () {
    var status = document.getElementById('mp-detail-status');
    if (status) {
      status.hidden = false;
      status.textContent = '저장 중…';
      status.className = 'mp-msg mp-msg-muted';
    }
    try {
      var res = await apiPatchAuthProfile(collectDetailForm());
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401) {
        if (typeof clearStoredAuth === 'function') clearStoredAuth();
        location.href = 'dashboard.html#login';
        return;
      }
      if (!res.ok) {
        if (status) {
          status.textContent = data.message || '저장에 실패했습니다.';
          status.className = 'mp-msg mp-msg-error';
        }
        return;
      }
      if (status) {
        status.textContent = data.message || '저장되었습니다.';
        status.className = 'mp-msg mp-msg-ok';
      }
      await loadProfileDetail();
    } catch (err) {
      console.error(err);
      if (status) {
        status.textContent = '서버와 통신할 수 없습니다.';
        status.className = 'mp-msg mp-msg-error';
      }
    }
  };

  function showMypageSection(id) {
    ['account', 'detail', 'withdraw'].forEach(function (k) {
      var panel = document.getElementById('mp-panel-' + k);
      var btn = document.querySelector('.mp-nav-btn[data-mp="' + k + '"]');
      if (panel) panel.hidden = k !== id;
      if (btn) btn.classList.toggle('active', k === id);
    });
    if (id === 'detail') loadProfileDetail();
  }

  function setAccountFields(u) {
    var nameEl = document.getElementById('mp-acc-name');
    var emailEl = document.getElementById('mp-acc-email');
    var dateEl = document.getElementById('mp-acc-joined');
    if (nameEl) nameEl.textContent = (u && u.name) || '-';
    if (emailEl) emailEl.textContent = (u && u.email) || '-';
    if (dateEl) dateEl.textContent = formatJoinDate(u && u.created_at);
  }

  async function loadAccount() {
    var msg = document.getElementById('mp-account-msg');
    try {
      var res = await apiGetAuthMe();
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401) {
        if (typeof clearStoredAuth === 'function') clearStoredAuth();
        location.href = 'dashboard.html#login';
        return;
      }
      if (!res.ok) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = data.message || '계정 정보를 불러오지 못했습니다.';
          msg.className = 'mp-msg mp-msg-error';
        }
        return;
      }
      var u = data.user;
      if (msg) msg.hidden = true;
      setAccountFields(u);
      if (typeof saveAuthToStorage === 'function' && typeof getStoredAuthToken === 'function') {
        saveAuthToStorage(getStoredAuthToken(), {
          id: u.id,
          email: u.email,
          name: u.name,
        });
      }
      if (typeof renderAuthTopbar === 'function') renderAuthTopbar();
    } catch (e) {
      console.error(e);
      if (msg) {
        msg.hidden = false;
        msg.textContent = '서버와 통신할 수 없습니다.';
        msg.className = 'mp-msg mp-msg-error';
      }
    }
  }

  async function loadProfileDetail() {
    var msg = document.getElementById('mp-detail-msg');
    var status = document.getElementById('mp-detail-status');
    if (status) status.hidden = true;
    if (msg) {
      msg.hidden = false;
      msg.textContent = '불러오는 중…';
      msg.className = 'mp-msg mp-msg-muted';
    }
    try {
      var res = await apiGetAuthProfile();
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401) {
        if (typeof clearStoredAuth === 'function') clearStoredAuth();
        location.href = 'dashboard.html#login';
        return;
      }
      if (!res.ok) {
        if (msg) {
          msg.hidden = false;
          msg.textContent = data.message || '상세정보를 불러오지 못했습니다.';
          msg.className = 'mp-msg mp-msg-error';
        }
        lastLoadedProfile = emptyProfile();
        fillDetailForm(lastLoadedProfile);
        setDetailMode('edit');
        return;
      }
      if (msg) msg.hidden = true;
      lastLoadedProfile = normalizeProfileFromApi(data.profile || {});
      renderDetailSummary(lastLoadedProfile);
      fillDetailForm(lastLoadedProfile);
      if (profileHasContent(lastLoadedProfile)) {
        setDetailMode('view');
      } else {
        setDetailMode('edit');
      }
    } catch (e) {
      console.error(e);
      if (msg) {
        msg.hidden = false;
        msg.textContent = '서버와 통신할 수 없습니다.';
        msg.className = 'mp-msg mp-msg-error';
      }
      lastLoadedProfile = emptyProfile();
      fillDetailForm(lastLoadedProfile);
      setDetailMode('edit');
    }
  }

  window.mpOpenWithdrawModal = function () {
    var m = document.getElementById('mpWithdrawModal');
    if (m) {
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  };

  window.mpCloseWithdrawModal = function () {
    var m = document.getElementById('mpWithdrawModal');
    if (m) {
      m.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  window.mpWithdrawOutside = function (e) {
    if (e.target.id === 'mpWithdrawModal') mpCloseWithdrawModal();
  };

  window.mpConfirmWithdraw = async function () {
    var errEl = document.getElementById('mp-withdraw-error');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    try {
      var res = await apiDeleteAuthAccount();
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401) {
        if (typeof clearStoredAuth === 'function') clearStoredAuth();
        location.href = 'dashboard.html#login';
        return;
      }
      if (!res.ok) {
        if (errEl) {
          errEl.hidden = false;
          errEl.textContent = data.message || '탈퇴 처리에 실패했습니다.';
        }
        return;
      }
      if (typeof clearStoredAuth === 'function') clearStoredAuth();
      mpCloseWithdrawModal();
      alert(data.message || '회원탈퇴가 완료되었습니다.');
      location.href = 'signup.html';
    } catch (e) {
      console.error(e);
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = '서버와 통신할 수 없습니다.';
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof getStoredAuthToken !== 'function' || !getStoredAuthToken()) {
      location.href = 'dashboard.html#login';
      return;
    }

    lastLoadedProfile = emptyProfile();

    document.querySelectorAll('.mp-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-mp');
        if (id) showMypageSection(id);
      });
    });

    var form = document.getElementById('mp-detail-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
      });
    }

    loadAccount();
  });
})();
