# Landing-page localization fix

## Cause

The redesigned public landing page introduced new English marketing copy after
the existing translation catalogue and localization release check had been
created. The global language selector was working, but only phrases already in
the catalogue changed language. That produced the mixed German/English page
shown in the reported screenshot.

## Correction

- Added sentence-level translations for the complete public landing experience
  in English, German, Spanish, Albanian, Arabic, Portuguese, Italian and Russian.
- Covered navigation, hero copy, feature sections, financial demo labels,
  privacy content, calls to action, image descriptions and accessibility text.
- Kept Arabic right-to-left document direction.
- Added the redesigned landing catalogue to the runtime translation path.
- Extended localization verification so future untranslated landing copy stops
  the release before deployment.
- Covered the recent coastal dashboard and time-aware wallpaper strings exposed
  by the strengthened audit.

## Verification

`npm run verify:localization` now reports:

- 8 supported languages
- 109 landing/redesign catalogue entries
- 0 uncovered static interface strings
- 0 uncovered Wealth Engine runtime strings
- 0 uncovered dynamic interface templates

TypeScript, ESLint and the optimized Next.js production build also pass.
