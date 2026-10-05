import api from './axios';

export const listMeetings = () => api.get('/meetings');
export const getMeeting = (code) => api.get(`/meetings/${encodeURIComponent(code)}`);
export const createMeeting = (payload) => api.post('/meetings', payload);
export const joinMeeting = (code) => api.post(`/meetings/${encodeURIComponent(code)}/join`);
export const startMeeting = (code) => api.post(`/meetings/${encodeURIComponent(code)}/start`);
export const endMeeting = (code) => api.post(`/meetings/${encodeURIComponent(code)}/end`);
export const leaveMeeting = (code) => api.post(`/meetings/${encodeURIComponent(code)}/leave`);
export const updateMeetingSettings = (code, settings) => api.patch(`/meetings/${encodeURIComponent(code)}/settings`, settings);
export const admitParticipant = (code, userId) => api.post(`/meetings/${encodeURIComponent(code)}/admit`, { userId });
export const getMeetingParticipants = (code) => api.get(`/meetings/${encodeURIComponent(code)}/participants`);
