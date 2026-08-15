# FICONTER Mobile Settings Screen Replacement V1.9

## Locked behavior
On mobile, Settings is a strict parent/child page stack.

- `/dashboard/settings` shows the Settings menu only.
- Tapping Account & Security, Financial Preferences, Notifications, Appearance, Data & Privacy, or Subscription opens that section as the entire content screen.
- The Settings menu is not visible above, below, or behind the selected section.
- The selected section enters from the right.
- Back returns to the Settings menu and restores the parent screen with the reverse-direction motion.
- Desktop keeps the two-column Settings workspace.
- Reduced-motion users receive the same page replacement behavior without animation.

## Implementation
The exclusivity rule is now enforced directly in `SettingsWorkspace.module.css`, using the component's `data-mobile-detail` state. This avoids relying only on global class-name substring selectors and makes the parent/detail replacement deterministic.
