# FICONTER Mobile UI Stabilization — Phase 5

## Goal
Phase 5 is the final comfort, ergonomics and real-device QA layer. The objective is not to add visual decoration; it is to make daily financial entry, navigation and review feel calm, predictable and easy to operate with one hand.

## What changed
- Added `app/mobile-comfort.css`, loaded after Phase 4 so the changes remain mobile-only.
- Added keyboard-aware viewport tracking to `FiconterNativeAppChrome`.
- The bottom dock now automatically gets out of the way while the software keyboard is open.
- Bottom-sheet dialogs use the visible viewport height so actions are not hidden behind the keyboard.
- Added 48px default touch targets and 44px minimum icon-button targets.
- Added stronger focus states and scroll clearance for focused form controls.
- Prevented the closed navigation drawer from remaining in the keyboard focus order.
- Added drawer focus containment and focus restoration for Escape/close interactions.
- Locked background scrolling while the drawer is open.
- Increased bottom-dock and drawer typography/tap comfort without increasing visual clutter.
- Improved horizontal KPI/data rails with contained touch scrolling.
- Added dedicated small-phone and short-landscape ergonomics.
- Corrected the full-bleed safe-area background so light/premium themes no longer expose a hard-coded dark seam around the app.

## Practicality rules
1. The bottom navigation must never cover the field a user is typing into.
2. Primary mobile controls should be reachable with a thumb and large enough to tap reliably.
3. Forms should not zoom on iOS or jump unpredictably when focused.
4. The page remains the primary vertical scroller; nested vertical scroll regions are avoided.
5. Drawer navigation must never allow accidental background scrolling.
6. Financial values get visual priority; helper copy remains readable but secondary.
7. The interface should stay calm: no additional decorative panels, redundant floating controls or unnecessary animations were added.
8. Desktop remains unchanged.

## Final live acceptance checklist
Test the Vercel preview on at least one real phone before merging.

### Navigation
- Open/close More drawer repeatedly.
- Tap outside the drawer to close it.
- Navigate every bottom-dock destination.
- Verify the active destination is obvious but not visually loud.
- Switch Personal ↔ Business.

### Data entry / keyboard
- Add a transaction while the keyboard is open.
- Edit an existing transaction.
- Enter the Monthly Budget.
- Add/edit a bill, credit card, debt and goal.
- Open Settings and edit profile/base currency/preferences.
- Confirm the bottom dock disappears while typing and returns after the keyboard closes.
- Confirm modal Save/Cancel actions never sit underneath the keyboard.

### Comfort / layout
- 320–360px phone.
- 390–430px phone.
- Tablet.
- Portrait and landscape.
- Scroll long Transactions and Settings pages.
- Swipe KPI rails and confirm the whole page does not move sideways.
- Verify no button, amount or card exits the viewport.

### Themes
- Light.
- Dark.
- Emerald.
- Bordeaux.
- Ocean.
- Sandstone.
- Coastal/time-aware wallpaper where enabled.
- Check the status-bar/safe-area edges for incorrect dark/white seams.

### PWA/browser
- Normal mobile browser.
- Installed PWA.
- Refresh while inside a non-Overview module.
- Sign out and sign back in.

## Merge gate
Merge `feature/mobile-ui-stabilization` into `main` only after:
1. Vercel production build is green.
2. The final live checklist above passes.
3. No desktop regression is visible.
