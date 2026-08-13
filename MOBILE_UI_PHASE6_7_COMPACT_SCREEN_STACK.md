# FICONTER Mobile UI — Phase 6.7 Compact Screen Stack

## Purpose
Replace the website-like long-page feeling with a bounded mobile application viewport and native-style screen navigation.

## Navigation behavior
- Personal root: `/dashboard/overview`
- Business root: `/business/overview`
- Root screen top-left: original website `ficonter-mark.svg` with a small menu badge; this is the only full-navigation trigger.
- Deeper module top-left: Back arrow.
- Forward module navigation receives a right-to-center screen transition.
- Back navigation receives a left-to-center screen transition.
- A right swipe beginning at the left screen edge also performs Back.
- Back falls back to the workspace Overview when no useful browser history movement occurs.

## Compact layout behavior
- Mobile uses a single `100dvh` application viewport.
- The current `.app-main` screen owns vertical scrolling; the browser document itself does not become an endless page.
- Fixed header and bottom dock remain stable.
- Personal Overview financial cards are a horizontally swipeable snap deck instead of six vertically stacked cards.
- Existing Financial/Business module layouts, forms, calculations, permissions, realtime behavior, currency engine and business-profile switching are unchanged.

## Branding
Uses the existing website/platform `/ficonter-mark.svg` asset. No new/replacement logo asset is introduced.

## Accessibility
- Reduced-motion disables screen animations.
- Existing drawer focus trapping and keyboard behavior remain intact.
- Edge swipe-back begins only within 26px of the left edge to avoid conflicting with normal horizontal controls.
