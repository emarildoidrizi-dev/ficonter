# FICONTER V1.28 — Runtime Navigation Recovery

This recovery was built from the supplied `main` source archive.

## Root cause fixed

The previous lint-only change replaced the content-based dependency for historical currency dates with the `dates` array identity. `TransactionLedger` creates that array inline on every render. This caused `useHistoricalReportingRates()` to recreate `normalizedDates` every render, retrigger its state-updating exchange-rate effect, and create a render/fetch loop. On the Transactions screen this could starve or race client-side route navigation, leaving the current page visible while the navigation progress indicator repeatedly appeared.

## Fixes

- `CurrencyDisplayProvider.tsx`
  - historical date dependencies now use a stable primitive content key;
  - the first currency-runtime bootstrap no longer calls `router.refresh()` and race-navigates the dashboard;
  - later committed currency changes still refresh Personal server data.
- `LanguageProvider.tsx`
  - restored the stable persistence-first provider behavior;
  - language selection remains an explicit exception to the Save rule through the selector.
- `LanguageSelector.tsx`
  - choosing a language confirms and persists it; there is no separate Save language button.
- `Sidebar.tsx`
  - desktop Log out now exits the dashboard with a deterministic hard redirect after Supabase sign-out.
- `public/sw.js`
  - cache generation bumped so stale runtime assets are retired.
- release verification now guards against the unstable historical-date dependency regression and mount-time navigation refresh regression.

## Validation

`node scripts/verify-release-candidate.mjs` passed all 62 current release suites against the repaired source.
