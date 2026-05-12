// ─────────────────────────────────────────────────────────────────────────────
// LAYER 4 — Patient: Location Status Banner
// Shows a friendly location label (e.g. "You are at Home") based on safe zones.
// Coordinates are never shown to the patient.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { colors } from '../constants/colors';
import { getSafeZones } from '../services/api';
import { isInsideZone } from '../services/geofencing';

const POLL_INTERVAL_MS = 30000;

export default function LocationStatusBanner({ patientId }) {
  const [label, setLabel] = useState(null);
  const zonesRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      try {
        const zones = await getSafeZones(patientId);
        zonesRef.current = zones;
      } catch {
        // zones stay empty — banner stays hidden
      }

      await checkLocation();
      intervalRef.current = setInterval(checkLocation, POLL_INTERVAL_MS);
    };

    const checkLocation = async () => {
      if (cancelled) return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;
        const matchedZone = zonesRef.current.find(z =>
          isInsideZone(z, latitude, longitude)
        );
        if (!cancelled) {
          setLabel(matchedZone ? `You are at ${matchedZone.name}` : null);
        }
      } catch {
        // silently ignore — location is optional feature
      }
    };

    init();
    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
  }, [patientId]);

  if (!label) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.secondaryLight,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  icon: { fontSize: 20 },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
});
