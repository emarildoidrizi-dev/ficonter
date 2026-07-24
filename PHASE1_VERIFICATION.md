# FICONTER Phase 1 Verification

Admin may see account identity, account status, roles, sign-in timestamps,
aggregate module record counts, storage-object counts, system status and admin
audit actions.

Admin must not see individual financial amounts, balances, transaction
descriptions, bill values, goal values, debt balances, net worth, private notes,
passwords, tokens or recovery codes.

After deployment:

1. Confirm Admin appears above Settings.
2. Confirm `/dashboard/admin` opens only for an admin.
3. Search an account.
4. Suspend and restore a test account.
5. Promote and demote a test admin.
6. Confirm every action appears in Recent actions.
7. Confirm the current super admin cannot suspend/delete itself.
8. Confirm aggregate record counts update.
9. Confirm no customer financial amounts appear.
10. Smoke-test Transactions, Bills, Debt, Goals, Planner and Settings.
