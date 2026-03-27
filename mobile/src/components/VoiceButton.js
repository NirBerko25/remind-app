import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';

export default function VoiceButton({ state = 'idle', onPress, disabled = false }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const outerPulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulseAnim.stopAnimation();
    outerPulseAnim.stopAnimation();
    rotateAnim.stopAnimation();

    if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(outerPulseAnim, { toValue: 1.22, duration: 700, useNativeDriver: true }),
          Animated.timing(outerPulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else if (state === 'processing') {
      pulseAnim.setValue(1);
      outerPulseAnim.setValue(1);
      Animated.loop(
        Animated.timing(rotateAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ).start();
    } else if (state === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      outerPulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [state]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const getGradient = () => {
    switch (state) {
      case 'listening': return ['#F97316', '#EF4444'];
      case 'processing': return colors.gradientPrimary;
      case 'speaking': return colors.gradientSuccess;
      default: return colors.gradientPrimary;
    }
  };

  const getGlowColor = () => {
    switch (state) {
      case 'listening': return 'rgba(249, 115, 22, 0.35)';
      case 'speaking': return 'rgba(16, 185, 129, 0.35)';
      default: return 'rgba(79, 110, 247, 0.35)';
    }
  };

  return (
    <View style={styles.container}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.outerGlow,
          { backgroundColor: getGlowColor(), transform: [{ scale: outerPulseAnim }] },
        ]}
      />
      {/* Inner ring */}
      <Animated.View
        style={[
          styles.innerRing,
          { borderColor: getGradient()[0] + '55', transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: state === 'processing' ? spin : '0deg' }] }}>
          <TouchableOpacity
            onPress={onPress}
            disabled={disabled || state === 'processing'}
            activeOpacity={0.88}
            accessibilityRole="button"
            style={styles.touchable}
          >
            <LinearGradient
              colors={getGradient()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {state === 'processing' ? (
                <ActivityIndicator size="large" color={colors.white} />
              ) : (
                <MicIcon state={state} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function MicIcon({ state }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.micBody, state === 'speaking' && styles.micBodySpeaking]} />
      <View style={styles.micStand} />
      <View style={styles.micBase} />
    </View>
  );
}

const BUTTON_SIZE = 116;
const RING_SIZE = BUTTON_SIZE + 24;
const GLOW_SIZE = BUTTON_SIZE + 52;

const styles = StyleSheet.create({
  container: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
  },
  innerRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    borderRadius: BUTTON_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 14,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  micBody: {
    width: 22,
    height: 32,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: 'transparent',
  },
  micBodySpeaking: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  micStand: {
    width: 3,
    height: 10,
    marginTop: 2,
    backgroundColor: colors.white,
  },
  micBase: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
});
