/** 백엔드 베이스 URL (로그인은 Bearer 없이 호출) */
const API_BASE = 'https://squad-understanding-peaceful-power.trycloudflare.com/';

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'user';

function getStoredAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (_) {
    return null;
  }
}

function getStoredAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function saveAuthToStorage(token, user) {
  try {
    if (token != null) localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user ?? null));
  } catch (_) {}
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (_) {}
}

/**
 * 로그인 후 사용하는 API: localStorage 토큰이 있으면 Authorization: Bearer 추가
 * @param {string} path '/api/...'
 * @param {RequestInit} [options]
 */
async function apiAuthFetch(path, options = {}) {
  const token = getStoredAuthToken();
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const { body: rawBody, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = rawBody;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  } else if (body != null && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...rest, body, headers });
}

/**
 * 면접 API(/api/interviews/*): 로그인 토큰 필수, 항상 Authorization: Bearer 전송
 */
async function apiInterviewFetch(path, options = {}) {
  const token = getStoredAuthToken();
  if (!token) {
    return Promise.reject(new Error('LOGIN_REQUIRED'));
  }
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const { body: rawBody, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders || {});
  headers.set('Authorization', `Bearer ${token}`);
  let body = rawBody;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  } else if (body != null && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...rest, body, headers });
}

async function apiGetAuthMe() {
  return apiAuthFetch('/api/auth/me', { method: 'GET' });
}

/** 상세정보(나이·출신대학·취미·특기) 조회 — 마이페이지 상세 탭 전용 */
async function apiGetAuthProfile() {
  return apiAuthFetch('/api/auth/profile', { method: 'GET' });
}

/** 상세정보(나이·출신대학·취미·특기) 저장 */
async function apiPatchAuthProfile(body) {
  return apiAuthFetch('/api/auth/profile', { method: 'PATCH', body: body ?? {} });
}

/** 회원탈퇴 — 연관 면접 기록 삭제 후 계정 삭제 */
async function apiDeleteAuthAccount() {
  return apiAuthFetch('/api/auth/account', { method: 'DELETE' });
}

async function apiPostInterviewsQuick(body) {
  return apiInterviewFetch('/api/interviews/quick', { method: 'POST', body: body ?? {} });
}

/** 빠른면접 음성(STT) 결과 — POST /api/interviews/quick/audio */
async function createQuickAudioInterview(payload) {
  return apiInterviewFetch('/api/interviews/quick/audio', {
    method: 'POST',
    body: payload ?? {},
  });
}

async function apiPostInterviewsBasic(body) {
  return apiInterviewFetch('/api/interviews/basic', { method: 'POST', body: body ?? {} });
}

async function apiPostInterviewsReal(body) {
  return apiInterviewFetch('/api/interviews/real', { method: 'POST', body: body ?? {} });
}

async function apiGetInterviewsHistory() {
  return apiInterviewFetch('/api/interviews/history', { method: 'GET' });
}

async function apiGetInterviewsRecentAnalysis() {
  return apiInterviewFetch('/api/interviews/recent/analysis', { method: 'GET' });
}

async function apiGetInterviewsRecentSummary() {
  return apiInterviewFetch('/api/interviews/recent/summary', { method: 'GET' });
}

async function getInterviewDetail(interviewId) {
  return apiInterviewFetch(`/api/interviews/${interviewId}`, { method: 'GET' });
}

async function deleteInterview(interviewId) {
  return apiInterviewFetch(`/api/interviews/${interviewId}`, { method: 'DELETE' });
}
