import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { getLocationStatus, getContext } from '../services/api';


export default function PatientStatusRail() {
  const { patientId } = useApp();
  const [patientName, setPatientName] = useState('Patient');
  const [breached, setBreached] = useState(false);

  useEffect(() => {
    getContext(patientId)
      .then(ctx => { if (ctx?.name) setPatientName(ctx.name); })
      .catch(() => {});
  }, [patientId]);

  useEffect(() => {
    const poll = async () => {
      try {
        const status = await getLocationStatus(patientId);
        setBreached(!status.isSafe);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [patientId]);

  return (
    <View style={[styles.rail, breached && styles.railBreached]}>
      <View style={[styles.dot, breached ? styles.dotBreached : styles.dotSafe]} />
      <Ionicons name="person-outline" size={12} color={breached ? colors.amber : colors.secondary} />
      <Text style={[styles.name, breached && styles.nameBreached]}>{patientName}</Text>
      <Text style={styles.sep}>·</Text>
      <Text style={[styles.status, breached && styles.statusBreached]}>
        {breached ? 'Left safe zone' : 'Safe'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  railBreached: {
    backgroundColor: colors.amberLight,
    borderColor: '#F5D5A0',
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
});
