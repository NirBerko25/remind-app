import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice } from './api';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions and get the Expo push token.
 * @returns {Promise<string|null>} Expo push token or null if not granted
 */
export async function requestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log('[Notifications] Expo push token:', token);
    return token;
  } catch (error) {
    console.error('[Notifications] Error getting token:', error);
    return null;
  }
}

/**
 * Set up notification channel for Android.
 */
export async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ReMind Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2C7BE5',
      sound: true,
    });

    await Notifications.setNotificationChannelAsync('sos', {
      name: 'SOS Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#E74C3C',
      sound: true,
    });
  }
}

/**
 * Initialize notifications: request permissions, get token, register with backend.
 * @param {string} patientId
 * @param {string} role - 'patient' | 'caregiver'
 * @returns {Promise<string|null>} push token
 */
export async function initializeNotifications(patientId, role) {
  try {
    await setupAndroidChannel();
    const token = await requestNotificationPermissions();

    if (token && patientId) {
      await registerDevice(patientId, token, role);
      console.log('[Notifications] Device registered with backend');
    }

    return token;
  } catch (error) {
    // Notifications are non-critical — log but don't crash the app
    console.error('[Notifications] Initialization error:', error);
    return null;
  }
}

/**
 * Add a listener for incoming notifications (foreground).
 * @param {function} handler - called with notification object
 * @returns subscription (call .remove() to unsubscribe)
 */
export function addNotificationListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add a listener for when user taps a notification.
 * @param {function} handler - called with notification response
 * @returns subscription (call .remove() to unsubscribe)
 */
export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
