import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { colors } from '../../constants/colors';
import { getAlerts } from '../../services/api';

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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AlertCard({ alert }) {
  const patientName = alert.patientName || alert.patient_name || 'Patient';
  const timestamp = alert.triggered_at || alert.timestamp || alert.createdAt;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>SOS Alert</Text>
      <Text style={styles.cardPatient}>{patientName}</Text>
      <Text style={styles.cardTime}>{formatAlertTime(timestamp)}</Text>
    </View>
  );
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      const data = await getAlerts();
      const alertList = Array.isArray(data) ? data : data.alerts || [];
      alertList.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
      setAlerts(alertList);
    } catch (err) {
      setError('Could not load alerts. Check your connection.');
    }
  }, []);

  useEffect(() => {
    async function init() { setLoading(true); await loadAlerts(); setLoading(false); }
    init();
  }, []);

  const handleRefresh = async () => { setRefreshing(true); await loadAlerts(); setRefreshing(false); };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.danger} />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item, index) => item.id || item._id || String(index)}
        renderItem={({ item }) => <AlertCard alert={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.danger} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No SOS alerts yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 17, color: colors.textMuted },
  listContent: { padding: 16, gap: 12, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.danger },
  cardPatient: { fontSize: 15, color: colors.text, marginTop: 4 },
  cardTime: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  emptyText: { fontSize: 18, color: colors.textMuted, textAlign: 'center' },
});
