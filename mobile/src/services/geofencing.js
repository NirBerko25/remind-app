// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — Mobile: Background Geofencing Engine
// Install: npx expo install expo-location expo-task-manager
// app.json: add expo-location plugin (see README) and location permissions
// ─────────────────────────────────────────────────────────────────────────────
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

const LOCATION_TASK = 'remind-geofence-bg';
const ZONES_CACHE_KEY = '@remind_safe_zones_cache';
const BREACH_COOLDOWN_KEY = '@remind_last_breach_ts';
const BREACH_COOLDOWN_MS = 5 * 60 * 1000;

// ── Geometry helpers ─────────────────────────────────────────────────────────

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ray-casting algorithm for point-in-polygon.
// coords: [{ latitude, longitude }, ...]
export function isPointInPolygon(lat, lng, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].latitude, yi = coords[i].longitude;
    const xj = coords[j].latitude, yj = coords[j].longitude;
    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isInsideZone(zone, lat, lng) {
  if (zone.type === 'circle') {
    return haversineDistance(lat, lng, zone.latitude, zone.longitude) <= (zone.radius || 500);
  }
  if (zone.type === 'polygon') {
    const coords =
      typeof zone.coordinates === 'string'
        ? JSON.parse(zone.coordinates)
        : zone.coordinates || [];
    return isPointInPolygon(lat, lng, coords);
  }
  return false;
}

// ── Background task (defined at module-load time) ────────────────────────────

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[Geofence Task]', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const { latitude, longitude } = data.locations[data.locations.length - 1].coords;

  try {
    const zonesRaw = await AsyncStorage.getItem(ZONES_CACHE_KEY);
    const zones = zonesRaw ? JSON.parse(zonesRaw) : [];

    // No zones defined → nothing to check
    if (!zones.length) return;

    const inZone = zones.some(z => isInsideZone(z, latitude, longitude));
    if (!inZone) {
      const lastRaw = await AsyncStorage.getItem(BREACH_COOLDOWN_KEY);
      const lastTs = lastRaw ? parseInt(lastRaw, 10) : 0;
      if (Date.now() - lastTs < BREACH_COOLDOWN_MS) return;

      await AsyncStorage.setItem(BREACH_COOLDOWN_KEY, String(Date.now()));

      const patientIdRaw = await AsyncStorage.getItem('@remind_patient_id');
      const patientId = patientIdRaw
        ? patientIdRaw.replace(/^"|"$/g, '')
        : 'demo-patient-1';

      await fetch(`${API_BASE_URL}/location/breach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, latitude, longitude }),
      });

      console.log('[Geofence] Breach reported for patient', patientId);
    }
  } catch (err) {
    console.error('[Geofence Task] Error:', err.message);
  }
});

// ── Public API ────────────────────────────────────────────────────────────────

export async function updateZonesCache(zones) {
  await AsyncStorage.setItem(ZONES_CACHE_KEY, JSON.stringify(zones));
}

export async function startGeofencing() {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') {
    console.warn('[Geofence] Background permission denied — foreground-only monitoring active');
  }

  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (alreadyRunning) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30000,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'ReMind Safety',
      notificationBody: 'Keeping you safe',
      notificationColor: '#4F6EF7',
    },
  });

  console.log('[Geofence] Background location task started');
  return true;
}

export async function stopGeofencing() {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    console.log('[Geofence] Background location task stopped');
  }
}
