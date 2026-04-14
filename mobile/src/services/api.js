import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Network error';
    console.error(`[API Error] ${message}`, error.response?.status);
    return Promise.reject(new Error(message));
  }
);

/**
 * Send a chat message and receive an AI response.
 * @param {string} patientId
 * @param {string} message
 * @param {string|null} conversationId
 */
export async function sendMessage(patientId, message, conversationId = null) {
  const response = await apiClient.post('/chat', {
    patientId,
    message,
    conversationId,
  });
  return response.data;
}

/**
 * Upload audio file for transcription.
 * @param {string} audioUri - local file URI from expo-av
 * @returns {{ transcript: string }}
 */
export async function transcribeAudio(audioUri) {
  const formData = new FormData();

  if (typeof document !== 'undefined') {
    // Web: audioUri is a blob: URL — fetch it to get the actual Blob
    const blobRes = await fetch(audioUri);
    const blob = await blobRes.blob();
    const ext = blob.type.split('/')[1]?.split(';')[0] || 'webm';
    formData.append('audio', blob, `recording.${ext}`);
  } else {
    // Native: React Native FormData accepts { uri, name, type }
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

/**
 * Trigger an SOS alert for a patient.
 * @param {string} patientId
 */
export async function triggerSOS(patientId) {
  const response = await apiClient.post('/sos', { patientId });
  return response.data;
}

/**
 * Get list of conversations for a patient.
 * @param {string} patientId
 */
export async function getConversations(patientId) {
  const response = await apiClient.get(`/conversations/${patientId}`);
  return response.data;
}

/**
 * Get full detail of a single conversation.
 * @param {string} conversationId
 */
export async function getConversationDetail(conversationId) {
  const response = await apiClient.get(`/conversations/detail/${conversationId}`);
  return response.data;
}

/**
 * Get AI-generated summary of a conversation.
 * @param {string} conversationId
 */
export async function getConversationSummary(conversationId) {
  const response = await apiClient.get(`/conversations/summary/${conversationId}`);
  return response.data;
}

/**
 * Get patient context/profile.
 * @param {string} patientId
 */
export async function getContext(patientId) {
  const response = await apiClient.get(`/context/${patientId}`);
  return response.data;
}

/**
 * Update patient context/profile.
 * @param {string} patientId
 * @param {object} context
 */
export async function updateContext(patientId, context) {
  const response = await apiClient.put(`/context/${patientId}`, context);
  return response.data;
}

/**
 * Get list of all patients.
 */
export async function getPatients() {
  const response = await apiClient.get('/patients');
  return response.data;
}

/**
 * Register device push token with the backend.
 * @param {string} patientId
 * @param {string} expoPushToken
 * @param {string} role - 'patient' | 'caregiver'
 */
export async function registerDevice(patientId, expoPushToken, role) {
  const response = await apiClient.post('/devices/register', {
    patientId,
    expoPushToken,
    role,
  });
  return response.data;
}

/**
 * Search for a song on YouTube and return its video ID.
 * @param {string} query
 */
export async function searchSong(query) {
  const response = await apiClient.get(`/song/search?q=${encodeURIComponent(query)}`);
  return response.data;
}

/**
 * Get SOS alerts (for caregiver view).
 */
export async function getAlerts() {
  const response = await apiClient.get('/sos/alerts');
  return response.data;
}

/**
 * Mark an SOS alert as handled/resolved.
 * @param {string} alertId
 */
export async function resolveAlert(alertId) {
  const response = await apiClient.patch(`/sos/alerts/${alertId}/resolve`);
  return response.data;
}
