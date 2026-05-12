import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

import HistoryScreen from '../screens/caregiver/HistoryScreen';
import HistoryDetailScreen from '../screens/caregiver/HistoryDetailScreen';
import ContextScreen from '../screens/caregiver/ContextScreen';
import AlertsScreen from '../screens/caregiver/AlertsScreen';
import SafeZonesScreen from '../screens/caregiver/SafeZonesScreen';
import { colors } from '../constants/colors';

const Tab = createBottomTabNavigator();
const HistoryStack = createNativeStackNavigator();

function BackToRoleButton() {
  const { clearRole } = useApp();
  return (
    <TouchableOpacity onPress={clearRole} style={styles.backButton} activeOpacity={0.7}>
      <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.9)" />
      <Text style={styles.backButtonText}>Exit</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ name, label, focused }) {
  return (
    <View style={styles.tabIconContainer}>
      {focused && <View style={styles.tabActiveIndicator} />}
      <Ionicons
        name={focused ? name : `${name}-outline`}
        size={22}
        color={focused ? colors.primary : colors.textLight}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

function HistoryStackNavigator() {
  return (
    <HistoryStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.white },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <HistoryStack.Screen
        name="HistoryList"
        component={HistoryScreen}
        options={{ title: 'Conversation History', headerLeft: () => <BackToRoleButton /> }}
      />
      <HistoryStack.Screen
        name="HistoryDetail"
        component={HistoryDetailScreen}
        options={{ title: 'Conversation' }}
      />
    </HistoryStack.Navigator>
  );
}

export default function CaregiverNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="History"
        component={HistoryStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="chatbubble-ellipses" label="History" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Context"
        component={ContextScreen}
        options={{
          headerShown: true,
          headerTitle: 'Patient Profile',
          headerStyle: { backgroundColor: colors.primaryDark },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.white },
          headerLeft: () => <BackToRoleButton />,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person-circle" label="Profile" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          headerShown: true,
          headerTitle: 'Alerts',
          headerStyle: { backgroundColor: colors.danger },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.white },
          headerLeft: () => <BackToRoleButton />,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="notifications" label="Alerts" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SafeZones"
        component={SafeZonesScreen}
        options={{
          headerShown: true,
          headerTitle: 'Safe Zones',
          headerStyle: { backgroundColor: colors.primaryDark },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.white },
          headerLeft: () => <BackToRoleButton />,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="map" label="Zones" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  backButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 76,
    paddingBottom: 8,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 12,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    position: 'relative',
  },
  tabActiveIndicator: {
    position: 'absolute',
    top: -4,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  tabLabelFocused: {
    color: colors.primary,
    fontWeight: '700',
  },
});
