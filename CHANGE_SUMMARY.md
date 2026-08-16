# FICONTER Release Candidate 1 — Change Summary

This release consolidates the latest complete FICONTER project and the accepted post-upload hardening packages into one official source tree.

## Monthly budget synchronization

- Added one dedicated monthly spending-budget amount to the Monthly Planner.
- Connected that value to the Overview's Monthly budget use card.
- Added real-time spent, remaining or over-budget amounts and an exact percentage.
- Preserved percentages above 100% so overspending is reported honestly.
- Kept future-dated transactions and bills out of the current spent-to-date total.
- Added the required non-negative database field and a one-run Supabase SQL file.

## Merged

- Performance and accuracy hardening
- Shared browser Supabase client typing and Realtime callback corrections
- Scene wallpapers and scroll-safe fixed background behavior
- Sidebar atmosphere controls, effects and saved preferences removed permanently
- Streamlined appearance persistence with real photographic wallpapers
- Fixed desktop sidebar / independently scrolling workspace
- Monthly Planner Recorded Activity and selectable breakdown views
- Reliable Bill paid/unpaid behavior
- Financial File Import PDF compatibility fixes

## Corrected during consolidation

- Bills now use the atomic `delete_bill_with_transaction` database function.
- Debt payment creation now calls the existing `record_debt_payment_atomic` function instead of a missing RPC name.
- Destructive Bill and Debt confirmations support Enter-key confirmation consistently.
- Horizon layout no longer declares a conflicting vertical overflow rule.
- Scene-wallpaper transparency applies only while wallpapers are enabled.
- Realtime verification now recognizes intentional module-scoped refresh events.
- Obsolete gradient-only Living Themes verification scripts were removed.
- Stale package-specific deployment files and unused root compatibility exports were removed.

## Verification

- 31 project verification suites passed.
- TypeScript/TSX syntax transpilation passed across the repository.
- Security, financial-engine, support, import, appearance and synchronization checks passed.
- A complete dependency installation and `next build` could not be executed in the packaging environment because its npm registry did not provide `@supabase/ssr`. Vercel must perform the authoritative production build.

## V1.23 — Explicit Save Governance
- Enforced draft-first editing across Settings, language, Planner start balance, Effortless Entry preference, support status and business selection.
- Removed direct save-on-blur and save-on-selection behavior from audited editable controls.
- Theme/density changes now apply globally only after Save succeeds.
- Added explicit Save/Apply actions and draft-discard behavior.
- Added 21-check explicit-save governance verification suite.


## Instant Business switching governance amendment
- Active Business profile switching is now an immediate-action exception to explicit-save governance.
- Desktop, tablet and mobile/PWA selectors switch on selection with no Save, Apply or confirmation step.
- The old `selectedBusinessId` / `pendingBusinessId` Apply-state workflow and desktop hard browser reload fallback were removed.
- Business switching is persisted through the guarded server action, synchronized across mounted shell controls, and rolled back with a compact error message on failure.
- Business content is temporarily non-interactive during server reconciliation to prevent actions against stale data from the previous Business workspace.
- This amendment supersedes only the old V1.23 Business-switch Apply requirement; editable Business settings still require explicit Save/Apply.
