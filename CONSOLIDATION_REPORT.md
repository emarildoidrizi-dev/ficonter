# FICONTER Release Candidate 1 — Consolidation Report

## Base and merge order

1. Base repository: `ficonter-main (14).zip`
2. Performance and Accuracy Hardening v1
3. Realtime TypeScript Hotfix
4. Consolidation corrections and cleanup

Older partial ZIP packages were not blindly stacked over the repository. Their accepted functionality was checked against the latest complete base first.

## Critical corrections completed

### Bills

- `Mark paid` and `Mark unpaid` behavior remains present.
- Bill deletion now uses `delete_bill_with_transaction`, so a Bill and its linked Transaction are removed atomically.
- Destructive confirmation supports Enter-key activation.
- Module-scoped Realtime notification remains active.

### Debt

- Payment creation now calls `record_debt_payment_atomic`, which exists in `phase1_qa_finalization.sql`.
- Payment reversal continues to use `reverse_debt_payment` from the bidirectional synchronization migration.
- Debt deletion continues to use `delete_debt_with_linked_transactions`.
- Debt and payment deletion confirmations support Enter-key activation.

### Realtime and performance

- Browser Supabase clients are reused.
- Realtime payloads have explicit TypeScript typing.
- Duplicate refreshes are deduplicated and debounced.
- Hidden tabs defer nonessential refresh work.
- Module-scoped events replace unnecessary platform-wide refreshes.
- Exchange-rate requests use caching and in-flight request deduplication.

### Financial accuracy

- Shared precision helpers retain calculation precision before display rounding.
- Monthly Planner assigns activity by local financial date.
- Linked Bill Transactions are excluded from ordinary expense duplication.
- Goal and Debt activity retain separate classifications.

### Appearance and layout

- Eight Scene Wallpapers remain available.
- Six Sidebar Atmospheres remain available.
- Wallpaper layers use `pointer-events: none`.
- Desktop sidebar remains fixed while the main workspace scrolls.
- Horizon layout no longer applies a conflicting vertical overflow rule.
- Wallpaper transparency applies only while the wallpaper is enabled.

## Removed obsolete files

Unused root compatibility exports, the unreferenced navigation stylesheet, stale package-specific deployment notes and obsolete gradient-only Living Themes verification scripts were removed. See `FILES_TO_DELETE_AFTER_UPLOAD.txt`.

## Verification completed

`npm run verify:release-candidate` executes 31 repository verification suites.

Confirmed during packaging:

- 140 TypeScript/TSX files passed syntax transpilation.
- 61 Phase 1 QA checks passed.
- 50 Phase 1 security checks passed.
- 20 performance and accuracy checks passed.
- All Phase 2 financial-engine suites passed.
- Bills, Debt, Goals and Transaction synchronization suites passed.
- Financial File Import and Statement Import suites passed.
- Support, notifications and Document Vault suites passed.
- Theme, Scene Wallpaper, Sidebar Atmosphere, Horizon and fixed-sidebar suites passed.

## Production build limitation

A full `npm install` and `next build` could not be completed in the packaging environment because its configured npm registry did not provide `@supabase/ssr`, and direct public-registry access timed out. This is an environment limitation, not a successful build result.

The Vercel preview deployment is therefore the authoritative final compilation gate.

## Required live acceptance tests

1. Register, confirm email, log in and log out.
2. Add, edit and delete an Income transaction.
3. Add, edit and delete an Expense transaction.
4. Add a Bill and mark it paid.
5. Confirm exactly one linked Transaction is created.
6. Mark the Bill unpaid and confirm the linked Transaction disappears.
7. Mark it paid again and delete the Bill; confirm the Bill and linked Transaction disappear together.
8. Add Debt, record a payment, reverse the payment and delete the Debt.
9. Record and reverse a Goal investment.
10. Confirm Overview, Transactions and Monthly Planner update without a manual refresh.
11. Import a small CSV and a searchable PDF.
12. Export account data in CSV, JSON and PDF.
13. Change theme, wallpaper, wallpaper motion and sidebar atmosphere.
14. Confirm desktop main-content scrolling, fixed sidebar behavior and mobile page scrolling.
15. Test customer Inbox, Admin Support Inbox, notifications and Document Vault.

## Database function prerequisites

The live Supabase project must contain:

- `mark_bill_paid`
- `mark_bill_unpaid`
- `delete_bill_with_transaction`
- `record_debt_payment_atomic`
- `reverse_debt_payment`
- `delete_debt_with_linked_transactions`
- Goal investment synchronization functions
- Transaction bulk deletion synchronization function

No new SQL was introduced by consolidation.
