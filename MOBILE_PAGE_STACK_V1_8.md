# FICONTER Mobile Page Stack V1.8

## Locked navigation rule
Every secondary mobile section is treated as a separate screen.

- Forward navigation opens the new screen with a right-to-left slide.
- Back navigation returns through the real mobile screen stack with the reverse slide.
- Parent content is never left rendered underneath its child/detail screen.
- The rule applies recursively across Personal, Business, and Admin routes.
- Query-based drill-downs such as Settings sections participate in the same stack.
- Root screens remain the base level.
- Reduced-motion accessibility preferences disable the animation while preserving navigation behavior.

## Settings correction
Settings now behaves as a true parent/detail flow on mobile:

1. `/dashboard/settings` shows only the Settings menu.
2. Selecting a section opens `/dashboard/settings?section=...` as its own screen.
3. The Settings menu disappears while the selected section is open.
4. Back returns to the Settings menu, not to a blank page or the child screen again.

Desktop behavior is not converted into the mobile screen stack.
