import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { getConversationDetail, getConversationSummary } from '../../services/api';
import ConversationBubble from '../../components/ConversationBubble';

const EMERGENCY_KEYWORDS = ['emergency', 'help', 'hurt', 'pain', 'fell', 'danger', 'please help'];
const CONFUSED_KEYWORDS = ['lost', 'scared', "don't know", 'dont know', 'where am i', 'confused', 'frightened', 'afraid', 'alone', "can't remember", 'cant remember'];

function detectMessageState(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (EMERGENCY_KEYWORDS.some(k => lower.includes(k))) return 'emergency';
  if (CONFUSED_KEYWORDS.some(k => lower.includes(k))) return 'confused';
  return null;
}

function toMs(value) {
  const n = Number(value);
  return n < 1e12 ? n * 1000 : n;
}

function formatTimestamp(value) {
  if (!value) return '';
  return new Date(toMs(value)).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function HistoryDetailScreen({ route, navigation }) {
  const { conversationId, date } = route.params;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      title: date || 'Conversation',
      headerBackTitle: 'Back',
    });

    loadDetail();
  }, [conversationId]);

  const loadDetail = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getConversationDetail(conversationId);
      const msgs = data.messages || data || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      setError('Could not load this conversation. Please try again.');
      console.error('HistoryDetailScreen error:', err);
    } finally {
      setLoading(false);
    }

    // Load summary in background after messages appear
    setSummaryLoading(true);
    try {
      const data = await getConversationSummary(conversationId);
      setSummary(data.summary || data.tldr || null);
    } catch (_) {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={48} color={colors.amber} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDetail}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id || item._id || String(index)}
        renderItem={({ item }) => {
          // Normalize message sender field from various backend formats
          const sender =
            item.sender === 'assistant' || item.role === 'assistant' || item.sender === 'ai'
              ? 'ai'
              : 'user';

          const text = item.text || item.content || item.message || '';
          const timestamp = formatTimestamp(item.timestamp || item.createdAt);
          const flagged = sender === 'user' ? detectMessageState(text) : null;

          return (
            <ConversationBubble
              text={text}
              sender={sender}
              timestamp={timestamp}
              large={false}
              flagged={flagged}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={['#EEF1FF', '#F4F6FE']}
              style={styles.summaryGradientHeader}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={14} color={colors.primaryDark} />
                <Text style={styles.summaryTitle}>AI Summary</Text>
              </View>
            </LinearGradient>
            <View style={styles.summaryBody}>
              {summaryLoading ? (
                <View style={styles.summaryLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.summaryLoadingText}>Generating summary...</Text>
                </View>
              ) : summary ? (
                <Text style={styles.summaryText}>{summary}</Text>
              ) : (
                <Text style={styles.summaryEmpty}>No summary available.</Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textLight} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No messages in this conversation.</Text>
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
  errorText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  retryText: {
    fontSize: 17,
    color: colors.white,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryGradientHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryBody: {
    padding: 16,
  },
  summaryText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 23,
  },
  summaryEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLoadingText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
