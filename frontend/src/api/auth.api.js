import api from './axios';

export const loginRequest = (credentials) => api.post('/auth/login', credentials);
export const registerRequest = (details) => api.post('/auth/register', details);
export const refreshRequest = () => api.post('/auth/refresh', {}, { skipAuthRefresh: true });
export const meRequest = () => api.get('/auth/me');
export const logoutRequest = () => api.post('/auth/logout', {}, { skipAuthRefresh: true });
