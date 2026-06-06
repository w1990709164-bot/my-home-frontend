import axios from 'axios';
import BASE_URL from './config';

const api = axios.create({ baseURL: BASE_URL });

export const getSessions = () => api.get('/sessions');
export const createSession = (name) => api.post('/sessions', { name });
export const deleteSession = (id) => api.delete(`/sessions/${id}`);
export const renameSession = (id, name) => api.patch(`/sessions/${id}`, { name });

export const getMessages = (sessionId) => api.get(`/messages/${sessionId}`);
export const sendMessage = (session_id, message, model) =>
  api.post('/chat', { session_id, message, model });

export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.patch('/settings', data);

export const getMemories = () => api.get('/memories');

export const getDiary = () => api.get('/diary');
export const createDiary = (content, mood) => api.post('/diary', { content, mood });

export const getSchedules = () => api.get('/schedules');
export const createSchedule = (name, due_at, tag) => api.post('/schedules', { name, due_at, tag });
export const updateSchedule = (id, data) => api.patch(`/schedules/${id}`, data);
export const deleteSchedule = (id) => api.delete(`/schedules/${id}`);