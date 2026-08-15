# FICONTER V1.22 — Wallpaper Governance

## Locked rule
Wallpaper controls and automatic time-of-day wallpapers are restricted to platform Owner and Super Admin accounts only.

- Owner: allowed
- Super Admin: allowed
- Admin: not allowed
- Customer / Free / Beta / Personal Pro / Business Pro: not allowed by subscription alone

## Implementation
- Settings Appearance renders the wallpaper fieldset only when the server-derived platform role resolves to Super Admin/Owner access.
- Personal and Business layouts enable `TimeAwareWallpaperBootstrap` only for Owner/Super Admin.
- `InterfacePreferencesBootstrap` ignores stored/custom wallpaper scenes for unauthorized accounts and pins them to the fixed coastal fallback.
- Customer subscription plans no longer advertise or unlock `wallpaper_scenes` or `time_based_wallpapers`; those catalog items are moved to planned/later so role governance is authoritative.
- The existing theme controls remain available according to their normal plan/role rules; only wallpaper governance changed.

## Verification
- Wallpaper role governance V1.22: 17/17
- Photographic wallpaper verification: passed
- Localization coverage: 0 uncovered strings
- Fixed redesign layout: 48 checks passed
- Full Release Candidate verification: 60 current suites passed

Vercel remains the final production TypeScript / Next.js build check.
