# FICONTER Phase 1 — Live Acceptance Checklist

Use a disposable test account where deletion is required. Confirm desktop and mobile behavior.

## Authentication

- [ ] Register a new account and confirm the email link opens the dashboard.
- [ ] Log out and log back in.
- [ ] Request password reset, open the email link, set a new password, and log in with it.
- [ ] Invalid or expired reset links show a safe error.

## Transactions

- [ ] Add EUR income, expense, and saving records.
- [ ] Add a non-EUR transaction and verify the EUR conversion.
- [ ] Edit and delete a transaction.
- [ ] Refresh and confirm persistence.
- [ ] Confirm ledger, overview, planner, and net worth update.

## Bills

- [ ] Add, edit, search, and delete a pending bill.
- [ ] Add a non-EUR bill.
- [ ] Mark a bill paid and verify exactly one linked transaction.
- [ ] Delete the paid bill and verify its linked transaction is also removed.

## Monthly Planner

- [ ] Create or edit a month plan and opening balance.
- [ ] Add, edit, reorder, and delete planner items.
- [ ] Confirm transactions, bills, goals, and debt data are reflected correctly.
- [ ] Refresh and confirm persistence.

## Goals

- [ ] Create and edit a goal.
- [ ] Record an investment and verify the saving transaction and progress.
- [ ] Reverse the investment and verify cash flow is restored.
- [ ] Delete a goal and verify linked investment transactions are removed.

## Debt

- [ ] Add and edit EUR and non-EUR debts.
- [ ] Record a payment and verify the balance and linked transaction.
- [ ] Reverse a payment and verify the balance and transaction are restored/removed correctly.
- [ ] Delete a debt and verify linked payments and transactions are removed.

## Net Worth

- [ ] Confirm liabilities reflect active debt balances.
- [ ] Confirm transaction changes update the displayed net position.
- [ ] Verify updates in a second browser tab without manual refresh.

## Settings and Profile

- [ ] Update name, display name, interface settings, and trusted-device preference.
- [ ] Upload, replace, and remove a profile photo.
- [ ] Export transactions as CSV.
- [ ] Export account data and verify all Phase 1 tables are present.
- [ ] Delete all financial records on a disposable account and verify the account remains active.
- [ ] Permanently delete a disposable account and verify login no longer works.

## Admin

- [ ] User search, Suspend, Restore, Make Admin, Remove Admin, and Delete work.
- [ ] Super Admin shows `Protected Account` and no prohibited controls.
- [ ] Audit entries contain action, target, administrator, date, and time.
- [ ] Auth, Database, Storage, and Realtime health statuses refresh automatically.
- [ ] Ordinary users cannot access the admin page or admin APIs.
- [ ] No customer balances, amounts, transactions, bills, goals, debts, savings, or planner values appear in Admin.

## Final acceptance

- [ ] Vercel deployment is `Ready`.
- [ ] Browser console has no recurring errors during the tests.
- [ ] No critical or high-severity defect remains.
