---
name: Safe Zones & Location Awareness Feature
description: Safe zones geofencing feature added — new DB tables, backend routes, geofencing service, caregiver map screen, patient location banner
type: project
---

Safe Zones feature implemented across 4 contributor layers (2025-05-06):
- DB: `safe_zones` and `location_breaches` tables added to database.js
- Backend: `routes/safezones.js` (CRUD) and `routes/location.js` (breach reporting + SSE) mounted in index.js
- notifications.js: `sendBreachNotifications` added alongside existing `sendSOSNotifications`
- Mobile geofencing: `services/geofencing.js` — background TaskManager task, haversine + ray-casting geometry helpers, `startGeofencing`/`stopGeofencing`/`updateZonesCache` exports
- Caregiver: `screens/caregiver/SafeZonesScreen.js` — react-native-maps map, address geocode search, pin drop (circle) and polygon drawing modes, zone list with delete
- Patient: `components/LocationStatusBanner.js` — polls location every 30s, shows "You are at [Name]", hides when outside all zones
- HomeScreen.js: imports LocationStatusBanner + starts geofencing on mount
- CaregiverNavigator.js: added SafeZones tab (🗺️)
- app.json: added expo-location plugin, background location permissions, Google Maps config placeholder

**Why:** Feature for Alzheimer's patient safety — caregiver-defined safe zones with automatic breach alerts.
**How to apply:** Need `npx expo install expo-location expo-task-manager react-native-maps` to run. Google Maps API key required in app.json for Android map tiles.
