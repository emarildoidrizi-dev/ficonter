# Owner Music V1.1 — Playback Fix

## Cause
The Owner Music library correctly generated private Supabase signed URLs, but the application Content Security Policy did not define `media-src`. Because `default-src 'self'` was active, browsers blocked audio loaded from `https://*.supabase.co`, leaving the player at 0:00.

## Fix
- Add `media-src 'self' blob: https://*.supabase.co` to the application CSP.
- Keep the private signed-URL storage model unchanged.
- Surface browser playback failures in the Owner Music UI instead of failing silently.

## Security
The change does not make the music bucket public and does not permit arbitrary external media origins. Audio remains Owner-only and is served through time-limited Supabase signed URLs.

## Verification
`scripts/verify-owner-music.mjs` now verifies the CSP allowance and visible playback-error handling.
