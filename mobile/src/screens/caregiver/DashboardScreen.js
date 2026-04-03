import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { colors } from '../../constants/colors';

// The caregiver dashboard is a simple landing that directs to tabs.
// Main navigation happens via the bottom tabs — this screen acts as
// a "home" for the History tab's initial display.
export default function CaregiverDashboard() {
  const { patientName, patientId, clearRole } = useApp();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Caregiver View</Text>
          <Text style={styles.subtitle}>Monitoring: {patientName || 'Patient'}</Text>
          <Text style={styles.patientId}>ID: {patientId}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Quick Guide</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>💬</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>History</Text> — View all past conversations with the AI assistant
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📋</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Context</Text> — Edit patient profile, medications, and routines
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🔔</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Alerts</Text> — See all SOS emergency events
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={clearRole}
          activeOpacity={0.8}
        >
          <Text style={styles.switchButtonText}>Switch to Patient Mode</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  header: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  patientId: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'monospace',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  infoText: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 26,
    flex: 1,
  },
  infoBold: {
    fontWeight: '700',
    color: colors.primary,
  },
  switchButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  switchButtonText: {
    fontSize: 17,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
