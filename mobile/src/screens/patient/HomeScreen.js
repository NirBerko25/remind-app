import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  TouchableOpacity,
  Alert,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { Platform } from 'react-native';
import { colors } from '../../constants/colors';
import VoiceButton from '../../components/VoiceButton';
import SOSButton from '../../components/SOSButton';
import ConversationBubble from '../../components/ConversationBubble';
import LocationStatusBanner from '../../components/LocationStatusBanner';
import AIFace from '../../components/AIFace';
import { sendMessage, transcribeAudio, triggerSOS, getContext, searchSong, getSafeZones, reportLocationBreach } from '../../services/api';
import { speakText, stopSpeaking, warmUpSpeech } from '../../services/speech';
import { API_BASE_URL } from '../../constants/config';
import { startGeofencing, stopGeofencing, updateZonesCache, isInsideZone } from '../../services/geofencing';
import * as Location from 'expo-location';

const MIC_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
};

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getCurrentDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function PatientHomeScreen() {
  const { patientName, patientId, clearRole } = useApp();
  const [micState, setMicState] = useState(MIC_STATES.IDLE);
  const [messages, setMessages] = useState([]);
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [recording, setRecording] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [sosConfirmedVisible, setSosConfirmedVisible] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [showCareAlert, setShowCareAlert] = useState(false);
  const [micLabel, setMicLabel] = useState('Tap to talk');
  const [showMicPermModal, setShowMicPermModal] = useState(false);
  const [patientContext, setPatientContext] = useState(null);
  const [songVideoId, setSongVideoId] = useState(null);
  const scrollViewRef = useRef(null);

  // Waveform animation bars
  const waveAnims = useRef([...Array(7)].map(() => new Animated.Value(0.3))).current;
  const waveLoopRef = useRef(null);
  const speakFallbackRef = useRef(null);
  const webRecognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  // Update clock every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getCurrentTime()), 60000);
    return () => clearInterval(interval);
  }, []);


  // Audio permissions on mount
  useEffect(() => {
    setupAudio();
    return () => {
      stopSpeaking();
    };
  }, []);

  // Foreground location polling — works on web and native, always uses fresh zone data
  const lastBreachRef = useRef(0);
  const FOREGROUND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between alerts
  const POLL_INTERVAL_MS = 20 * 1000; // check every 20s

  useEffect(() => {
    if (!patientId) return;

    const checkLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const [loc, zones] = await Promise.all([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          getSafeZones(patientId),
        ]);

        updateZonesCache(zones);
        if (!zones.length) return;

        const { latitude, longitude } = loc.coords;
        const inZone = zones.some(z => isInsideZone(z, latitude, longitude));
        if (!inZone) {
          const now = Date.now();
          if (now - lastBreachRef.current < FOREGROUND_COOLDOWN_MS) return;
          lastBreachRef.current = now;
          await reportLocationBreach(patientId, latitude, longitude);
        }
      } catch {
        // location is non-critical
      }
    };

    // Kick off immediately, then poll
    checkLocation();
    const interval = setInterval(checkLocation, POLL_INTERVAL_MS);

    // Also start native background task (no-op on web)
    getSafeZones(patientId)
      .then(zones => { if (zones.length > 0) startGeofencing(); })
      .catch(() => {});

    return () => {
      clearInterval(interval);
      stopGeofencing();
    };
  }, [patientId]);

  // Load patient context on mount
  useEffect(() => {
    if (!patientId) return;
    getContext(patientId)
      .then((data) => {
        setPatientContext({
          name: data.name || '',
          age: data.age || null,
          dailyRoutine: data.dailyRoutine || data.daily_routine || '',
          medications: Array.isArray(data.medications)
            ? data.medications.map((m) =>
                typeof m === 'string' ? m : [m.name, m.dosage, m.time].filter(Boolean).join(' ')
              )
            : [],
          familyMembers: Array.isArray(data.family) ? data.family : [],
          notes: data.notes || '',
          favoriteSong: data.favoriteSong || null,
          language: data.language || 'he',
        });
      })
      .catch(() => {}); // fail silently — context is optional
  }, [patientId]);

  const setupAudio = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Access',
          'Please allow microphone access in Settings to use voice features.',
          [{ text: 'OK' }]
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (err) {
      console.error('Audio setup error:', err);
    }
  };

  // Waveform animation when listening
  useEffect(() => {
    if (micState === MIC_STATES.LISTENING) {
      if (Platform.OS === 'web') {
        // Real audio data drives the bars — start the visualizer
        startAudioVisualizer();
      } else {
        // Native: CSS pulse animation
        const animations = waveAnims.map((anim, i) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(i * 80),
              Animated.timing(anim, {
                toValue: 1,
                duration: 400 + i * 60,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: false,
              }),
              Animated.timing(anim, {
                toValue: 0.2,
                duration: 400 + i * 60,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: false,
              }),
            ])
          )
        );
        waveLoopRef.current = Animated.parallel(animations);
        waveLoopRef.current.start();
      }
    } else {
      waveLoopRef.current?.stop();
      stopAudioVisualizer();
    }
    return () => {
      waveLoopRef.current?.stop();
      stopAudioVisualizer();
    };
  }, [micState]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const addMessage = useCallback((text, sender) => {
    const msg = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    };
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();
    return msg;
  }, [scrollToBottom]);

  const startAudioVisualizer = async () => {
    if (Platform.OS !== 'web') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = { ctx, analyser, stream };

      const data = new Uint8Array(analyser.frequencyBinCount);
      const NUM_BARS = waveAnims.length;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const slice = Math.floor(data.length / NUM_BARS);
        for (let i = 0; i < NUM_BARS; i++) {
          const avg = data.slice(i * slice, i * slice + slice)
            .reduce((a, b) => a + b, 0) / slice;
          const normalized = Math.max(0.15, Math.min(1, avg / 180));
          waveAnims[i].setValue(normalized);
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch (_) {
      // permission denied or not available — silent fallback to CSS animation
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.stream?.getTracks().forEach((t) => t.stop());
      audioContextRef.current.ctx?.close();
      audioContextRef.current = null;
    }
    waveAnims.forEach((a) => a.setValue(0.3));
  };

  const handleMicPress = async () => {
    if (micState === MIC_STATES.LISTENING) {
      await stopRecording();
    } else if (micState === MIC_STATES.IDLE) {
      warmUpSpeech(); // activate Chrome's speech synthesis during this user gesture
      await startRecording();
    } else if (micState === MIC_STATES.SPEAKING) {
      clearTimeout(speakFallbackRef.current);
      stopSpeaking();
      setMicState(MIC_STATES.IDLE);
      setMicLabel('Tap to talk');
    }
  };

  // Shared: takes a transcript string → sends to AI → speaks response
  const processTranscript = async (transcript) => {
    if (!transcript || transcript.trim().length === 0) {
      setMicState(MIC_STATES.IDLE);
      setMicLabel('Tap to talk');
      addMessage("I couldn't hear that. Please try again.", 'ai');
      return;
    }

    addMessage(transcript, 'user');

    try {
      setMicState(MIC_STATES.PROCESSING);
      setMicLabel('Thinking...');

      const response = await sendMessage(patientId, transcript, conversationId);
      const aiText = response.message || response.response || 'I am here to help you.';
      const newConversationId = response.conversationId || conversationId;
      if (newConversationId && !conversationId) setConversationId(newConversationId);

      addMessage(aiText, 'ai');

      if (response.detectedState === 'confused' || response.detectedState === 'emergency') {
        setShowCareAlert(true);
      }

      setMicState(MIC_STATES.SPEAKING);
      setMicLabel('Tap to stop');

      const resetToIdle = () => {
        clearTimeout(speakFallbackRef.current);
        setMicState(MIC_STATES.IDLE);
        setMicLabel('Tap to talk');
      };
      speakFallbackRef.current = setTimeout(resetToIdle, aiText.length * 90 + 3000);
      speakText(aiText, { language: patientContext?.language, onDone: resetToIdle, onStopped: resetToIdle, onError: resetToIdle })
        .catch(() => resetToIdle());
    } catch (err) {
      console.error('Voice flow error:', err);
      setMicState(MIC_STATES.IDLE);
      setMicLabel('Tap to talk');
      addMessage("I'm having trouble connecting right now. Please try again in a moment.", 'ai');
    }
  };

  const startRecording = async () => {
    stopSpeaking();

    // ── Web: use browser's built-in SpeechRecognition (no API key needed) ──
    if (Platform.OS === 'web') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        Alert.alert('Not supported', 'Speech recognition is not supported in this browser. Try Chrome.');
        return;
      }

      // Use MediaRecorder directly on web — more reliable than SpeechRecognition
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: mimeType });
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          try {
            const res = await fetch(`${API_BASE_URL}/transcribe`, {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();
            processTranscript(data.transcript || '');
          } catch (err) {
            console.error('[Transcribe] error:', err);
            processTranscript('');
          }
        };

        mediaRecorder.start();
        webRecognitionRef.current = mediaRecorder;
        setMicState(MIC_STATES.LISTENING);
        setMicLabel('Listening... Tap to stop');
      } catch (err) {
        if (err.name === 'NotAllowedError') setShowMicPermModal(true);
        else Alert.alert('Error', 'Could not access microphone.');
      }
      return;
    }

    // ── Native: expo-av recording ──
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { setShowMicPermModal(true); return; }

      setMicState(MIC_STATES.LISTENING);
      setMicLabel('Listening... Tap to stop');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setMicState(MIC_STATES.IDLE);
      setMicLabel('Tap to talk');
      const isPermError = err?.name === 'NotAllowedError' ||
        err?.message?.toLowerCase().includes('permission');
      if (isPermError) setShowMicPermModal(true);
      else Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    // ── Web: stop MediaRecorder ──
    if (Platform.OS === 'web') {
      if (webRecognitionRef.current) {
        const recorder = webRecognitionRef.current;
        webRecognitionRef.current = null;
        setMicState(MIC_STATES.PROCESSING);
        setMicLabel('Thinking...');
        recorder.stop(); // triggers onstop → Whisper transcription → processTranscript
      }
      return;
    }

    // ── Native: stop expo-av recording and upload ──
    if (!recording) return;
    try {
      setMicState(MIC_STATES.PROCESSING);
      setMicLabel('Thinking...');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error('No recording URI');

      let transcript = null;
      try {
        const result = await transcribeAudio(uri, patientContext?.language || 'he');
        transcript = result.transcript;
      } catch (err) {
        console.error('Transcription error:', err);
      }
      await processTranscript(transcript);
    } catch (err) {
      console.error('Voice flow error:', err);
      setMicState(MIC_STATES.IDLE);
      setMicLabel('Tap to talk');
      addMessage("I'm having trouble connecting right now. Please try again in a moment.", 'ai');
    }
  };

  const handleSOSPress = () => {
    setSosModalVisible(true);
    speakText('Do you need help? Press Yes if you need help, or No if you are okay.', { rate: 0.75, volume: 1.0, pitch: 1.1 });
  };

  const handleSOSConfirm = async () => {
    setSosLoading(true);
    try {
      await triggerSOS(patientId);
    } catch (err) {
      console.error('SOS error:', err);
      // Show success even if API fails — caregiver safety is priority
    } finally {
      setSosLoading(false);
      setSosModalVisible(false);
      setSosConfirmedVisible(true);
      speakText('Help is on the way. Your caregiver has been notified. Stay calm, you are safe.');
      // Search and load favorite song
      if (patientContext?.favoriteSong) {
        setSongVideoId(null);
        searchSong(patientContext.favoriteSong)
          .then(({ videoId }) => setSongVideoId(videoId))
          .catch(() => {});
      }
    }
  };

  const handleSOSCancel = () => {
    setSosModalVisible(false);
  };

  const handleSOSConfirmedDismiss = () => {
    setSosConfirmedVisible(false);
    setSongVideoId(null);
    setMicState(MIC_STATES.IDLE);
    setMicLabel('Tap to talk');
  };

  const stateLabel =
    micState === MIC_STATES.LISTENING  ? "I'm listening..." :
    micState === MIC_STATES.PROCESSING ? 'Just a moment...' :
    micState === MIC_STATES.SPEAKING   ? "I'm speaking..."  :
    messages.length > 0 ? 'Ready to listen' : 'How can I help you today?';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.exitBtn} onPress={clearRole} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.exitText}>Exit</Text>
        </TouchableOpacity>
        <Text style={styles.topClock}>{currentTime}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* ── AI Avatar card ── */}
      <View style={styles.avatarSection}>
        <LinearGradient
          colors={['#E8F2FF', '#F4F7FC']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={messages.length > 0 ? styles.avatarBubbleMini : styles.avatarBubble}
        >
          <AIFace micState={micState} mini={messages.length > 0} />
        </LinearGradient>
        <View style={styles.avatarMeta}>
          <Text style={styles.greetingName}>
            Hi, {patientContext?.name || patientName || 'Friend'}!
          </Text>
          <Text style={styles.stateText}>{stateLabel}</Text>
          <Text style={styles.dateSmall}>{getCurrentDate()}</Text>
        </View>
      </View>

      {/* ── Location banner ── */}
      <LocationStatusBanner patientId={patientId} />

      {/* ── Care alert ── */}
      {showCareAlert && (
        <TouchableOpacity style={styles.careAlert} onPress={() => setShowCareAlert(false)} activeOpacity={0.8}>
          <Ionicons name="warning" size={18} color="#92400E" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.careAlertText}>
              You seem a little confused. If you need help, press the red button below.
            </Text>
            <Text style={styles.careAlertDismiss}>Tap to dismiss</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Content: conversation OR info cards ── */}
      {messages.length > 0 ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <ConversationBubble
              key={msg.id}
              text={msg.text}
              sender={msg.sender}
              timestamp={msg.timestamp}
              large={true}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.infoGrid}>
          {patientContext?.medications?.length > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="medical-outline" size={15} color={colors.primary} />
                <Text style={styles.infoCardTitle}>Medications</Text>
              </View>
              {patientContext.medications.slice(0, 4).map((med, i) => (
                <Text key={i} style={styles.infoCardItem} numberOfLines={1}>· {med}</Text>
              ))}
              {patientContext.medications.length > 4 && (
                <Text style={styles.infoCardMore}>+{patientContext.medications.length - 4} more</Text>
              )}
            </View>
          )}
          {patientContext?.familyMembers?.length > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="people-outline" size={15} color={colors.secondary} />
                <Text style={[styles.infoCardTitle, { color: colors.secondary }]}>Your Family</Text>
              </View>
              {patientContext.familyMembers.slice(0, 4).map((m, i) => (
                <Text key={i} style={styles.infoCardItem} numberOfLines={1}>
                  · {m.name}{m.relation ? ` — ${m.relation}` : ''}
                </Text>
              ))}
            </View>
          )}
          {!!patientContext?.dailyRoutine && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="time-outline" size={15} color={colors.amber} />
                <Text style={[styles.infoCardTitle, { color: colors.amber }]}>Today's Routine</Text>
              </View>
              <Text style={styles.infoCardBody} numberOfLines={8}>{patientContext.dailyRoutine}</Text>
            </View>
          )}
          {!!patientContext?.notes && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="document-text-outline" size={15} color={colors.textMuted} />
                <Text style={[styles.infoCardTitle, { color: colors.textMuted }]}>Notes</Text>
              </View>
              <Text style={styles.infoCardBody} numberOfLines={6}>{patientContext.notes}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Waveform ── */}
      {micState === MIC_STATES.LISTENING && (
        <View style={styles.waveformContainer}>
          {waveAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                {
                  transform: [{ scaleY: anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
                  opacity: anim,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* ── Mic area ── */}
      <View style={styles.micArea}>
        <VoiceButton state={micState} onPress={handleMicPress} disabled={false} />
        <Text style={styles.micLabel}>{micLabel}</Text>
        {micState === MIC_STATES.SPEAKING && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={() => {
              clearTimeout(speakFallbackRef.current);
              stopSpeaking();
              setMicState(MIC_STATES.IDLE);
              setMicLabel('Tap to talk');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.stopButtonText}>Stop Speaking</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── SOS button ── */}
      <View style={styles.sosContainer}>
        <SOSButton onPress={handleSOSPress} />
      </View>

      {/* SOS Confirmation Modal */}
      <Modal
        visible={sosModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSOSCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🆘</Text>
            <Text style={styles.modalTitle}>Do you need help?</Text>
            <Text style={styles.modalBody}>
              This will send an alert to your caregiver right away.
            </Text>
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={handleSOSConfirm}
              disabled={sosLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.modalConfirmText}>
                {sosLoading ? 'Sending...' : 'Yes, I need help'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={handleSOSCancel}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>No, I'm okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SOS Confirmed Modal */}
      <Modal
        visible={sosConfirmedVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSOSConfirmedDismiss}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.modalCardSuccess]}>
            <Text style={styles.modalEmoji}>✅</Text>
            <Text style={styles.modalTitle}>Help is on the way!</Text>
            <Text style={styles.modalBody}>
              Your caregiver has been notified and will be with you soon.
              {'\n\n'}Stay calm — you are safe.
            </Text>

            {/* Favorite song — hidden iframe plays audio only, no visible player */}
            {patientContext?.favoriteSong && Platform.OS === 'web' && (
              <>
                <View style={styles.songPlayer}>
                  <Ionicons name="musical-notes" size={20} color={colors.secondary} />
                  <Text style={styles.songLabel}>
                    {songVideoId ? `Playing: ${patientContext.favoriteSong}` : 'Finding your favorite song...'}
                  </Text>
                </View>
                {songVideoId && (
                  // eslint-disable-next-line react-native/no-inline-styles
                  <iframe
                    src={`https://www.youtube.com/embed/${songVideoId}?autoplay=1&controls=0`}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    allow="autoplay; encrypted-media"
                  />
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.modalOkBtn}
              onPress={handleSOSConfirmedDismiss}
              activeOpacity={0.85}
            >
              <Text style={styles.modalConfirmText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Microphone Permission Modal */}
      <Modal
        visible={showMicPermModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMicPermModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🎤</Text>
            <Text style={styles.modalTitle}>Microphone Access Needed</Text>
            <Text style={styles.modalBody}>
              ReMind needs your microphone to hear your voice.
            </Text>
            <Text style={styles.permSteps}>
              {Platform.OS === 'web'
                ? '1. Click the 🔒 lock icon in your browser address bar\n2. Set Microphone to "Allow"\n3. Refresh the page and try again'
                : 'Go to Settings → ReMind → allow Microphone access, then try again.'}
            </Text>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => setShowMicPermModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalConfirmText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  exitText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  topClock: { fontSize: 34, fontWeight: '200', color: colors.text, letterSpacing: 1 },

  // Avatar section
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 16,
  },
  avatarBubble: {
    borderRadius: 48,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarBubbleMini: {
    borderRadius: 32,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarMeta: { flex: 1 },
  greetingName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  stateText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
    marginTop: 3,
  },
  dateSmall: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Care alert
  careAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E7',
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 20,
    padding: 14,
  },
  careAlertText: { fontSize: 16, color: '#92400E', lineHeight: 24, flex: 1 },
  careAlertDismiss: { fontSize: 12, color: '#B45309', marginTop: 4, fontStyle: 'italic' },

  // Messages
  messagesContainer: { flex: 1, paddingHorizontal: 12 },
  messagesContent: { paddingVertical: 16, flexGrow: 1, justifyContent: 'flex-end' },

  // Info cards — centered wrapping grid
  infoGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 12,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 16,
    width: 160,
    height: 150,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  infoCardItem: { fontSize: 15, color: colors.text, lineHeight: 24, fontWeight: '500' },
  infoCardMore: { fontSize: 12, color: colors.textLight, fontStyle: 'italic', marginTop: 2 },
  infoCardBody: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },

  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 6,
    marginBottom: 4,
  },
  waveBar: { width: 5, height: 32, borderRadius: 3, backgroundColor: colors.primary },

  // Mic area
  micArea: { alignItems: 'center', paddingVertical: 8 },
  micLabel: { marginTop: 12, fontSize: 17, color: colors.textMuted, fontWeight: '500' },
  stopButton: {
    marginTop: 12,
    backgroundColor: colors.secondary,
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 28,
  },
  stopButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  // SOS
  sosContainer: { paddingHorizontal: 28, paddingBottom: 24, paddingTop: 4 },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  modalCardSuccess: {
    borderTopWidth: 6,
    borderTopColor: colors.secondary,
  },
  modalEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 20,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 12,
  },
  permSteps: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 28,
    backgroundColor: colors.primaryLight,
    padding: 14,
    borderRadius: 12,
    width: '100%',
  },
  modalConfirmBtn: {
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalOkBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  modalCancelBtn: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textMuted,
  },
  songPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.secondaryLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    width: '100%',
  },
  songLabel: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '600',
    flex: 1,
  },
  // alias used in mic permission modal
  modalConfirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
});
