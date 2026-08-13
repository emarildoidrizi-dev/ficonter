# Monthly budget — synchronized planner and overview

The Monthly Financial Planner now contains a dedicated **Monthly budget** card
for each selected month. It is separate from starting balance, income and
available capital.

The card lets the customer save one total spending budget, then displays:

- completed spending recorded so far;
- the amount remaining or over budget;
- the exact percentage used, including values above 100%; and
- a shared progress bar using the same source as the Personal Overview.

The Overview **Monthly budget use** card reads this dedicated value for the
current local month. Both screens use completed transaction and paid-bill
activity, canonical currency storage, live database updates and the selected
base currency.

## Required database update

Apply `supabase/migrations/20260813170000_monthly_spending_budget.sql` once in
the production Supabase project before testing the deployment. This adds the
non-negative `spending_budget` column to `monthly_budget_plans` without changing
existing balances or planner records.

## Verification

```bash
npm run verify:monthly-budget
npm run verify:localization
npm run verify:appearance
npm run build
```
