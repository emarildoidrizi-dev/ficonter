# FICONTER Release Quality Standard

FICONTER follows a zero-known-error release policy. Software can encounter unforeseen defects, but no known defect is acceptable at release time.

## Release eligibility

A change is eligible for production only when all of the following are true:

- ESLint passes with no blocking errors.
- TypeScript type-checking passes.
- The complete FICONTER verification suite passes.
- Localization verification passes.
- The production build completes successfully.
- The final Vercel release candidate is green.
- No known broken flow, stale-data issue, required manual refresh, mixed-language UI, broken navigation, or critical runtime error remains unresolved.
- Financial calculations, encrypted Vault behavior, Personal workspace, Business workspace, responsive layouts, and PWA behavior remain intact when affected by the change.

## Localization

Every FICONTER-owned visible interface string must follow the selected language. English is the permanent default and runtime safety fallback if localization cannot safely resolve a string or language state.

## Data and synchronization

Financial data changes must propagate through linked modules without requiring a browser refresh. Shared values must continue to use one source of truth and shared calculation logic.

## Security

Changes must preserve E2EE and Vault guarantees. Recovery, Quick Unlock, encryption keys, authenticated access, and encrypted financial data must never be weakened merely to make a build or feature pass.

## Release states

- RED: failed validation; never eligible for production.
- YELLOW: incomplete or awaiting verification; not eligible for production.
- GREEN: all required automated checks pass and the release candidate is eligible for final acceptance testing.

## Definition of Done

For FICONTER, "done" means functional, type-safe, lint-clean, localized, synchronized, secure, responsive, successfully built, and free of known release-blocking defects.
