import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import LocationStatusBanner from '../LocationStatusBanner';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('../../services/api', () => ({
  getSafeZones: jest.fn(),
}));

// Mock geofencing — we test its logic separately; here we just need
// isInsideZone to be controllable.
jest.mock('../../services/geofencing', () => ({
  isInsideZone: jest.fn(),
}));

import * as Location from 'expo-location';
import { getSafeZones } from '../../services/api';
import { isInsideZone } from '../../services/geofencing';

const HOME_ZONE = {
  id: 'z1', name: 'Home', type: 'circle',
  latitude: 32.08, longitude: 34.78, radius: 500,
};

beforeEach(() => {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Location.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 32.08, longitude: 34.78 },
  });
  getSafeZones.mockResolvedValue([HOME_ZONE]);
  isInsideZone.mockReturnValue(false);
});

afterEach(() => jest.clearAllMocks());

describe('LocationStatusBanner', () => {
  it('shows "You are at Home" when inside the Home zone', async () => {
    isInsideZone.mockReturnValue(true);
    const { getByText } = render(<LocationStatusBanner patientId="demo-patient-1" />);
    await waitFor(() => expect(getByText('You are at Home')).toBeTruthy());
  });

  it('renders nothing when patient is outside all zones', async () => {
    isInsideZone.mockReturnValue(false);
    const { queryByText } = render(<LocationStatusBanner patientId="demo-patient-1" />);
    await waitFor(() => expect(queryByText(/You are at/)).toBeNull());
  });

  it('renders nothing when location permission is denied', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const { queryByText } = render(<LocationStatusBanner patientId="demo-patient-1" />);
    await waitFor(() => expect(queryByText(/You are at/)).toBeNull());
  });

  it('renders nothing when getSafeZones throws', async () => {
    getSafeZones.mockRejectedValueOnce(new Error('Network error'));
    isInsideZone.mockReturnValue(true);
    const { queryByText } = render(<LocationStatusBanner patientId="demo-patient-1" />);
    // Zones never loaded, so isInsideZone never called → no label
    await waitFor(() => expect(queryByText(/You are at/)).toBeNull());
  });

  it('renders nothing when there are no zones', async () => {
    getSafeZones.mockResolvedValueOnce([]);
    const { queryByText } = render(<LocationStatusBanner patientId="demo-patient-1" />);
    await waitFor(() => expect(queryByText(/You are at/)).toBeNull());
  });

  it('uses the correct zone name in the label', async () => {
    getSafeZones.mockResolvedValueOnce([
      { ...HOME_ZONE, name: 'The Park' },
    ]);
    isInsideZone.mockReturnValue(true);
    const { getByText } = render(<LocationStatusBanner patientId="demo-patient-1" />);
    await waitFor(() => expect(getByText('You are at The Park')).toBeTruthy());
  });
});
