import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

let _webUtterance = null;
let _chromeResumeTimer = null;

// ---------------------------------------------------------------------------
// Web helpers
// ---------------------------------------------------------------------------

/**
 * Chrome bug: speechSynthesis.speak() fires onend immediately if voices
 * haven't loaded yet. Wait until getVoices() returns at least one entry.
 */
function waitForVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

/**
 * Chrome bug: after ~15 s the synthesis engine pauses itself and never
 * resumes unless you call resume() periodically.
 */
function startChromeResume() {
  stopChromeResume();
  _chromeResumeTimer = setInterval(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 5000);
}

function stopChromeResume() {
  if (_chromeResumeTimer) {
    clearInterval(_chromeResumeTimer);
    _chromeResumeTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call this during a button press (user gesture) before any async work.
 * Chrome requires speech synthesis to be activated within a user gesture.
 * A zero-volume utterance "unlocks" it for the rest of the session.
 */
export function warmUpSpeech() {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

/** Returns true if the text contains Hebrew characters. */
function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

export async function speakText(text, options = {}) {
  if (!text || text.trim().length === 0) return;

  const hebrew = isHebrew(text);
  const lang = hebrew ? 'he-IL' : 'en-US';

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    // Cancel any in-progress utterance first
    if (_webUtterance || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      _webUtterance = null;
      // Chrome needs a tick after cancel before the next speak() works reliably
      await new Promise((r) => setTimeout(r, 100));
    }

    // Wait for TTS voices to be available (Chrome loads them asynchronously)
    await waitForVoices();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = options.rate ?? 0.85;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    let chosen = null;

    if (hebrew) {
      // Prefer high-quality Hebrew voices
      const hebrewPreferred = [
        'Google Hebrew',
        'Microsoft Avri Online (Natural)',
        'Microsoft Hillel Online (Natural)',
      ];
      for (const name of hebrewPreferred) {
        chosen = voices.find(v => v.name === name);
        if (chosen) break;
      }
      // Fallback: any he-IL voice
      if (!chosen) chosen = voices.find(v => v.lang === 'he-IL');
      if (!chosen) chosen = voices.find(v => v.lang.startsWith('he'));
    } else {
      // English voices — prefer neural/online voices
      const englishPreferred = [
        'Google UK English Female',
        'Google US English Female',
        'Google UK English Male',
        'Google US English',
        'Microsoft Aria Online (Natural)',
        'Microsoft Jenny Online (Natural)',
        'Microsoft Guy Online (Natural)',
      ];
      for (const name of englishPreferred) {
        chosen = voices.find(v => v.name === name);
        if (chosen) break;
      }
      if (!chosen) chosen = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
      if (!chosen) chosen = voices.find(v => v.localService === false && v.lang.startsWith('en'));
    }

    if (chosen) utterance.voice = chosen;

    utterance.onstart = () => {
      startChromeResume();
      options.onStart?.();
    };

    utterance.onend = () => {
      stopChromeResume();
      _webUtterance = null;
      options.onDone?.();
    };

    // onerror fires on real errors AND when cancel() interrupts mid-speech
    utterance.onerror = (e) => {
      stopChromeResume();
      _webUtterance = null;
      if (e.error === 'interrupted' || e.error === 'canceled') {
        options.onStopped?.();
      } else {
        options.onError?.(e);
      }
    };

    _webUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } else {
    // Native: expo-speech
    Speech.stop();
    Speech.speak(text, {
      language: lang,
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
    stopChromeResume();
    window.speechSynthesis.cancel();
    _webUtterance = null;
  } else {
    Speech.stop();
  }
}

export async function isSpeaking() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    return window.speechSynthesis.speaking;
  }
  return Speech.isSpeakingAsync();
}
