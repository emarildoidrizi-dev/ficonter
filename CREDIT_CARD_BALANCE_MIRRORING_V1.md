# FICONTER Credit Card Balance Semantics V2

## Locked rule
`Balance left to pay` is the live amount owed on the card and therefore always mirrors `Current balance`.

`Statement balance` is a historical issuer snapshot only. It is kept for monthly records, minimum-payment calculations, due dates and interest history. Saving a statement must not rewrite the live current balance.

### Live fields
- `Current balance` = live amount currently owed.
- `Balance left to pay` = exact mirror of Current balance.
- Purchases, fees and interest activity increase both live figures.
- Confirmed payments and refunds reduce both live figures.

### Statement record
- `Statement balance` = amount shown on the issuer's statement for that statement cycle.
- The statement remains editable when being recorded, including for the current month.
- Saving a current/new statement updates statement metadata and the permanent monthly record only.
- It does not reconcile or overwrite `current_balance`.
- `Minimum payment due` continues to be calculated from the recorded statement balance.
- Historical monthly statement records stay frozen.

## Database behavior
No new database migration is required. Current/new statement snapshots are saved through the existing `debts` row statement fields. The existing `sync_credit_card_monthly_record` trigger persists the matching `credit_card_monthly_records` snapshot. Historical backfills continue to use `save_credit_card_monthly_record`.

## Verification
- `node scripts/verify-credit-card-balance-mirroring.mjs` — 11/11
- `node scripts/verify-credit-card-management.mjs` — PASS
- `node scripts/verify-localization.mjs` — 0 uncovered strings/templates
- `node scripts/verify-release-candidate.mjs` — 71/71 current suites
