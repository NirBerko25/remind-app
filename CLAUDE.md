# ReMind — Claude Code Project Context

AI-powered voice assistant for Alzheimer's patients. Simple voice interface for patients, monitoring/management interface for caregivers.

## Team

- Nir Berkovich, Meitar Berko, Raz Matzliach, Hadar Orbach
- Supervisor: Prof. Igor Rekhlin

## Project Structure

```
/backend    — Node.js + Express API (port 3000)
/mobile     — Expo React Native app (Expo SDK 51)
```

## Key Commands

### Backend
```bash
cd backend
npm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY
npm run dev                  # nodemon, hot reload
npm start                    # production
npm test                     # Jest test suite
npm run test:watch           # watch mode
npm run test:coverage        # coverage report
```

### Mobile
```bash
cd mobile
npm install
npx expo install             # sync native dependencies
npx expo start               # scan QR with Expo Go
npx expo start --ios         # iOS simulator
npx expo start --android     # Android emulator
npm test                     # Jest + React Native Testing Library
npm run test:watch
```

Update `mobile/src/constants/config.js` → `API_BASE_URL` to your machine's local IP when testing on a physical device.

## Environment Variables (backend/.env)

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude AI (claude-sonnet-4-6) |
| `OPENAI_API_KEY` | No | Whisper STT (falls back to mock if absent) |
| `PORT` | No | Default: 3000 |
| `GOOGLE_MAPS_API_KEY` | No | Needed for Android map in SafeZonesScreen |

## Architecture

### Backend (`backend/src/`)
- `index.js` — Express server entry point, DB init, route mounting
- `db/database.js` — better-sqlite3 singleton, schema setup, seeds `demo-patient-1`
- `services/claude.js` — Claude API with prompt caching, context injection, state detection
- `services/notifications.js` — Expo push notification sender (SOS + geofence breach)
- `routes/chat.js` — POST /api/chat → AI response + detected state
- `routes/transcribe.js` — POST /api/transcribe → Whisper STT
- `routes/sos.js` — POST /api/sos, GET /api/sos/alerts, PATCH /api/sos/alerts/:id/resolve
- `routes/history.js` — GET /api/conversations/:patientId
- `routes/context.js` — GET/PUT /api/context/:patientId
- `routes/patients.js` — GET/POST /api/patients
- `routes/devices.js` — POST /api/devices/register
- `routes/safezones.js` — GET/POST/DELETE /api/safezones/:patientId
- `routes/location.js` — POST /api/location/breach, GET /api/location/breaches

### Mobile (`mobile/src/`)
- `context/AppContext.js` — Global state (role, patientId), persisted to AsyncStorage
- `navigation/AppNavigator.js` — Role guard: no role → select, patient → PatientNavigator, caregiver → CaregiverNavigator
- `navigation/CaregiverNavigator.js` — Bottom tabs: History, Profile, Alerts, Safe Zones
- `screens/patient/HomeScreen.js` — Core screen: mic → record → transcribe → chat → TTS + location banner + geofencing
- `screens/caregiver/ContextScreen.js` — Edit patient context (family, medications, routine, rules)
- `screens/caregiver/HistoryScreen.js` + `HistoryDetailScreen.js` — Conversation monitoring
- `screens/caregiver/AlertsScreen.js` — SOS event history
- `screens/caregiver/SafeZonesScreen.js` — Map interface: define safe zones (circles & polygons), address search
- `components/LocationStatusBanner.js` — Patient UI: "You are at Home" label (no coordinates shown)
- `services/api.js` — Axios client for all backend endpoints
- `services/speech.js` — expo-speech TTS wrapper
- `services/notifications.js` — Expo push token registration
- `services/geofencing.js` — Background location task (expo-task-manager), zone breach detection

## API Contract

| Method | Path | Body / Params | Response |
|---|---|---|---|
| POST | `/api/chat` | `{patientId, message, conversationId?}` | `{response, conversationId, detectedState}` |
| POST | `/api/transcribe` | multipart `audio` field | `{transcript}` |
| POST | `/api/sos` | `{patientId}` | `{success, notificationsSent}` |
| GET | `/api/conversations/:patientId` | — | `[{id, startedAt, messages}]` |
| GET | `/api/context/:patientId` | — | context object |
| PUT | `/api/context/:patientId` | context fields | `{success}` |
| GET | `/api/patients` | — | `[{id, name, createdAt}]` |
| POST | `/api/patients` | `{name, age}` | `{patientId, name}` |
| POST | `/api/devices/register` | `{patientId, expoPushToken, role}` | `{success}` |
| GET | `/api/safezones/:patientId` | — | `[zone]` |
| POST | `/api/safezones/:patientId` | `{name, type, latitude?, longitude?, radius?, coordinates?}` | `{id, name, type}` |
| DELETE | `/api/safezones/:patientId/:zoneId` | — | `{success}` |
| POST | `/api/location/breach` | `{patientId, latitude?, longitude?}` | `{success, notificationsSent}` |
| GET | `/api/location/breaches` | `?patientId=` | `[breach]` |

`detectedState` values: `"normal"` | `"confused"` | `"emergency"`

Zone `type` values: `"circle"` | `"polygon"`

## Database (SQLite — `backend/remind.db`)

Tables: `patients`, `conversations`, `messages`, `patient_context`, `devices`, `sos_events`, `safe_zones`, `location_breaches`

Default seed: patient id `demo-patient-1`, name "Demo Patient"

## Safe Zones Feature — Setup

Install new native dependencies before running:
```bash
cd mobile
npx expo install expo-location expo-task-manager react-native-maps
```

Add your Google Maps API key to `mobile/app.json` → `expo.android.config.googleMaps.apiKey` for Google Maps on Android.

## Test-Driven Development

**We practice TDD on this project. Write tests before or alongside every feature.**

### Backend tests (Jest + Supertest)

Test files live in `backend/tests/`. Mirror the routes structure:
```
backend/tests/
  routes/
    safezones.test.js
    location.test.js
    sos.test.js
    ...
  services/
    notifications.test.js
    claude.test.js
```

Pattern for route tests:
```js
const request = require('supertest');
const app = require('../../src/index');

describe('POST /api/safezones/:patientId', () => {
  it('creates a circle zone', async () => {
    const res = await request(app)
      .post('/api/safezones/demo-patient-1')
      .send({ name: 'Home', type: 'circle', latitude: 32.08, longitude: 34.78, radius: 300 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Home', type: 'circle' });
  });

  it('rejects circle zone missing coordinates', async () => {
    const res = await request(app)
      .post('/api/safezones/demo-patient-1')
      .send({ name: 'X', type: 'circle' });
    expect(res.status).toBe(400);
  });
});
```

Use an in-memory or separate test DB. Set `DATABASE_URL=:memory:` or point `DB_PATH` to a temp file in `jest.setup.js`.

### Mobile tests (Jest + React Native Testing Library)

Test files live alongside components/screens as `*.test.js` or in `__tests__/`:
```
mobile/src/
  services/__tests__/
    geofencing.test.js
  components/__tests__/
    LocationStatusBanner.test.js
```

Pattern for geofencing helpers (pure functions — test without mocks):
```js
import { haversineDistance, isPointInPolygon, isInsideZone } from '../geofencing';

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(32, 34, 32, 34)).toBe(0);
  });
  it('returns ~111km per degree latitude', () => {
    expect(haversineDistance(0, 0, 1, 0)).toBeCloseTo(111195, -2);
  });
});

describe('isInsideZone — circle', () => {
  const zone = { type: 'circle', latitude: 32, longitude: 34, radius: 500 };
  it('returns true when inside', () => {
    expect(isInsideZone(zone, 32.001, 34)).toBe(true);
  });
  it('returns false when outside', () => {
    expect(isInsideZone(zone, 32.01, 34)).toBe(false);
  });
});
```

Pattern for component tests:
```js
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import LocationStatusBanner from '../LocationStatusBanner';

jest.mock('../../services/api', () => ({
  getSafeZones: jest.fn().mockResolvedValue([
    { id: '1', name: 'Home', type: 'circle', latitude: 32.08, longitude: 34.78, radius: 500 }
  ]),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 32.08, longitude: 34.78 },
  }),
  Accuracy: { Balanced: 3 },
}));

it('shows zone label when inside a safe zone', async () => {
  const { getByText } = render(<LocationStatusBanner patientId="demo-patient-1" />);
  await waitFor(() => getByText('You are at Home'));
});
```

### What to test for every new file

| File type | Must test |
|---|---|
| Route handler | Happy path, missing required fields (400), unknown resource (404) |
| Service function | Core logic, error propagation |
| Geometry helper | Boundary values, edge cases (empty polygon, distance = 0) |
| React component | Renders expected text, handles loading state, handles empty/error state |
| Background task | Zone cache read, breach fire condition, cooldown logic |

Never test implementation details (internal state, private function names). Test observable behavior only.
