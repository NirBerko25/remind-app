import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { colors } from '../constants/colors';
import { initializeNotifications } from '../services/notifications';

export default function RoleSelectScreen() {
  const { setRole, patientId } = useApp();

  const handleRoleSelect = async (selectedRole) => {
    await setRole(selectedRole);
    initializeNotifications(patientId, selectedRole).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Gradient hero section */}
      <LinearGradient
        colors={colors.gradientHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🧠</Text>
        </View>
        <Text style={styles.title}>ReMind</Text>
        <Text style={styles.subtitle}>AI Assistant for Alzheimer's Care</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Role selection buttons */}
        <View style={styles.buttonsContainer}>
          <Text style={styles.promptText}>Who are you?</Text>

          <TouchableOpacity
            onPress={() => handleRoleSelect('patient')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="I am a Patient"
            style={styles.patientButtonWrapper}
          >
            <LinearGradient
              colors={colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.patientButton}
            >
              <Text style={styles.patientButtonIcon}>👤</Text>
              <Text style={styles.patientButtonText}>I am a Patient</Text>
              <Text style={styles.buttonSubtext}>Simple voice assistant</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.caregiverButton}
            onPress={() => handleRoleSelect('caregiver')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="I am a Caregiver"
          >
            <Text style={styles.caregiverButtonIcon}>🩺</Text>
            <Text style={styles.caregiverButtonText}>I am a Caregiver</Text>
            <Text style={styles.caregiverButtonSubtext}>Monitor & manage patient care</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Your choice will be remembered for next time
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 44,
    paddingHorizontal: 28,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoEmoji: {
    fontSize: 50,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  promptText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  patientButtonWrapper: {
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  patientButton: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  patientButtonIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  patientButtonText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
  },
  caregiverButton: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  caregiverButtonIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  caregiverButtonText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  caregiverButtonSubtext: {
    fontSize: 15,
    color: colors.textMuted,
  },
  footerText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
