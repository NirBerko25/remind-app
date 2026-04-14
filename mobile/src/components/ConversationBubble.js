import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';

/**
 * A single message bubble in a conversation.
 * @param {object} props
 * @param {string} props.text - message content
 * @param {'user'|'ai'} props.sender - who sent the message
 * @param {string} [props.timestamp] - optional timestamp string
 * @param {boolean} [props.large] - use larger fonts (for patient home screen)
 * @param {'emergency'|'confused'|null} [props.flagged] - highlight as suspicious for caregiver
 */
export default function ConversationBubble({ text, sender, timestamp, large = false, flagged = null }) {
  const isUser = sender === 'user';
  const isEmergency = flagged === 'emergency';
  const isConfused = flagged === 'confused';
  const isFlagged = isEmergency || isConfused;

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAI]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View style={styles.bubbleColumn}>
        {isFlagged && (
          <View style={[styles.flagBadge, isEmergency ? styles.flagBadgeEmergency : styles.flagBadgeConfused]}>
            <Text style={styles.flagBadgeText}>
              {isEmergency ? '🆘 Distress detected' : '⚠️ Confusion detected'}
            </Text>
          </View>
        )}
        {isEmergency || isConfused ? (
          <LinearGradient
            colors={isEmergency ? ['#DC2626', '#EF4444'] : ['#D97706', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, large && styles.bubbleLarge, styles.bubbleUser]}
          >
            <Text style={[styles.text, styles.textUser, large && styles.textLarge, styles.textFlagged]}>
              {text}
            </Text>
          </LinearGradient>
        ) : isUser ? (
          <LinearGradient
            colors={colors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.bubbleUser, large && styles.bubbleLarge]}
          >
            <Text style={[styles.text, styles.textUser, large && styles.textLarge]}>{text}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleAI, large && styles.bubbleLarge]}>
            <Text style={[styles.text, styles.textAI, large && styles.textLarge]}>{text}</Text>
          </View>
        )}
        {timestamp ? (
          <Text style={[styles.timestamp, isUser ? styles.timestampRight : styles.timestampLeft]}>
            {timestamp}
          </Text>
        ) : null}
      </View>
      {isUser && (
        <View style={[styles.avatar, isEmergency ? styles.avatarEmergency : isConfused ? styles.avatarConfused : styles.avatarUser]}>
          <Text style={[styles.avatarText, isFlagged && styles.avatarTextFlagged]}>Me</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  wrapperUser: {
    justifyContent: 'flex-end',
  },
  wrapperAI: {
    justifyContent: 'flex-start',
  },
  bubbleColumn: {
    maxWidth: '75%',
    flexShrink: 1,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleLarge: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleEmergency: {
    backgroundColor: '#DC2626',
    borderBottomRightRadius: 4,
  },
  bubbleConfused: {
    backgroundColor: '#D97706',
    borderBottomRightRadius: 4,
  },
  flagBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  flagBadgeEmergency: {
    backgroundColor: '#FEE2E2',
  },
  flagBadgeConfused: {
    backgroundColor: '#FEF3C7',
  },
  flagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7F1D1D',
  },
  textFlagged: {
    color: '#fff',
    fontWeight: '600',
  },
  avatarEmergency: {
    backgroundColor: '#DC2626',
    marginRight: 0,
    marginLeft: 8,
  },
  avatarConfused: {
    backgroundColor: '#D97706',
    marginRight: 0,
    marginLeft: 8,
  },
  avatarTextFlagged: {
    color: '#fff',
  },
  bubbleAI: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontSize: 18,
    lineHeight: 26,
  },
  textLarge: {
    fontSize: 22,
    lineHeight: 32,
  },
  textUser: {
    color: colors.white,
    fontWeight: '500',
  },
  textAI: {
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  timestampRight: {
    textAlign: 'right',
    marginRight: 4,
  },
  timestampLeft: {
    textAlign: 'left',
    marginLeft: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginRight: 8,
  },
  avatarUser: {
    backgroundColor: colors.primary,
    marginRight: 0,
    marginLeft: 8,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
});
