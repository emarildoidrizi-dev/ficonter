# FICONTER Mobile — Profile / Settings Separation

Implemented the requested mobile account behavior:

- The top-right profile/avatar button no longer opens **All sections**.
- Tapping the avatar opens a compact profile-only sheet containing:
  - **Profile**
  - **Sign out**
- The hamburger/menu icon remains responsible for **All sections**.
- The account/profile block was removed from the All sections drawer to avoid duplication.
- Added a dedicated `/dashboard/profile` route for identity, profile photo, and login-email management.
- Removed **Profile** from the Settings section list.
- `/dashboard/settings?section=profile` now redirects to `/dashboard/profile`.
- Settings now opens on **Account & security** by default.
- The bottom Settings control remains independent and retains its on/off toggle behavior.

No financial calculations, Supabase tables, subscription entitlements, or business-module logic were changed.
