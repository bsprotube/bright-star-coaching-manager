import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    // ROOT-CAUSE FIX for the scrolling problem across the whole web app.
    //
    // Expo Web mounts the app into a <div id="root"> inside an auto-generated
    // index.html that we don't have direct access to edit. By default, the
    // browser's <html>/<body> don't have a fixed height, and React Navigation's
    // web card container clips overflow — so any ScrollView/FlatList deep in
    // the tree has no reliable bounded height to scroll within, no matter how
    // many individual screens we patch with height:'100%'.
    //
    // Setting these three elements to height:100% (and letting #root scroll)
    // gives every screen a real, inherited height chain from the viewport
    // down, which is what makes percentage heights and flex:1 actually work
    // for scrolling on every single screen — without editing any HTML file.
    if (Platform.OS === 'web') {
      const html = document.documentElement;
      const body = document.body;
      const root = document.getElementById('root');

      if (html) {
        html.style.height = '100%';
      }
      if (body) {
        body.style.height = '100%';
        body.style.margin = '0';
      }
      if (root) {
        root.style.height = '100%';
        root.style.overflow = 'auto';
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}