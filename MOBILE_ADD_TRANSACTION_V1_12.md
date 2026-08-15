# Mobile Add Transaction V1.12

The center `+` button has one permanent responsibility: **Add Transaction**.

## Locked behavior
- Tapping `+` navigates directly to the transaction-entry screen.
- The amount field is focused for immediate entry.
- No generic quick-action menu is opened.
- No other module or action is attached to the center `+`.
- Tapping `+` again while already on the dedicated Add Transaction target does not replay navigation or animation.
- The same rule is applied to Personal and Business mobile workspaces.

## Route contract
- Personal: `/dashboard/transactions?add=1`
- Business: `/business/transactions?add=1`
