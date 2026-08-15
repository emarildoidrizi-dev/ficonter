# FICONTER Mobile UI Mockup 04.25 — Compact Fullscreen Shell

## What changed

### 1) Compact header
- Reduced mobile shell header height.
- Tightened top/bottom padding.
- Reduced brand mark footprint.
- Kept the menu below the title but in a tighter layout.
- Preserved the globe + avatar placement while making the shell lighter.

### 2) Compact footer / bottom dock
- Reduced bottom dock height.
- Reduced dock item vertical footprint.
- Slightly reduced the central add button size.
- Preserved tap targets while freeing more content space.

### 3) Fullscreen mobile coverage
- Native app mode now explicitly fills the full mobile viewport.
- `.app-shell` and `.app-main` are forced to full-screen coverage in native app mode.
- Content padding now follows compact shell height variables.
- Bottom padding now properly accounts for the dock height + safe area.

### 4) Business workspace shell
- Reduced the expanded business header height so business mode also benefits from the compact shell.

## Key files updated
- `components/FiconterNativeAppChrome.module.css`
- `app/globals.css`

## Result
The mobile app now:
- uses less space for the header and footer,
- shows more usable content immediately,
- and covers the whole mobile screen more consistently.
