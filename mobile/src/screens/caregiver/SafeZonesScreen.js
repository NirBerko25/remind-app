import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useApp } from '../../context/AppContext';
import { colors } from '../../constants/colors';
import { getSafeZones, createSafeZone, deleteSafeZone, updateSafeZone, getContext } from '../../services/api';
import { updateZonesCache } from '../../services/geofencing';

const DEFAULT_REGION = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const DRAW_MODES = { NONE: 'none', PIN: 'pin', POLYGON: 'polygon' };
const MAP_TYPES = ['standard', 'satellite', 'hybrid'];
const MAP_TYPE_ICONS = { standard: '🗺️', satellite: '🛰️', hybrid: '🗾' };
const WEB_MAP_FILTERS = {
  standard: 'none',
  satellite: 'invert(1) hue-rotate(180deg) brightness(0.9) saturate(1.2)',
  hybrid: 'grayscale(0.7) contrast(1.3) brightness(0.85)',
};

export default function SafeZonesScreen() {
  const { patientId } = useApp();
  const [fetchedPatientName, setFetchedPatientName] = useState('Patient');
  const mapRef = useRef(null);

  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawMode, setDrawMode] = useState(DRAW_MODES.NONE);
  const [polygonVertices, setPolygonVertices] = useState([]);
  const [pendingPin, setPendingPin] = useState(null);

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [pendingZone, setPendingZone] = useState(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneRadius, setZoneRadius] = useState('500');
  const [saving, setSaving] = useState(false);

  const [mapTypeIndex, setMapTypeIndex] = useState(0);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRadius, setEditRadius] = useState('500');
  const [editSaving, setEditSaving] = useState(false);

  // regionRef holds the live region without causing re-renders; region state
  // is only used to trigger label re-position after map movement.
  const regionRef = useRef(DEFAULT_REGION);
  const [region, setRegion] = useState(DEFAULT_REGION);

  const [myLocation, setMyLocation] = useState({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });

  // Map pixel size — captured by onLayout on the MapView
  const [mapLayout, setMapLayout] = useState({ width: 1, height: 1 });

  // ── Load zones ────────────────────────────────────────────────────────────
  const loadZones = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSafeZones(patientId);
      setZones(data);
      await updateZonesCache(data);
    } catch (err) {
      console.error('[SafeZones]', err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadZones();
    centerOnCurrentLocation();
    getContext(patientId).then(ctx => {
      if (ctx?.name) setFetchedPatientName(ctx.name);
    }).catch(() => {});
  }, [loadZones]);

  const centerOnCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setMyLocation({ latitude, longitude });
      const r = { latitude, longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 };
      regionRef.current = r;
      setRegion(r);
      mapRef.current?.animateToRegion(r, 600);
    } catch (err) {
      console.warn('[SafeZones] location error:', err.message);
    }
  };


  // ── Tap → coordinate (pure math, synchronous, no native async call) ───────
  const pressToCoordinate = (lx, ly) => {
    const r = regionRef.current;
    const { width, height } = mapLayout;
    if (!width || !height) return null;
    const latitude = r.latitude + (0.5 - ly / height) * r.latitudeDelta;
    const longitude = r.longitude + (lx / width - 0.5) * r.longitudeDelta;
    if (isNaN(latitude) || isNaN(longitude)) return null;
    return { latitude, longitude };
  };

  // ── Polygon centroid (simple average of vertices) ────────────────────────
  const polygonCentroid = (coords) => {
    if (!coords || !coords.length) return null;
    const lat = coords.reduce((s, c) => s + c.latitude, 0) / coords.length;
    const lng = coords.reduce((s, c) => s + c.longitude, 0) / coords.length;
    return { latitude: lat, longitude: lng };
  };

  // ── Coordinate → screen point (inverse of pressToCoordinate) ─────────────
  const coordinateToPoint = (coord) => {
    const r = regionRef.current;
    const { width, height } = mapLayout;
    if (!width || !height || width < 2 || height < 2) return null;
    const x = width / 2 + ((coord.longitude - r.longitude) / r.longitudeDelta) * width;
    const y = height / 2 - ((coord.latitude - r.latitude) / r.latitudeDelta) * height;
    if (x < 0 || x > width || y < 30 || y > height) return null; // off-screen
    return { x, y };
  };

  const handleCoordinate = (coordinate) => {
    if (!coordinate) return;
    if (drawMode === DRAW_MODES.PIN) {
      setPendingPin(coordinate);
    } else if (drawMode === DRAW_MODES.POLYGON) {
      setPolygonVertices(prev => [...prev, coordinate]);
    }
  };

  const handleOverlayPress = (e) => {
    try {
      const lx = e?.nativeEvent?.locationX;
      const ly = e?.nativeEvent?.locationY;
      if (lx == null || ly == null) return;
      handleCoordinate(pressToCoordinate(lx, ly));
    } catch (err) {
      console.warn('[SafeZones] tap error:', err.message);
    }
  };

  // ── Start drawing modes ───────────────────────────────────────────────────
  const startPinMode = () => {
    setDrawMode(DRAW_MODES.PIN);
    setPendingPin(null);
    setPolygonVertices([]);
    Alert.alert('Drop a Pin', 'Tap anywhere on the map to place the center of the safe zone.');
  };

  const startPolygonMode = () => {
    setDrawMode(DRAW_MODES.POLYGON);
    setPendingPin(null);
    setPolygonVertices([]);
    Alert.alert('Draw a Zone', 'Tap at least 3 points on the map to draw the boundary, then tap "Close Shape".');
  };

  const cancelDrawing = () => {
    setDrawMode(DRAW_MODES.NONE);
    setPendingPin(null);
    setPolygonVertices([]);
  };

  // ── Confirm pending shapes ────────────────────────────────────────────────
  const confirmPin = () => {
    if (!pendingPin) return;
    setPendingZone({ type: 'circle', ...pendingPin });
    setZoneName('');
    setZoneRadius('500');
    setNameModalVisible(true);
  };

  const closePolygon = () => {
    if (polygonVertices.length < 3) {
      Alert.alert('Too few points', 'Tap at least 3 points to define the zone boundary.');
      return;
    }
    setPendingZone({ type: 'polygon', coordinates: polygonVertices });
    setZoneName('');
    setNameModalVisible(true);
  };

  // ── Save zone ─────────────────────────────────────────────────────────────
  const saveZone = async () => {
    if (!zoneName.trim()) {
      Alert.alert('Name required', 'Please enter a name for this zone.');
      return;
    }
    setSaving(true);
    try {
      const payload =
        pendingZone.type === 'circle'
          ? {
              name: zoneName.trim(),
              type: 'circle',
              latitude: pendingZone.latitude,
              longitude: pendingZone.longitude,
              radius: parseFloat(zoneRadius) || 500,
            }
          : {
              name: zoneName.trim(),
              type: 'polygon',
              coordinates: pendingZone.coordinates.map(c => ({
                latitude: c.latitude,
                longitude: c.longitude,
              })),
            };
      await createSafeZone(patientId, payload);
      setNameModalVisible(false);
      setDrawMode(DRAW_MODES.NONE);
      setPendingPin(null);
      setPolygonVertices([]);
      setPendingZone(null);
      setZoneName('');
      await loadZones();
    } catch (err) {
      Alert.alert('Error', 'Could not save zone. Please try again.');
      console.error('[SafeZones] Save error:', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete zone ───────────────────────────────────────────────────────────
  const confirmDelete = (zone) => {
    const doDelete = async () => {
      try {
        await deleteSafeZone(patientId, zone.id);
        await loadZones();
      } catch {
        Alert.alert('Error', 'Could not delete zone.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${zone.name}" from safe zones?`)) doDelete();
    } else {
      Alert.alert(
        'Delete Zone',
        `Remove "${zone.name}" from safe zones?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const openEdit = (zone) => {
    setEditingZone(zone);
    setEditName(zone.name);
    setEditRadius(String(zone.radius || 500));
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Name required', 'Please enter a name for this zone.');
      return;
    }
    setEditSaving(true);
    try {
      const updates = { name: editName.trim() };
      if (editingZone.type === 'circle') updates.radius = parseFloat(editRadius) || 500;
      await updateSafeZone(patientId, editingZone.id, updates);
      setEditModalVisible(false);
      setEditingZone(null);
      await loadZones();
    } catch {
      Alert.alert('Error', 'Could not update zone. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  // Patient label screen position — computed synchronously from region + mapLayout
  const patientPoint = coordinateToPoint(myLocation);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Drawing mode indicator */}
      {drawMode !== DRAW_MODES.NONE && (
        <View style={styles.drawingBannerWrap}>
          <View style={styles.drawingBanner}>
            <Ionicons name={drawMode === DRAW_MODES.PIN ? 'location' : 'shapes'} size={14} color="#92400E" />
            <Text style={styles.drawingBannerText}>
              {drawMode === DRAW_MODES.PIN
                ? 'Tap map to drop pin'
                : `${polygonVertices.length} point${polygonVertices.length !== 1 ? 's' : ''} — tap to add more`}
            </Text>
            <TouchableOpacity onPress={cancelDrawing} style={styles.cancelBtn}>
              <Ionicons name="close" size={14} color={colors.danger} />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Map */}
      <View
        style={[
          styles.mapContainer,
          Platform.OS === 'web' && { filter: WEB_MAP_FILTERS[MAP_TYPES[mapTypeIndex]] },
        ]}
        onLayout={(e) => setMapLayout(e.nativeEvent.layout)}
      >
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={DEFAULT_REGION}
          onRegionChangeComplete={(r) => {
            regionRef.current = r;
            setRegion(r);
          }}
          scrollEnabled={drawMode === DRAW_MODES.NONE}
          zoomEnabled={drawMode === DRAW_MODES.NONE}
          rotateEnabled={drawMode === DRAW_MODES.NONE}
          pitchEnabled={drawMode === DRAW_MODES.NONE}
          mapType={MAP_TYPES[mapTypeIndex]}
          showsMyLocationButton={false}
          onPress={(e) => {
            if (drawMode === DRAW_MODES.NONE) return;
            const coord = e?.nativeEvent?.coordinate;
            if (coord) handleCoordinate(coord);
          }}
        >
          {/* Patient position pin */}
          <Marker coordinate={myLocation} pinColor={colors.primary} />

          {/* Saved zones */}
          {zones.map(zone =>
            zone.type === 'circle' ? (
              <React.Fragment key={zone.id}>
                <Circle
                  center={{ latitude: zone.latitude, longitude: zone.longitude }}
                  radius={zone.radius || 500}
                  fillColor="rgba(79,110,247,0.12)"
                  strokeColor={colors.primary}
                  strokeWidth={2}
                />
                <Marker
                  coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                  title={zone.name}
                  pinColor={colors.secondary}
                />
              </React.Fragment>
            ) : (
              <Polygon
                key={zone.id}
                coordinates={
                  Array.isArray(zone.coordinates)
                    ? zone.coordinates
                    : JSON.parse(zone.coordinates || '[]')
                }
                fillColor="rgba(79,110,247,0.12)"
                strokeColor={colors.primary}
                strokeWidth={2}
              />
            )
          )}

          {/* Pending pin preview */}
          {pendingPin && (
            <>
              <Marker coordinate={pendingPin} pinColor={colors.secondary} />
              <Circle
                center={pendingPin}
                radius={parseFloat(zoneRadius) || 500}
                fillColor="rgba(16,185,129,0.15)"
                strokeColor={colors.secondary}
                strokeWidth={2}
                strokeDasharray={[5, 5]}
              />
            </>
          )}

          {/* Polygon drawing preview */}
          {polygonVertices.length > 0 && (
            <>
              {polygonVertices.map((v, i) => (
                <Marker key={i} coordinate={v} pinColor="#F59E0B" />
              ))}
              {polygonVertices.length > 1 && (
                <Polyline
                  coordinates={[...polygonVertices, polygonVertices[0]]}
                  strokeColor={colors.secondary}
                  strokeWidth={2}
                  strokeDasharray={[6, 4]}
                />
              )}
            </>
          )}
        </MapView>

        {/* Patient name label — plain View overlay, position computed via math */}
        {patientPoint && (
          <View
            pointerEvents="none"
            style={[styles.patientLabelWrap, { left: patientPoint.x - 45, top: patientPoint.y - 38 }]}
          >
            <View style={styles.patientNameTag}>
              <Text style={styles.patientNameText}>{fetchedPatientName}</Text>
            </View>
          </View>
        )}

        {/* Zone name labels — math overlay, same approach as patient label */}
        {zones.map(zone => {
          const center = zone.type === 'circle'
            ? { latitude: zone.latitude, longitude: zone.longitude }
            : polygonCentroid(
                Array.isArray(zone.coordinates) ? zone.coordinates : JSON.parse(zone.coordinates || '[]')
              );
          if (!center) return null;
          const pt = coordinateToPoint(center);
          if (!pt) return null;
          return (
            <View
              key={`label-${zone.id}`}
              pointerEvents="none"
              style={[styles.zoneLabelWrap, { left: pt.x - 45, top: pt.y + 6 }]}
            >
              <View style={styles.zoneNameTag}>
                <Text style={styles.zoneNameTagText} numberOfLines={1}>{zone.name}</Text>
              </View>
            </View>
          );
        })}

        {/* Web-only tap overlay — View responder sits above Leaflet canvas; onResponderGrant has reliable locationX/Y */}
        {Platform.OS === 'web' && drawMode !== DRAW_MODES.NONE && (
          <View
            style={StyleSheet.absoluteFillObject}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              const lx = e.nativeEvent.locationX;
              const ly = e.nativeEvent.locationY;
              if (lx != null && ly != null) handleCoordinate(pressToCoordinate(lx, ly));
            }}
          />
        )}

        {/* Map style toggle */}
        {<TouchableOpacity
          style={styles.mapStyleBtn}
          onPress={() => setMapTypeIndex(i => (i + 1) % MAP_TYPES.length)}
          activeOpacity={0.85}
        >
          <Text style={styles.mapStyleBtnIcon}>{MAP_TYPE_ICONS[MAP_TYPES[mapTypeIndex]]}</Text>
          <Text style={styles.mapStyleBtnLabel}>{MAP_TYPES[mapTypeIndex]}</Text>
        </TouchableOpacity>}
      </View>

      {/* Controls panel */}
      <View style={styles.panel}>
        {/* Panel handle */}
        <View style={styles.panelHandle} />

        {drawMode === DRAW_MODES.NONE ? (
          <View style={styles.addButtons}>
            <TouchableOpacity style={styles.addBtnWrap} onPress={startPinMode} activeOpacity={0.85}>
              <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtn}>
                <Ionicons name="location" size={16} color={colors.white} />
                <Text style={styles.addBtnText}>Circle Zone</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtnWrap} onPress={startPolygonMode} activeOpacity={0.85}>
              <LinearGradient colors={colors.gradientSuccess} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtn}>
                <Ionicons name="pencil" size={16} color={colors.white} />
                <Text style={styles.addBtnText}>Polygon Zone</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : drawMode === DRAW_MODES.PIN ? (
          <TouchableOpacity
            style={[styles.addBtnWrap, !pendingPin && styles.addBtnDisabled]}
            onPress={confirmPin}
            disabled={!pendingPin}
            activeOpacity={0.8}
          >
            <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtn}>
              <Ionicons name="checkmark-circle" size={16} color={colors.white} />
              <Text style={styles.addBtnText}>Confirm Pin Location</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.addBtnWrap, polygonVertices.length < 3 && styles.addBtnDisabled]}
            onPress={closePolygon}
            disabled={polygonVertices.length < 3}
            activeOpacity={0.8}
          >
            <LinearGradient colors={colors.gradientSuccess} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtn}>
              <Ionicons name="checkmark-circle" size={16} color={colors.white} />
              <Text style={styles.addBtnText}>Close Shape ({polygonVertices.length} pts)</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} />
        ) : zones.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="map-outline" size={28} color={colors.textLight} />
            <Text style={styles.emptyText}>No safe zones yet.{'\n'}Add a circle or draw a polygon above.</Text>
          </View>
        ) : (
          <ScrollView style={styles.zoneList} showsVerticalScrollIndicator={false}>
            {zones.map(zone => (
              <View key={zone.id} style={styles.zoneRow}>
                <View style={[styles.zoneIconWrap, zone.type === 'circle' ? styles.zoneIconWrapCircle : styles.zoneIconWrapPoly]}>
                  <Ionicons
                    name={zone.type === 'circle' ? 'location' : 'shapes'}
                    size={18}
                    color={zone.type === 'circle' ? colors.primary : colors.secondary}
                  />
                </View>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Text style={styles.zoneMeta}>
                    {zone.type === 'circle' ? `Circle · ${zone.radius || 500}m radius` : 'Polygon zone'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(zone)} style={styles.editBtn} activeOpacity={0.7}>
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(zone)} style={styles.deleteBtn} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Zone name modal */}
      <Modal visible={nameModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name This Zone</Text>
            <Text style={styles.modalSubtitle}>
              {pendingZone?.type === 'circle'
                ? 'Circle zone centered on dropped pin'
                : `Polygon zone with ${pendingZone?.coordinates?.length} vertices`}
            </Text>
            <TextInput
              style={styles.nameInput}
              placeholder='e.g. "Home", "Park", "Clinic"'
              placeholderTextColor={colors.textLight}
              value={zoneName}
              onChangeText={setZoneName}
              autoFocus
              maxLength={40}
            />
            {pendingZone?.type === 'circle' && (
              <View style={styles.radiusRow}>
                <Text style={styles.radiusLabel}>Radius (meters)</Text>
                <TextInput
                  style={styles.radiusInput}
                  keyboardType="numeric"
                  value={zoneRadius}
                  onChangeText={setZoneRadius}
                  maxLength={5}
                />
              </View>
            )}
            <TouchableOpacity
              onPress={saveZone}
              disabled={saving}
              activeOpacity={0.85}
              style={saving && styles.addBtnDisabled}
            >
              <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                {saving ? <ActivityIndicator color={colors.white} /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                    <Text style={styles.saveBtnText}>Save Zone</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { setNameModalVisible(false); cancelDrawing(); }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Edit zone modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Zone</Text>
            <Text style={styles.modalSubtitle}>
              {editingZone?.type === 'circle' ? 'Circle zone' : 'Polygon zone'}
            </Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Zone name"
              placeholderTextColor={colors.textLight}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              maxLength={40}
            />
            {editingZone?.type === 'circle' && (
              <View style={styles.radiusRow}>
                <Text style={styles.radiusLabel}>Radius (meters)</Text>
                <TextInput
                  style={styles.radiusInput}
                  keyboardType="numeric"
                  value={editRadius}
                  onChangeText={setEditRadius}
                  maxLength={5}
                />
              </View>
            )}
            <TouchableOpacity
              onPress={saveEdit}
              disabled={editSaving}
              activeOpacity={0.85}
              style={editSaving && styles.addBtnDisabled}
            >
              <LinearGradient colors={colors.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                {editSaving ? <ActivityIndicator color={colors.white} /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { setEditModalVisible(false); setEditingZone(null); }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Drawing banner
  drawingBannerWrap: { alignItems: 'center', paddingVertical: 6 },
  drawingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  drawingBannerText: { color: '#92400E', fontWeight: '600', fontSize: 13, flex: 1 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cancelText: { color: colors.danger, fontWeight: '700', fontSize: 13 },

  // Map
  mapContainer: { flex: 1, overflow: 'hidden' },
  map: { flex: 1 },
  patientLabelWrap: { position: 'absolute', width: 90, alignItems: 'center' },
  patientNameTag: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  patientNameText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  zoneLabelWrap: { position: 'absolute', width: 90, alignItems: 'center' },
  zoneNameTag: {
    backgroundColor: 'rgba(16,185,129,0.9)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  zoneNameTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  mapStyleBtn: {
    position: 'absolute',
    bottom: 14,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 62,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  mapStyleBtnIcon: { fontSize: 20 },
  mapStyleBtnLabel: { fontSize: 10, fontWeight: '700', color: colors.text, marginTop: 2, textTransform: 'capitalize' },

  // Bottom panel
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    maxHeight: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: 14,
  },

  // Add buttons
  addButtons: { flexDirection: 'row', gap: 10 },
  addBtnWrap: { flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Zone list
  zoneList: { marginTop: 12 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  zoneIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneIconWrapCircle: { backgroundColor: colors.primaryLight },
  zoneIconWrapPoly: { backgroundColor: colors.secondaryLight },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: 15, fontWeight: '700', color: colors.text },
  zoneMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 18 },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 14,
  },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  radiusLabel: { fontSize: 15, color: colors.text, fontWeight: '600' },
  radiusInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    width: 100,
    textAlign: 'center',
    backgroundColor: colors.background,
  },
  saveBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 17 },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
