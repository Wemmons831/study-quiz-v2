// src/services/api.js
//------------------------------------------------------------
// SINGLE SOURCE OF TRUTH FOR ALL NETWORK CALLS
//------------------------------------------------------------
import axios from 'axios';

// -------- configuration -----------------------------------
export const TOKEN_KEY = 'authToken';                       // one key everywhere
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// -------- token helpers -----------------------------------
export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  remove: () => localStorage.removeItem(TOKEN_KEY),
  exists: () => !!localStorage.getItem(TOKEN_KEY)
};

// -------- attach token to every request -------------------
api.interceptors.request.use((config) => {
  const t = tokenStorage.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// -------- uniform error wrapper ---------------------------
export class APIError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status ?? 0;
    const msg = err.response?.data?.error || err.message || 'Network error';
    // Auto-logout on 401
    if (status === 401) tokenStorage.remove();
    return Promise.reject(new APIError(msg, status, err.response?.data));
  }
);

// -------- generic helper for uploads (FormData) -----------
const postForm = (url, formData) =>
  api.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// ==========================================================
//  PUBLIC API SURFACE  (auth, users, studySets, discover…)
// ==========================================================
export const authAPI = {
  login:  (data)  => api.post('/auth/login',    data).then(r => { tokenStorage.set(r.data.token); return r; }),
  register:(data) => api.post('/auth/register', data).then(r => { tokenStorage.set(r.data.token); return r; }),
  logout: ()      => api.post('/auth/logout').finally(() => tokenStorage.remove()),
  me:     ()      => api.get('/auth/me'),
};

export const usersAPI = {
  profile:        ()        => api.get('/users/profile'),
  updateProfile:  (d)       => api.put('/users/profile', d),
  changePassword: (payload) => api.put('/users/password', payload),
  uploadAvatar:   (file)    => {
    const fd = new FormData(); fd.append('profilePicture', file);
    return postForm('/users/profile-picture', fd);
  },
  byId:           (id)      => api.get(`/users/${id}`),
  stats:          ()        => api.get('/users/stats'),
};

export const studySetsAPI = {
  getAll: (params={}) => api.get('/studysets',      { params }),
  getMy:  (params={}) => api.get('/studysets/my',   { params }),
  get:    (id)        => api.get(`/studysets/${id}`),
  create: (data)      => api.post('/studysets', data),
  update: (id,d)      => api.put(`/studysets/${id}`, d),
  remove: (id)        => api.delete(`/studysets/${id}`),
  fork:   (id)        => api.post(`/studysets/${id}/fork`),
  importCSV: (file)   => {
    const fd = new FormData(); fd.append('csvFile', file);
    return postForm('/studysets/import-csv', fd);
  }
};

export const discoverAPI = {
  popular: (params={}) => api.get('/discover/popular', { params }),
  recent:  (params={}) => api.get('/discover/recent',  { params }),
  search:  (q, params={}) => api.get('/discover/search', { params: { q, ...params } }),
  tags:    () => api.get('/discover/tags'),
  byTag:   (tag, params={}) => api.get(`/discover/tag/${encodeURIComponent(tag)}`, { params }),
};

export const leaderboardsAPI = {
  questions: (params={}) => api.get('/leaderboards/questions', { params }),
  time:      (params={}) => api.get('/leaderboards/time',      { params }),
  me:        ()          => api.get('/leaderboards/me'),
  reset:     ()          => api.post('/leaderboards/reset'),
};

export const progressAPI = {
  getProgress:  (studySetId)          => api.get(`/progress/studyset/${studySetId}`),
  update:       (questionId, payload) => api.put(`/progress/${questionId}`, payload),
  startSession: (studySetId)          => api.post('/progress/session/start', { studySetId }),
  endSession:   (sessionId)           => api.put(`/progress/session/${sessionId}/end`),
};

// ===== misc utilities =====================================
export const utils = {
  isAuthenticated: () => tokenStorage.exists(),
  clearAuth:       () => tokenStorage.remove(),
  health:          () => api.get('/health', { baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001' })
};

export const apiCall = async (endpoint, opts = {}) => {
  const {
    method = 'GET',
    body = null,
    headers = {},
    skipAuth = false,
    skipContentType = false,
    timeout = 10000   // axios already has timeout
  } = opts;

  const config = {
    url: endpoint,
    method: method.toLowerCase(),
    timeout,
    headers: { ...headers }
  };

  // Attach auth header unless told not to (the interceptor does this automatically)
  if (skipAuth) config.headers.Authorization = undefined;

  // Body handling
  if (body instanceof FormData) {
    config.data = body;
  } else if (body !== null) {
    config.data = body;
    if (!skipContentType) config.headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await api(config);          // <- uses axios instance w/ token interceptor
    return res.data;
  } catch (err) {
    // Convert axios error to the same APIError you export
    throw new APIError(err.message, err.response?.status ?? 0, err.response?.data);
  }
};


export default api;
