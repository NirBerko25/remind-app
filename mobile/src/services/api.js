import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  (config) => { console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`); return config; },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Network error';
    console.error(`[API Error] ${message}`, error.response?.status);
    return Promise.reject(new Error(message));
  }
);

export async function sendMessage(patientId, message, conversationId = null) {
  const response = await apiClient.post('/chat', { patientId, message, conversationId });
  return response.data;
}

export async function transcribeAudio(audioUri) {
  const formData = new FormData();
  if (typeof document !== 'undefined') {
    const blobRes = await fetch(audioUri);
    const blob = await blobRes.blob();
    const ext = blob.type.split('/')[1]?.split(';')[0] || 'webm';
    formData.append('audio', blob, `recording.${ext}`);
  } else {
    const filename = audioUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `audio/${match[1]}` : 'audio/m4a';
    formData.append('audio', { uri: audioUri, name: filename || 'recording.m4a', type });
  }
  const response = await apiClient.post('/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return response.data;
}

export async function triggerSOS(patientId) {
  const response = await apiClient.post('/sos', { patientId });
  return response.data;
}

export async function getConversations(patientId) {
  const response = await apiClient.get(`/conversations/${patientId}`);
  return response.data;
}

export async function getConversationDetail(conversationId) {
  const response = await apiClient.get(`/conversations/detail/${conversationId}`);
  return response.data;
}

export async function getConversationSummary(conversationId) {
  const response = await apiClient.get(`/conversations/summary/${conversationId}`);
  return response.data;
}

export async function getContext(patientId) {
  const response = await apiClient.get(`/context/${patientId}`);
  return response.data;
}

export async function updateContext(patientId, context) {
  const response = await apiClient.put(`/context/${patientId}`, context);
  return response.data;
}

export async function getPatients() {
  const response = await apiClient.get('/patients');
  return response.data;
}

export async function registerDevice(patientId, expoPushToken, role) {
  const response = await apiClient.post('/devices/register', { patientId, expoPushToken, role });
  return response.data;
}

export async function getAlerts() {
  const response = await apiClient.get('/sos/alerts');
  return response.data;
}
