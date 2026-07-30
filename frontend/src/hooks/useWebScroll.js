import { Platform } from 'react-native';

/**
 * Makes a screen's list/scroll area actually scroll on web.
 *
 * Two things conspired to break scrolling on every screen:
 *
 * 1. React Navigation's web card breaks the height chain, so a screen container
 *    styled `flex: 1` never resolves to a definite height.
 * 2. In a flex column the `flex` shorthand also sets flex-basis, and flex-basis
 *    governs the main-axis size — overriding `height` outright. Both `flex: 1` and
 *    `flex: 0` resolve to `flex-basis: 0%`, so any height set alongside them was
 *    silently ignored.
 *
 * Together those let the scroller stretch to its full content height, at which point
 * it has nothing to scroll (scrollHeight === clientHeight) and is simply clipped by
 * the card.
 *
 * The fix is to give the screen container a definite height in CSS — `100vh` with
 * flex-basis pinned to `auto` so the flex shorthand can't override it — and then let
 * the scroller inside use ordinary `flex: 1` + `min-height: 0`. Once the container
 * has a real height, that resolves the way flexbox is supposed to work, with no
 * measurement involved.
 *
 * Measuring the viewport in JS instead (useWindowDimensions) was tried and is not
 * reliable: it can report a height of 0 on the first paint, which collapsed the
 * container to 0px and left the scroller stuck at whatever minimum it was given.
 * `100vh` is evaluated by the browser, is correct on the first paint, and follows
 * window resizes for free.
 *
 * Usage:
 *   const { screenStyle, scrollStyle, webRefreshControl } = useWebScroll();
 *
 *   <SafeAreaView style={[styles.safeArea, screenStyle]}>
 *     <Header ... />
 *     <FlatList
 *       style={scrollStyle}
 *       refreshControl={webRefreshControl(<RefreshControl ... />)}
 *     />
 *   </SafeAreaView>
 *
 * Anything above the scroller (header, filter bar) just sits in normal flow — its
 * height no longer needs to be known, since the scroller simply takes the space
 * that's left.
 *
 * On native both styles are null, so normal flex layout is untouched.
 */
export default function useWebScroll() {
  const isWeb = Platform.OS === 'web';

  return {
    isWeb,

    // For the screen container (SafeAreaView): a definite viewport height, with
    // flex-basis pinned so the height can't be overridden by a flex shorthand.
    screenStyle: isWeb
      ? {
          height: '100vh',
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
          overflow: 'hidden',
        }
      : null,

    // For the FlatList/ScrollView that should scroll: take the remaining space.
    // min-height:0 is what allows a flex child to shrink below its content size,
    // which is what lets it scroll internally rather than stretching.
    scrollStyle: isWeb
      ? {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: '0%',
          minHeight: 0,
          height: 'auto',
        }
      : null,

    // react-native-web moves a ScrollView's `style` prop onto the RefreshControl
    // wrapper instead of the scrolling element, so our height would never reach the
    // scroller. Pull-to-refresh is a touch gesture that does nothing with a mouse,
    // so drop it on web.
    webRefreshControl: (element) => (isWeb ? undefined : element),
  };
}
