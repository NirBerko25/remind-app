import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientHomeScreen from '../screens/patient/HomeScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function PatientNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="PatientHome"
        component={PatientHomeScreen}
        options={{ title: 'ReMind' }}
      />
    </Stack.Navigator>
  );
}
