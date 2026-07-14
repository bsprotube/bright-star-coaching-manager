import { useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Makes a screen's list/scroll area actually scroll on web.
 *
 * Two things conspired to break scrolling on every screen:
 *
 * 1. React Navigation's web card breaks the height chain, so a screen container
 *    styled `flex: 1` never resolves to a definite height.
 * 2. In a flex column the `flex` shorthand also sets flex-basis, and flex-basis
 *    governs the main-axis size — overriding `height` outright. Both `flex: 1` and
 *    `flex: 0` resolve to `flex-basis: 0%`, so any height we set was silently ignored.
 *
 * Together those let the scroller stretch to its full content height, at which point
 * it has nothing to scroll (scrollHeight === clientHeight) and is simply clipped by
 * the card. The fix is to give the scroller an explicit pixel height with flex-basis
 * pinned to `auto`, measuring at runtime how much room is left below the header.
 *
 * Usage:
 *   const { screenStyle, headerLayout, scrollStyle, webRefreshControl } = useWebScroll();
 *
 *   <SafeAreaView style={[styles.safeArea, screenStyle]}>
 *     <Header ... />
 *     <View style={styles.filters} onLayout={headerLayout}>...</View>
 *     <FlatList
 *       style={scrollStyle}
 *       refreshControl={webRefreshControl(<RefreshControl ... />)}
 *     />
 *   </SafeAreaView>
 *
 * `headerLayout` goes on the LAST element above the scroller (it measures that
 * element's bottom edge). If the scroller sits directly under the Header, wrap the
 * Header in a plain <View onLayout={headerLayout}>.
 *
 * On native every value is null/pass-through, so normal flex layout is untouched.
 */

const fixedHeight = (h) => ({
  height: h,
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 'auto',
});

export default function useWebScroll() {
  const { height: windowHeight } = useWindowDimensions();
  const [top, setTop] = useState(0);

  const isWeb = Platform.OS === 'web';

  return {
    isWeb,

    // For the screen container (SafeAreaView).
    screenStyle: isWeb ? { ...fixedHeight(windowHeight), overflow: 'hidden' } : null,

    // onLayout for the last element above the scroller.
    headerLayout: (e) => {
      const { y, height } = e.nativeEvent.layout;
      setTop(Math.round(y + height));
    },

    // For the FlatList/ScrollView that should scroll.
    scrollStyle: isWeb && top > 0 ? fixedHeight(Math.max(windowHeight - top, 200)) : null,

    // react-native-web moves a ScrollView's `style` prop onto the RefreshControl
    // wrapper instead of the scrolling element, so our height would never reach the
    // scroller. Pull-to-refresh is a touch gesture that does nothing with a mouse,
    // so drop it on web.
    webRefreshControl: (element) => (isWeb ? undefined : element),
  };
}
