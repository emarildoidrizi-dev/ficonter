# FICONTER Mobile Mockup 04.6 — Profile avatar + instant Home

- Removed the redundant inline Settings index card from the native mobile Settings route. The bottom Settings control remains the compact Settings index.
- The saved profile photo is now shown directly inside the top-right profile control. Initials remain as a fallback.
- Profile-photo changes update the top-right avatar immediately through the existing `ficonter:profile-updated` event.
- The Home dock control is now an instant client action rather than an anchor-triggered route-loading state.
- Home is prefetched on touch/pointer down, reuses browser history when Home is the immediately previous screen, and otherwise performs a client router transition without the native route-loading progress indicator.
- Desktop Settings and business navigation remain unchanged.
