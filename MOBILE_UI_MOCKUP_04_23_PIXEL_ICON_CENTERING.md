# Mobile UI 04.23 — Pixel-level icon centering

- Hard-centered the `Still to pay` and `Left after everything` glyphs at 50% / 50% inside fixed icon boxes.
- Removed inherited `.miniStats span` margins that were contaminating icon/copy positioning.
- Made the grid icon column exactly equal to the icon-box width.
- Added isolated optical Y offsets: Receipt +1px, Bar chart +0.5px.
- Reset icon, copy, and chevron margins so external span rules cannot move them.
- No Overview values, routes, calculations, card sizes, or other modules were changed.
