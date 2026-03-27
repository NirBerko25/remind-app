import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

let _webUtterance = null;
let _chromeResumeTimer = null;

function waitForVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function startChromeResume() {
  stopChromeResume();
  _chromeResumeTimer = setInterval(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  }, 5000);
}

function stopChromeResume() {
  if (_chromeResumeTimer) { clearInterval(_chromeResumeTimer); _chromeResumeTimer = null; }
}

export function warmUpSpeech() {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

export async function speakText(text, options = {}) {
  if (!text || text.trim().length === 0) return;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    if (_webUtterance || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      _webUtterance = null;
      await new Promise((r) => setTimeout(r, 100));
    }
    await waitForVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = options.rate ?? 0.85;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Google UK English Female','Google US English Female','Google UK English Male','Google US English','Microsoft Aria Online (Natural)'];
    let chosen = null;
    for (const name of preferred) { chosen = voices.find(v => v.name === name); if (chosen) break; }
    if (!chosen) chosen = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
    if (chosen) utterance.voice = chosen;

    utterance.onstart = () => { startChromeResume(); options.onStart?.(); };
    utterance.onend = () => { stopChromeResume(); _webUtterance = null; options.onDone?.(); };
    utterance.onerror = (e) => {
      stopChromeResume(); _webUtterance = null;
      if (e.error === 'interrupted' || e.error === 'canceled') { options.onStopped?.(); }
      else { options.onError?.(e); }
    };
    _webUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } else {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      pitch: options.pitch ?? 1.0,
      rate: options.rate ?? 0.85,
      volume: options.volume ?? 1.0,
      onStart: options.onStart,
      onDone: options.onDone,
      onStopped: options.onStopped,
      onError: options.onError,
    });
  }
}

export function stopSpeaking() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    stopChromeResume(); window.speechSynthesis.cancel(); _webUtterance = null;
  } else { Speech.stop(); }
}

export async function isSpeaking() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    return window.speechSynthesis.speaking;
  }
  return Speech.isSpeakingAsync();
}
