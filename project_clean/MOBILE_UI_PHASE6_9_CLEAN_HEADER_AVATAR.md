# Mobile UI Phase 6.9 — Clean header + real profile avatar

- Removed the dark top header strip. The mobile header is now transparent over the selected FICONTER wallpaper/theme.
- Removed the drop-shadow / silhouette effect behind the top-left navigation control, FICONTER mark, menu badge and top-right account control.
- The top-right account control now displays the user's saved profile photo from the `profile-photos` storage bucket when one exists; initials remain the fallback.
- Profile-photo changes propagate to the top-right avatar through the existing `ficonter:profile-updated` event.
- The account popup now contains only `Log out`.
- Business profile switching remains available and its top selector uses a theme-aware floating surface rather than the old dark strip.
- Bottom navigation and the Phase 6.7 compact screen-stack behavior are unchanged.
