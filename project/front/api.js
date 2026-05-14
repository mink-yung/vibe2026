/** 백엔드 베이스 URL (로그인은 Bearer 없이 호출) */
const API_BASE = 'http://localhost:3000';

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

async function apiGetAuthMe() {
  return apiAuthFetch('/api/auth/me', { method: 'GET' });
}

async function apiPostInterviewsQuick(body) {
  return apiAuthFetch('/api/interviews/quick', { method: 'POST', body: body ?? {} });
}

async function apiPostInterviewsBasic(body) {
  return apiAuthFetch('/api/interviews/basic', { method: 'POST', body: body ?? {} });
}

async function apiPostInterviewsReal(body) {
  return apiAuthFetch('/api/interviews/real', { method: 'POST', body: body ?? {} });
}

async function apiGetInterviewsHistory() {
  return apiAuthFetch('/api/interviews/history', { method: 'GET' });
}

async function apiGetInterviewsRecentAnalysis() {
  return apiAuthFetch('/api/interviews/recent/analysis', { method: 'GET' });
}

async function apiGetInterviewsRecentSummary() {
  return apiAuthFetch('/api/interviews/recent/summary', { method: 'GET' });
}
