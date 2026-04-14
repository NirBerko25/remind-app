import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import {
  addNotificationListener,
  addNotificationResponseListener,
} from './src/services/notifications';

function RootApp() {
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    // Listen for notifications while app is in foreground
    notificationListener.current = addNotificationListener((notification) => {
      console.log('[App] Notification received:', notification.request.content.title);
    });

    // Listen for user tapping a notification
    responseListener.current = addNotificationResponseListener((response) => {
      console.log('[App] Notification tapped:', response.notification.request.content.title);
      // Future: navigate to relevant screen based on notification type
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootApp />
      </AppProvider>
    </SafeAreaProvider>
  );
}
