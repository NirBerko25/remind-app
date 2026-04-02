import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { colors } from '../../constants/colors';
import { getConversations, getPatients, getConversationSummary } from '../../services/api';

const EMERGENCY_KEYWORDS = ['emergency', 'help', 'hurt', 'pain', 'fell', 'danger', 'please help'];
const CONFUSED_KEYWORDS = ['lost', 'scared', "don't know", 'dont know', 'where am i', 'confused', 'frightened', 'afraid', 'alone', "can't remember", 'cant remember'];

function getConversationFlag(conversation) {
  const messages = conversation.messages || [];
  let hasEmergency = false;
  let hasConfused = false;
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const lower = (msg.content || '').toLowerCase();
    if (EMERGENCY_KEYWORDS.some(k => lower.includes(k))) hasEmergency = true;
    else if (CONFUSED_KEYWORDS.some(k => lower.includes(k))) hasConfused = true;
  }
  if (hasEmergency) return 'emergency';
  if (hasConfused) return 'confused';
  return null;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function ConversationCard({ item, onPress, tldr }) {
  const messageCount = item.messageCount || item.messages?.length || 0;
  const flag = getConversationFlag(item);
  const isEmergency = flag === 'emergency';
  const isConfused = flag === 'confused';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isEmergency && styles.cardEmergency,
        isConfused && styles.cardConfused,
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={styles.cardLeft}>
        <View style={[
          styles.cardIcon,
          isEmergency && styles.cardIconEmergency,
          isConfused && styles.cardIconConfused,
        ]}>
          <Text style={styles.cardIconText}>
            {isEmergency ? '🆘' : isConfused ? '⚠️' : '💬'}
          </Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardDate}>{formatDate(item.startedAt || item.createdAt || item.date)}</Text>
          {flag && (
            <Text style={[styles.flagBadge, isEmergency ? styles.flagBadgeEmergency : styles.flagBadgeConfused]}>
              {isEmergency ? 'Distress' : 'Confusion'}
            </Text>
          )}
        </View>
        {tldr === undefined ? (
          <Text style={styles.cardTldrLoading}>Summarizing...</Text>
        ) : tldr ? (
          <Text style={styles.cardTldr} numberOfLines={2}>{tldr}</Text>
        ) : null}
        {messageCount > 0 && (
          <Text style={styles.cardMeta}>{messageCount} messages</Text>
        )}
      </View>
      <Text style={styles.cardArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function HistoryScreen({ navigation }) {
  const { patientId, setPatientId } = useApp();
  const [conversations, setConversations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientId);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [tldrs, setTldrs] = useState({});

  const loadConversations = useCallback(async (pid = selectedPatientId) => {
    try {
      setError(null);
      const data = await getConversations(pid);
      const convs = Array.isArray(data) ? data : data.conversations || [];
      setConversations(convs);
      // Fetch TLDRs in parallel, update each as it arrives
      setTldrs({});
      convs.forEach((conv) => {
        const id = conv.id || conv._id;
        const msgCount = conv.messages?.length || 0;
        if (!id || msgCount === 0) {
          setTldrs((prev) => ({ ...prev, [id]: null }));
          return;
        }
        getConversationSummary(id)
          .then((res) => setTldrs((prev) => ({ ...prev, [id]: res.tldr || null })))
          .catch(() => setTldrs((prev) => ({ ...prev, [id]: null })));
      });
    } catch (err) {
      setError('Could not load conversations. Check your connection.');
      console.error('HistoryScreen error:', err);
    }
  }, [selectedPatientId]);

  const loadPatients = useCallback(async () => {
    try {
      const data = await getPatients();
      setPatients(Array.isArray(data) ? data : data.patients || []);
    } catch (err) {
      console.error('Could not load patients:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadConversations(), loadPatients()]);
      setLoading(false);
    }
    init();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const handlePatientSelect = async (patient) => {
    setSelectedPatientId(patient.id || patient._id);
    setPatientId(patient.id || patient._id);
    setShowPatientPicker(false);
    setLoading(true);
    await loadConversations(patient.id || patient._id);
    setLoading(false);
  };

  const handleConversationPress = (conversation) => {
    navigation.navigate('HistoryDetail', {
      conversationId: conversation.id || conversation._id,
      date: formatDate(conversation.createdAt || conversation.date),
    });
  };

  const selectedPatient = patients.find(
    (p) => (p.id || p._id) === selectedPatientId
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Patient Selector */}
      <LinearGradient
        colors={['#F8FAFF', colors.background]}
        style={styles.selectorBar}
      >
        <Text style={styles.selectorLabel}>Viewing:</Text>
        <TouchableOpacity
          style={styles.selectorButton}
          onPress={() => setShowPatientPicker(!showPatientPicker)}
          activeOpacity={0.8}
        >
          <View style={styles.patientDot} />
          <Text style={styles.selectorButtonText}>
            {selectedPatient?.name || selectedPatientId}
          </Text>
          <Text style={styles.selectorArrow}>{showPatientPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Patient dropdown */}
      {showPatientPicker && patients.length > 0 && (
        <View style={styles.dropdown}>
          {patients.map((patient) => (
            <TouchableOpacity
              key={patient.id || patient._id}
              style={styles.dropdownItem}
              onPress={() => handlePatientSelect(patient)}
            >
              <View style={styles.dropdownDot} />
              <Text style={styles.dropdownItemText}>{patient.name || patient.id}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadConversations()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id || item._id || String(Math.random())}
          renderItem={({ item }) => (
            <ConversationCard
              item={item}
              onPress={handleConversationPress}
              tldr={tldrs[item.id || item._id]}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Conversations will appear here after the patient uses the voice assistant.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  selectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  selectorLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  patientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginRight: 4,
  },
  selectorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  selectorButtonText: {
    flex: 1,
    fontSize: 16,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  selectorArrow: {
    fontSize: 12,
    color: colors.primary,
  },
  dropdown: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  dropdownItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
  dropdownItemText: {
    fontSize: 17,
    color: colors.text,
    fontWeight: '500',
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
  listContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  cardEmergency: {
    borderLeftColor: '#DC2626',
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
    shadowColor: '#DC2626',
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  cardConfused: {
    borderLeftColor: '#D97706',
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    shadowColor: '#D97706',
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  cardLeft: {
    width: 48,
    alignItems: 'center',
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconEmergency: {
    backgroundColor: '#FEE2E2',
  },
  cardIconConfused: {
    backgroundColor: '#FEF3C7',
  },
  cardIconText: {
    fontSize: 22,
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
  flagBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  flagBadgeEmergency: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  flagBadgeConfused: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  cardDate: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  cardTldr: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  cardTldrLoading: {
    fontSize: 13,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  cardMeta: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardArrow: {
    fontSize: 22,
    color: colors.textLight,
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
