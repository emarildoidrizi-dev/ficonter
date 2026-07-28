# Change summary

The package adds a guided Financial Setup workspace that distinguishes missing information from a confirmed zero financial position.

## Customer experience

- New Financial Profile progress card on Overview.
- New `/dashboard/setup` guided workspace.
- Seven setup areas: income, expenses, bills, debt, savings, goals and Monthly Planner.
- Explicit confirmations for no bills, debt-free, no savings yet and no active goals.
- Profile completion percentage and next-step guidance.
- Score status progresses from Pending to Preliminary to Ready.
- Realtime refresh when connected financial modules change.
- Financial Setup entry added to the profile menu.
- Guided transaction links preselect Income, Expense or Saving.

## Scoring protection

- A saving transfer alone no longer substitutes for an expense baseline.
- Income-only profiles remain incomplete.
- Confirmations describe empty categories without creating artificial balances or scoring points.

## Architecture

- Reuses `get_financial_health_inputs` and the existing shared Wealth Engine inputs.
- Stores only setup acknowledgements in authenticated user metadata.
- Does not create a parallel financial data source.
