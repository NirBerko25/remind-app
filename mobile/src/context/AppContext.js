import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PATIENT_ID } from '../constants/config';

const AppContext = createContext(null);

const STORAGE_KEYS = {
  ROLE: '@remind_role',
  PATIENT_ID: '@remind_patient_id',
  PATIENT_NAME: '@remind_patient_name',
};

export function AppProvider({ children }) {
  const [role, setRoleState] = useState(null);
  const [patientId, setPatientIdState] = useState(DEFAULT_PATIENT_ID);
  const [patientName, setPatientNameState] = useState('Friend');
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted state on mount
  useEffect(() => {
    async function loadPersistedState() {
      try {
        const [storedRole, storedPatientId, storedPatientName] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ROLE),
          AsyncStorage.getItem(STORAGE_KEYS.PATIENT_ID),
          AsyncStorage.getItem(STORAGE_KEYS.PATIENT_NAME),
        ]);

        if (storedRole) setRoleState(storedRole);
        if (storedPatientId) setPatientIdState(storedPatientId);
        if (storedPatientName) setPatientNameState(storedPatientName);
      } catch (error) {
        console.error('Error loading persisted state:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPersistedState();
  }, []);

  const setRole = async (newRole) => {
    try {
      setRoleState(newRole);
      await AsyncStorage.setItem(STORAGE_KEYS.ROLE, newRole);
    } catch (error) {
      console.error('Error persisting role:', error);
    }
  };

  const setPatientId = async (newId) => {
    try {
      setPatientIdState(newId);
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENT_ID, newId);
    } catch (error) {
      console.error('Error persisting patientId:', error);
    }
  };

  const setPatientName = async (newName) => {
    try {
      setPatientNameState(newName);
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENT_NAME, newName);
    } catch (error) {
      console.error('Error persisting patientName:', error);
    }
  };

  const clearRole = async () => {
    try {
      setRoleState(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.ROLE);
    } catch (error) {
      console.error('Error clearing role:', error);
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        patientId,
        setPatientId,
        patientName,
        setPatientName,
        clearRole,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
