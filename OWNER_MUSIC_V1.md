# FICONTER Owner Music V1

## Scope
Owner Music is a private, platform-Owner-only music player for working inside FICONTER. It is intentionally unavailable to Super Admin, Admin, Business roles, and customer accounts.

## Behavior
- Appears in both Personal and Business workspaces only when `isOwnerEmail(user.email)` is true.
- Uses a compact floating mini-player that expands into the private library.
- Supports play, pause, previous, next, seek, volume, shuffle, repeat, delete, and track upload.
- Uses a browser-global audio singleton so playback survives normal client-side module navigation and workspace layout remounts.
- Uses Media Session controls where the browser/PWA supports them.
- Volume is remembered locally.

## Storage and security
- Bucket: `owner-music`
- Bucket is private and is created automatically on first Owner access if missing.
- If an existing `owner-music` bucket is accidentally public, FICONTER forces it back to private.
- Server APIs independently verify the signed-in user is the platform Owner.
- Upload and delete mutations require same-origin requests.
- Uploads use Supabase signed upload authorization and go directly from the browser to Storage.
- Playback uses short-lived signed read URLs. No public music URLs are generated.
- V1 limits each track to 50 MB and the library to 100 tracks.

## Supported audio
MP3, M4A/MP4 audio, AAC, WAV, OGG, WEBM audio, and FLAC.

## No database migration required
V1 derives the private library directly from Supabase Storage, so there is no new SQL migration or music metadata table to deploy.

## Testing
1. Deploy the feature branch to a Vercel preview.
2. Sign in as the configured platform Owner.
3. Confirm the Owner Music mini-player appears.
4. Upload one MP3/M4A track.
5. Play it and navigate between Overview, Transactions, Monthly Planner, and Settings; playback should continue.
6. Switch between Personal and Business workspaces; the player should reappear and the browser-global audio state should remain intact during client navigation.
7. Test volume, seek, previous/next, shuffle, repeat, and delete.
8. Sign in as Super Admin/Admin/customer and confirm the player does not render.
9. Attempt `/api/owner/music` as a non-Owner and confirm access is rejected.

## Verification
- `npm run verify:owner-music`
- `npm run verify:release-candidate`
