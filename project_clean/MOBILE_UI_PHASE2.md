# FICONTER Mobile UI — Phase 2

## Scope
Phase 2 stabilizes mobile typography and theme behavior without redesigning individual financial modules or changing the desktop presentation.

## Changes
- Added one deterministic mobile semantic token layer for text, surfaces, controls, borders and accents.
- Mobile workspace content now follows the selected FICONTER light/dark theme instead of being forced through a second dark-only palette.
- Kept mobile application chrome (header, bottom dock and drawer) deliberately stable through dedicated chrome tokens.
- Replaced the competing page-heading sizes with one phone scale and one tablet override.
- Standardized control text, placeholder text, disabled text and select-option colors.
- Replaced the dark-only generic mobile card surface with theme-derived surfaces.
- Disabled `ThemeContrastGuard` runtime recoloring while the mobile application shell is active. Desktop contrast auditing remains unchanged.
- Added `verify:mobile-ui-phase2` for static regression checks.

## Deliberately not included
- No module-by-module mobile redesign.
- No desktop layout changes.
- No database, currency, subscription or financial-calculation changes.
- No navigation information architecture changes beyond the Phase 1 shell.

## Verification
Run:

```bash
npm run verify:mobile-ui-phase2
npm run verify:appearance
npm run build
```
