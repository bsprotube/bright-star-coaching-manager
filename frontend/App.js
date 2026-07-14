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
        // Was 'auto' — but now every screen (StudentListScreen,
        // AddEditStudentScreen, etc.) locks itself to 100vh and owns its
        // own internal FlatList/ScrollView scroller. Keeping #root
        // scrollable too meant TWO scrollers (the page and the list) were
        // fighting over the same drag/wheel gesture, which is what caused
        // the shake. #root no longer needs to scroll at all.
        root.style.overflow = 'hidden';
      }

      // NOTE: We previously tried a blanket `div { min-height: 0; }` rule
      // here to fix scrolling app-wide in one shot. That was too broad —
      // react-native-web renders EVERY component (Text, Image, Button, etc.)
      // as a div, and many of them already rely on flex:1 with content-based
      // sizing. Forcing min-height:0 on all of them let unrelated flex
      // containers collapse to zero height, which is why the app went
      // blank/unresponsive. Reverted. Scroll fixes now go back to being
      // scoped per-screen (safeArea / flatList / modalBg / modalContent /
      // profileWrapper / profileScroll etc.), each with its own
      // Platform.select({ web: { minHeight: 0 } }) — more typing, but it
      // only affects the exact containers that are meant to scroll.

      // react-native-safe-area-context injects a hidden, zero-size
      // position:fixed measurement frame with a CSS transition on its
      // safe-area padding. On some browsers/setups this transition keeps
      // re-triggering during scroll/resize, which shows up as a rapid,
      // repeated "blink" — as if the whole page were reloading. It's purely
      // cosmetic (the frame is invisible either way), so we just disable
      // the transition on it once we can find it.
      const disableSafeAreaFrameTransition = () => {
        const candidates = document.querySelectorAll('div');
        candidates.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' && style.zIndex === '-1') {
            el.style.transition = 'none';
          }
        });
      };
      // The frame is inserted asynchronously by the library, so try a couple
      // of times shortly after mount rather than only once.
      disableSafeAreaFrameTransition();
      const t1 = setTimeout(disableSafeAreaFrameTransition, 200);
      const t2 = setTimeout(disableSafeAreaFrameTransition, 1000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
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