# FICONTER Mobile V1.17.1 — Vercel TypeScript Build Fix

Fixed the Vercel build failure in `components/SettingsWorkspace.tsx`.

## Root cause
A Settings URL-sync state updater returned a value inferred as generic `string`, while `setActive` requires the strict `SectionId` union.

## Fix
- Explicitly type `nextSection` as `SectionId | null`.
- Pass the narrowed `SectionId` directly to `setActive`.
- No visual or navigation behavior changed.
- Compact language picker and instant language switching remain intact.

## Verification
- Settings speed: 12/12
- Responsive navigation: 13/13
- Language speed: 9/9
