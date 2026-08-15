# FICONTER — Unified Mobile UI V1

This package consolidates the authenticated mobile experience into one design system without changing financial calculations, Supabase tables, subscription logic, role permissions, or desktop page architecture.

## Main changes
- Unified soft-neutral / teal / gold mobile visual system with dark-theme support.
- Compact native header and bottom navigation.
- Bottom navigation standardized to Overview / Transactions / + / Planner / More.
- Fixed personal Overview route to point directly at `/dashboard/overview`.
- Profile photo support added to the native mobile account button.
- New mobile Profile page, accessible from More.
- Transactions no longer require one long mobile page: Transactions and Add transaction switch instantly in-place.
- Compact transaction ledger rows, controls, forms, cards and lists.
- Overview cards, Monthly Planner, Bills, Debt, Goals, Savings, Net Worth, Cash Flow, Insights, Financial GPS, Emergency Fund, Credit Cards, Documents and Settings normalized to the same mobile spacing and card system.
- Business workspace modules receive the same mobile visual grammar.
- Duplicate page headings are removed on mobile where the app shell already supplies the route title.
- Desktop layouts remain governed by their existing styles; the unified stylesheet is mobile-scoped.

## Files added
- `app/mobile-unified-v1.css`
- `components/MobileTransactionsLayout.tsx`
- `components/MobileTransactionsLayout.module.css`
- `app/dashboard/profile/page.tsx`
- `scripts/verify-mobile-unified-v1.mjs`

## Files updated
- `app/layout.tsx`
- `app/dashboard/layout.tsx`
- `app/business/layout.tsx`
- `app/dashboard/transactions/page.tsx`
- `components/FiconterNativeAppChrome.tsx`
- `components/FiconterNativeAppChrome.module.css`

## Verification
- Unified Mobile UI V1: 17/17 checks passed.
- Existing Mobile UI Phase 6: 24/24 checks passed.
- Existing Mobile UI Phase 5: 21/21 checks passed.
- Existing Mobile UI Phase 4: 25/25 checks passed.

## Commit message
`feat(mobile): unify FICONTER app pages into one mobile design system`
