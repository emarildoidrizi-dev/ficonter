# FICONTER V1.20 — Theme-aware More menu

The mobile More / All sections drawer and account sheet now inherit the selected FICONTER theme instead of retaining the historical fixed emerald/dark palette.

Covered surfaces:
- drawer canvas and border
- section cards and hover/active states
- labels, text, icons and lock/active indicators
- close control and sheet handle
- Personal/Business workspace switcher
- business profile selector and options
- profile/account sheet actions
- danger/logout actions

The implementation uses the global semantic theme tokens (`--surface-*`, `--text-*`, `--border-*`, `--gold`, `--solid-text`, `--danger-soft`, `--burgundy`) so theme changes propagate immediately without a refresh.
