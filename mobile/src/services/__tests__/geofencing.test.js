// Mock native modules that are loaded at module level in geofencing.js
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import { haversineDistance, isPointInPolygon, isInsideZone } from '../geofencing';

// ── haversineDistance ─────────────────────────────────────────────────────────
describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(32, 34, 32, 34)).toBe(0);
  });

  it('is approximately 111 195 m per degree latitude at the equator', () => {
    expect(haversineDistance(0, 0, 1, 0)).toBeCloseTo(111195, -2);
  });

  it('is symmetric', () => {
    const a = haversineDistance(32.08, 34.78, 32.1, 34.85);
    const b = haversineDistance(32.1, 34.85, 32.08, 34.78);
    expect(a).toBeCloseTo(b, 5);
  });

  it('returns a positive value for distinct points', () => {
    expect(haversineDistance(32.08, 34.78, 32.09, 34.79)).toBeGreaterThan(0);
  });
});

// ── isPointInPolygon ──────────────────────────────────────────────────────────
describe('isPointInPolygon', () => {
  const square = [
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 0 },
    { latitude: 1, longitude: 1 },
    { latitude: 0, longitude: 1 },
  ];

  it('returns true for point at center of square', () => {
    expect(isPointInPolygon(0.5, 0.5, square)).toBe(true);
  });

  it('returns false for point clearly outside', () => {
    expect(isPointInPolygon(2, 2, square)).toBe(false);
  });

  it('returns false for negative coordinates outside', () => {
    expect(isPointInPolygon(-1, -1, square)).toBe(false);
  });

  it('returns false for empty polygon', () => {
    expect(isPointInPolygon(0.5, 0.5, [])).toBe(false);
  });

  it('returns false for single-vertex polygon', () => {
    expect(isPointInPolygon(0, 0, [{ latitude: 0, longitude: 0 }])).toBe(false);
  });
});

// ── isInsideZone ──────────────────────────────────────────────────────────────
describe('isInsideZone — circle', () => {
  const zone = { type: 'circle', latitude: 32.08, longitude: 34.78, radius: 500 };

  it('returns true for point at exact center', () => {
    expect(isInsideZone(zone, 32.08, 34.78)).toBe(true);
  });

  it('returns true for point clearly inside the radius', () => {
    // ~111m north of center
    expect(isInsideZone(zone, 32.081, 34.78)).toBe(true);
  });

  it('returns false for point outside the radius', () => {
    // ~2.8 km north of center
    expect(isInsideZone(zone, 32.105, 34.78)).toBe(false);
  });

  it('defaults to 500 m radius when zone.radius is undefined', () => {
    const noRadius = { type: 'circle', latitude: 32.08, longitude: 34.78 };
    expect(isInsideZone(noRadius, 32.08, 34.78)).toBe(true);
  });
});

describe('isInsideZone — polygon', () => {
  const zone = {
    type: 'polygon',
    coordinates: [
      { latitude: 32.0, longitude: 34.7 },
      { latitude: 32.1, longitude: 34.7 },
      { latitude: 32.1, longitude: 34.8 },
      { latitude: 32.0, longitude: 34.8 },
    ],
  };

  it('returns true for point inside the polygon', () => {
    expect(isInsideZone(zone, 32.05, 34.75)).toBe(true);
  });

  it('returns false for point outside the polygon', () => {
    expect(isInsideZone(zone, 32.2, 34.9)).toBe(false);
  });

  it('parses JSON string coordinates', () => {
    const stringCoords = {
      type: 'polygon',
      coordinates: JSON.stringify([
        { latitude: 32.0, longitude: 34.7 },
        { latitude: 32.1, longitude: 34.7 },
        { latitude: 32.1, longitude: 34.8 },
        { latitude: 32.0, longitude: 34.8 },
      ]),
    };
    expect(isInsideZone(stringCoords, 32.05, 34.75)).toBe(true);
  });
});

describe('isInsideZone — unknown type', () => {
  it('returns false', () => {
    expect(isInsideZone({ type: 'unknown' }, 32, 34)).toBe(false);
  });
});
