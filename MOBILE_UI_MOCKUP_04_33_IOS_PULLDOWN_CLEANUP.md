# FICONTER Mobile 04.33 — iOS Pull-Down Cleanup

- Fixes the extra green/root-background strip exposed by iOS rubber-band pull-down on the Overview page.
- Keeps the normal FICONTER header unchanged.
- Uses the current time-aware Overview wallpaper as the overscroll backdrop instead of the green root canvas.
- Disables vertical root overscroll on supported iOS Safari/PWA installations while preserving ordinary page scrolling.
- Scoped to the Personal Overview screen so other modules are not visually changed.
