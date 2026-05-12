import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { getPatientCurrentLocation, getLocationBreaches, getContext } from '../services/api';

function formatSeen(ts) {
  if (!ts) return null;
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function PatientStatusRail() {
  const { patientId } = useApp();
  const [patientName, setPatientName] = useState('Patient');
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const [breached, setBreached] = useState(false);

  useEffect(() => {
    getContext(patientId)
      .then(ctx => { if (ctx?.name) setPatientName(ctx.name); })
      .catch(() => {});
  }, [patientId]);

  useEffect(() => {
    const poll = async () => {
      try {
        const loc = await getPatientCurrentLocation(patientId);
        if (loc?.lastSeenAt) setLastSeenAt(loc.lastSeenAt);
      } catch {}
      try {
        const list = await getLocationBreaches(patientId);
        const recent = Array.isArray(list) && list.length > 0
          && (Date.now() - (list[0].triggered_at * 1000 || 0)) < 10 * 60 * 1000;
        setBreached(!!recent);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [patientId]);

  const seen = formatSeen(lastSeenAt);
  const safe = !breached;

  return (
    <View style={[styles.rail, breached && styles.railBreached]}>
      <View style={[styles.dot, breached ? styles.dotBreached : styles.dotSafe]} />
      <Ionicons name="person-outline" size={12} color={breached ? colors.amber : colors.secondary} />
      <Text style={[styles.name, breached && styles.nameBreached]}>{patientName}</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={[styles.status, breached && styles.statusBreached]}>
        {breached ? 'Left safe zone' : 'Safe'}
      </Text>
      {seen && (
        <>
          <Text style={styles.sep}>·</Text>
          <Text style={styles.seen}>{seen}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  railBreached: {
    backgroundColor: colors.amberLight,
    borderBottomColor: '#F5D5A0',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotSafe: { backgroundColor: colors.secondary },
  dotBreached: { backgroundColor: colors.amber },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  nameBreached: { color: '#7A4500' },
  sep: { fontSize: 11, color: colors.textLight },
  status: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '500',
  },
  statusBreached: { color: colors.amber, fontWeight: '600' },
  seen: { fontSize: 11, color: colors.textMuted },
});
