# Mobile Settings instant sheet

## Change
The Personal mobile Settings dock control no longer navigates to `/dashboard/settings` just to reveal the settings index.

- First tap: opens a local Settings bottom sheet immediately.
- Second tap: closes the sheet immediately.
- Profile and All Sections close the Settings sheet before opening their own sheets.
- The Settings sheet contains Account & security, Financial preferences, Notifications, Appearance, and Data & privacy.
- Selecting a Settings section navigates directly to that detail section; those destinations are prefetched when the sheet opens.
- Existing Settings drill-in behavior remains unchanged after a section is selected.
- Business navigation is unchanged.

## Validation
- `verify-mobile-ui-phase6.mjs`: 24 checks passed
- `verify-mobile-ui-phase2.mjs`: 19 checks passed
- `verify-mobile-profile-settings-split.mjs`: 12 checks passed
- `verify-mobile-settings-drill-in.mjs`: 12 checks passed
- TypeScript TSX syntax validation passed
- Instant Settings regression checks: 10/10 passed
