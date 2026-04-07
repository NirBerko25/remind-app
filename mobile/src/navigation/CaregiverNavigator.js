import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';

import HistoryScreen from '../screens/caregiver/HistoryScreen';
import HistoryDetailScreen from '../screens/caregiver/HistoryDetailScreen';
import ContextScreen from '../screens/caregiver/ContextScreen';
import AlertsScreen from '../screens/caregiver/AlertsScreen';
import { colors } from '../constants/colors';

const Tab = createBottomTabNavigator();
const HistoryStack = createNativeStackNavigator();

function BackToRoleButton() {
  const { clearRole } = useApp();
  return (
    <TouchableOpacity onPress={clearRole} style={styles.backButton} activeOpacity={0.7}>
      <Text style={styles.backButtonText}>← Exit</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={styles.tabIconContainer}>
      {focused && <View style={styles.tabActiveIndicator} />}
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
  );
}

function GradientHeader({ title }) {
  return (
    <LinearGradient
      colors={colors.gradientHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.gradientHeaderBar}
    >
      <Text style={styles.gradientHeaderTitle}>{title}</Text>
    </LinearGradient>
  );
}

function AlertsGradientHeader() {
  return (
    <LinearGradient
      colors={['#DC2626', '#EF4444']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.gradientHeaderBar}
    >
      <Text style={styles.gradientHeaderTitle}>🆘 SOS Alerts</Text>
    </LinearGradient>
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
            <TabIcon emoji="💬" label="History" focused={focused} />
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
            <TabIcon emoji="📋" label="Profile" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          headerShown: true,
          headerTitle: 'SOS Alerts',
          headerStyle: { backgroundColor: '#DC2626' },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.white },
          headerLeft: () => <BackToRoleButton />,
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔔" label="Alerts" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  backButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  backButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
  },
  gradientHeaderBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradientHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 76,
    paddingBottom: 8,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
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
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  tabEmoji: {
    fontSize: 26,
    opacity: 0.45,
  },
  tabEmojiFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelFocused: {
    color: colors.primary,
    fontWeight: '700',
  },
});
