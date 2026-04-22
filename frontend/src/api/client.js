import axios from 'axios';

const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

const API_BASE = base ? `${base}/api` : "/api";

const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token and redirect
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ===== Auth =====
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// ===== Users =====
export const usersAPI = {
  me: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  updatePassword: (data) => api.put('/users/me/password', data),
  deleteAccount: () => api.delete('/users/me'),
};

// ===== Issues =====
export const issuesAPI = {
  create: (formData) => api.post('/issues', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (params) => api.get('/issues', { params }),
  get: (id) => api.get(`/issues/${id}`),
  verify: (id, data) => api.post(`/issues/${id}/verify`, data),
  uploadMedia: (id, formData) => api.post(`/issues/${id}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/issues/${id}`),
};

// ===== Admin =====
export const adminAPI = {
  listIssues: (params) => api.get('/admin/issues', { params }),
  getIssue: (id) => api.get(`/admin/issues/${id}`),
  updateIssue: (id, data) => api.put(`/admin/issues/${id}`, data),
  assignOfficer: (id, data) => api.post(`/admin/issues/${id}/assign`, data),
  resolveIssue: (id, data) => api.post(`/admin/issues/${id}/resolve`, data),
  aiFeedback: (id, isCorrect) => api.post(`/admin/issues/${id}/ai-feedback`, { is_correct: isCorrect }),
  uploadAfterImage: (id, formData) => api.post(`/admin/issues/${id}/after-image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listDepartments: () => api.get('/admin/departments'),
  listOfficers: (params) => api.get('/admin/officers', { params }),
  getAuditLog: (params) => api.get('/admin/audit-log', { params }),
  listUsers: (params) => api.get('/admin/users', { params }),
  // Real officer management
  listRealOfficers: (params) => api.get('/admin/real-officers', { params }),
  createOfficer: (data) => api.post('/admin/real-officers', data),
  officerStats: () => api.get('/admin/officer-stats'),
};

// ===== Officer =====
export const officerAPI = {
  register: (data) => api.post('/officer/register', data),
  login: (data) => api.post('/officer/login', data),
  me: () => api.get('/officer/me'),
  updateProfile: (data) => api.put('/officer/me', data),
  toggleLeave: (data) => api.put('/officer/leave', data),
  stats: () => api.get('/officer/stats'),
  currentIssue: () => api.get('/officer/current-issue'),
  previousIssues: (params) => api.get('/officer/previous-issues', { params }),
  resolveIssue: (id, data) => api.post(`/officer/issues/${id}/resolve`, data),
  uploadAfterImage: (id, formData) => api.post(`/officer/issues/${id}/after-image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  aiFeedback: (id, isCorrect) => api.post(`/officer/issues/${id}/ai-feedback`, { is_correct: isCorrect }),
  deleteAccount: () => api.delete('/officer/me'),
};

// ===== Analytics =====
export const analyticsAPI = {
  overview: () => api.get('/analytics/overview'),
  byDepartment: () => api.get('/analytics/by-department'),
  byIssueType: () => api.get('/analytics/by-issue-type'),    // NEW
  byCategory: () => api.get('/analytics/by-category'),        // kept for backward compat
  byStatus: () => api.get('/analytics/by-status'),
  bySeverity: () => api.get('/analytics/by-severity'),
  aiAccuracy: () => api.get('/analytics/ai-accuracy'),
  geographic: () => api.get('/analytics/geographic'),
  timeline: (days) => api.get('/analytics/timeline', { params: { days } }),
};

// ===== Notifications =====
export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (ids) => api.post('/notifications/mark-read', { notification_ids: ids }),
  markAllRead: () => api.post('/notifications/mark-all-read'),
};

// ===== Reference Data =====
export const referenceAPI = {
  departments: () => api.get('/reference/departments'),
  issueTypes: (params) => api.get('/reference/issue-types', { params }),
  // Returns [{department_id, department_name, department_code, issue_types: [{id, name}]}]
  categories: () => api.get('/reference/categories'),
};

export default api;
