import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const setItem = async (key, value) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('Error writing to localStorage', e);
    }
  } else {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error('Error writing to SecureStore', e);
    }
  }
};

export const getItem = async (key) => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return null;
    }
  } else {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error('Error reading from SecureStore', e);
      return null;
    }
  }
};

export const deleteItem = async (key) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Error deleting from localStorage', e);
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('Error deleting from SecureStore', e);
    }
  }
};
