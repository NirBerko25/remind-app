import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../constants/colors';
import { getAlerts, resolveAlert } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { API_BASE_URL } from '../../constants/config';

function formatAlertTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFullTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function AlertCard({ alert, onResolve }) {
  const [resolving, setResolving] = React.useState(false);
  const patientName = alert.patientName || alert.patient_name || 'Patient';
  const timestamp = alert.triggered_at || alert.timestamp || alert.createdAt || alert.created_at;
  const resolved = alert.resolved || false;
  const notifCount = alert.notifications_sent ?? alert.notificationsSent;

  const handleResolve = async () => {
    setResolving(true);
    try {
      await resolveAlert(alert.id || alert._id);
      onResolve(alert.id || alert._id);
    } catch (_) {
      setResolving(false);
    }
  };

  return (
    <View style={[styles.card, resolved && styles.cardResolved]}>
      <View style={styles.cardLeft}>
        <View style={[styles.alertIcon, resolved && styles.alertIconResolved]}>
          <Text style={styles.alertIconText}>{resolved ? '✓' : '🆘'}</Text>
        </View>
        <Text style={[styles.alertRelTime, resolved && styles.alertRelTimeResolved]}>
          {formatAlertTime(timestamp)}
        </Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardTitle, resolved && styles.cardTitleResolved]}>
            {resolved ? 'Handled' : 'SOS Alert'}
          </Text>
          {!resolved && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentBadgeText}>URGENT</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardPatient}>{patientName}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaItem}>📅 {formatFullTime(timestamp)}</Text>
          {notifCount != null && (
            <Text style={styles.cardMetaItem}>
              🔔 {notifCount} notification{notifCount !== 1 ? 's' : ''} sent
            </Text>
          )}
        </View>
        {alert.note || alert.message ? (
          <Text style={styles.cardNote} numberOfLines={2}>
            {alert.note || alert.message}
          </Text>
        ) : null}
        {!resolved && (
          <TouchableOpacity
            style={styles.resolveButton}
            onPress={handleResolve}
            disabled={resolving}
            activeOpacity={0.8}
          >
            {resolving ? (
              <ActivityIndicator size="small" color={colors.secondary} />
            ) : (
              <Text style={styles.resolveButtonText}>✓ Mark as Handled</Text>
            )}
          </TouchableOpacity>
        )}
        {resolved && alert.resolved_at && (
          <Text style={styles.resolvedAt}>
            Handled {formatAlertTime(alert.resolved_at)}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const { patientId } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [liveAlert, setLiveAlert] = useState(null);
  const sseRef = useRef(null);

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      const data = await getAlerts();
      const alertList = Array.isArray(data) ? data : data.alerts || [];
      // Sort by most recent first
      alertList.sort((a, b) => {
        const aTime = new Date(a.timestamp || a.createdAt || 0);
        const bTime = new Date(b.timestamp || b.createdAt || 0);
        return bTime - aTime;
      });
      setAlerts(alertList);
    } catch (err) {
      setError('Could not load alerts. Check your connection.');
      console.error('AlertsScreen error:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadAlerts();
      setLoading(false);
    }
    init();
  }, []);

  // SSE subscription — receive live SOS alerts pushed from the backend
  useEffect(() => {
    if (!patientId) return;
    // EventSource is available on web; skip on native (Expo push handles it there)
    if (typeof EventSource === 'undefined') return;

    const sseUrl = `${API_BASE_URL}/sos/stream?patientId=${patientId}`;
    const es = new EventSource(sseUrl);
    sseRef.current = es;

    es.addEventListener('sos', (e) => {
      try {
        const data = JSON.parse(e.data);
        // Show a prominent in-app banner
        setLiveAlert(data);
        // Also prepend to the alerts list immediately
        const newAlert = {
          id: `live-${Date.now()}`,
          patient_name: data.patientName,
          triggered_at: data.triggeredAt,
          notifications_sent: 1,
        };
        setAlerts((prev) => [newAlert, ...prev]);
        // Browser notification if permitted
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🆘 SOS Alert', { body: data.message });
        }
      } catch (err) {
        console.error('[SSE] Parse error:', err);
      }
    });

    es.onerror = () => {
      console.warn('[SSE] Connection error, will retry automatically');
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [patientId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const resolvedAlerts = alerts.filter((a) => a.resolved);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.danger} />
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAlerts}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Live SSE alert banner */}
      {liveAlert && (
        <TouchableOpacity
          onPress={() => setLiveAlert(null)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#DC2626', '#B91C1C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.liveBanner}
          >
            <Text style={styles.liveBannerTitle}>🆘 SOS ALERT RECEIVED</Text>
            <Text style={styles.liveBannerBody}>{liveAlert.message}</Text>
            <Text style={styles.liveBannerDismiss}>Tap to dismiss</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Active alerts count banner */}
      {activeAlerts.length > 0 && (
        <View style={styles.activeBanner}>
          <View style={styles.activeBannerDot} />
          <Text style={styles.activeBannerText}>
            {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''} require attention
          </Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(item, index) => item.id || item._id || String(index)}
        renderItem={({ item }) => (
          <AlertCard
            alert={item}
            onResolve={(id) =>
              setAlerts((prev) =>
                prev.map((a) => (a.id === id ? { ...a, resolved: true, resolved_at: Date.now() } : a))
              )
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.danger}
          />
        }
        ListHeaderComponent={
          alerts.length > 0 ? (
            <Text style={styles.listHeader}>
              Pull down to refresh • {alerts.length} alert{alerts.length !== 1 ? 's' : ''} total
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>No SOS alerts</Text>
            <Text style={styles.emptySubtext}>
              SOS alerts will appear here when the patient needs help.
              {'\n\n'}Pull down to check for new alerts.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 17,
    color: colors.textMuted,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  retryText: {
    fontSize: 17,
    color: colors.white,
    fontWeight: '600',
  },
  liveBanner: {
    padding: 18,
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  liveBannerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveBannerBody: {
    color: colors.white,
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.92,
  },
  liveBannerDismiss: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeBanner: {
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  activeBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  listContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  listHeader: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  cardResolved: {
    borderColor: colors.border,
    borderLeftColor: colors.secondary,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardLeft: {
    width: 56,
    alignItems: 'center',
    paddingTop: 2,
    gap: 6,
  },
  alertIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconResolved: {
    backgroundColor: '#DCFCE7',
  },
  alertIconText: {
    fontSize: 22,
  },
  alertRelTime: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
  alertRelTimeResolved: {
    color: colors.textMuted,
  },
  cardContent: {
    flex: 1,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger,
  },
  cardTitleResolved: {
    color: colors.secondary,
    fontWeight: '700',
  },
  urgentBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 0.5,
  },
  cardPatient: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  cardMeta: {
    gap: 3,
  },
  cardMetaItem: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  cardNote: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 2,
  },
  resolveButton: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resolveButtonText: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '700',
  },
  resolvedAt: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    paddingTop: 80,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 17,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 26,
  },
});
