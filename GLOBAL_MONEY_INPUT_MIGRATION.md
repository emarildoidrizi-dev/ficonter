# Global MoneyInput migration rules

Replace every user-editable monetary `<input>` with the shared `MoneyInput`.

## Imports

```tsx
import { MoneyInput } from "@/components/MoneyInput";
import { parseMoneyInput, roundMoney } from "@/lib/finance/money";
```

## Controlled field

Before:

```tsx
<input
  type="number"
  step="0.01"
  min="0"
  value={amount}
  onChange={(event) => setAmount(event.target.value)}
/>
```

After:

```tsx
<MoneyInput
  value={amount}
  onValueChange={setAmount}
  placeholder="0.00"
/>
```

## Uncontrolled / FormData field

Before:

```tsx
<input name="amount" type="number" step="0.01" />
```

After:

```tsx
<MoneyInput name="amount" />
```

Then parse on save:

```tsx
const amount = parseMoneyInput(new FormData(form).get("amount"));
if (!Number.isFinite(amount) || amount < 0) {
  // show validation error
}
const savedAmount = roundMoney(amount);
```

## Global rule

For money-entry fields, remove:
- `type="number"`
- `step="0.01"`
- `min="0.01"` / `min="0"` as browser validation

Validate monetary ranges in application code after `parseMoneyInput()`.

Keep native number inputs only for genuinely integer/non-money fields:
- quantity
- day of month
- year
- percentage when integer-only
- counts

## Scope to migrate

Personal:
- Transactions / Quick Add / guided transaction entry
- Monthly Planner: start balance, monthly budget, item amounts
- Bills
- Credit Cards
- Debt
- Savings
- Goals
- Net Worth manual assets/liabilities
- Cash-flow manual adjustments
- any onboarding income/balance field

Business:
- Transactions
- Sales
- Expenses / Cost Control
- Inventory prices/costs
- Supplier monetary amounts
- Business planner/budgets
- reports filters with editable money thresholds

Settings / shared:
- any financial preference that accepts an amount
- recurring transaction templates
- import correction/edit screens

Do not migrate date/time/count/quantity fields.
