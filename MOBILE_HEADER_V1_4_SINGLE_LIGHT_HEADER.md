# FICONTER Mobile Header V1.4 — Single Light Header

## Locked mobile rule
- The light/translucent Sidebar utility bar is the only mobile top header.
- The previous FiconterNativeAppChrome top header is hidden on mobile.
- Personal, Business and Admin use the same header language.
- Logo is branding only.
- Language globe, inbox, notifications and account controls remain visible on phones.
- Account menu contains Profile and Log out only.
- Business keeps its active-business selector as a separate second row.

## Contextual Back
- A visible Back button is rendered inside this same light header on secondary pages.
- Root pages do not show Back:
  - Personal: Overview, Transactions, Planner
  - Business: Overview, Sales, Transactions
- Back returns to the previous in-app route when available, otherwise falls back to the workspace Overview.

## Verification
- Header governance checks: 15/15 passed.
- Existing mobile Phase 6: 24/24 passed.
- Existing mobile Phase 5: 21/21 passed.
- Existing mobile Phase 4: 25/25 passed.

## Build note
A full local Next.js build could not be executed in this sandbox because the extracted dependency tree does not include the `next` binary/type packages. The file-level and existing project mobile verification suites passed.
