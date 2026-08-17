# FICONTER Global Money Input — Build Hotfix

This fixes the Vercel/TypeScript errors shown in the deployment log.

## What to do

Replace the existing:

`components/MoneyInput.tsx`

with the file included in this ZIP.

## Why the previous build failed

The earlier component:
- imported `sanitizeMoneyInputDraft` from `lib/finance/money.ts`, but that export was not present in the deployed branch;
- used an incompatible React event type for `onBeforeInput`.

This replacement removes both failure points.

## Cross-platform behavior

The component now uses:

```tsx
type="text"
inputMode="decimal"
```

This is the global FICONTER rule for monetary inputs.

It accepts:
- `2345,67`
- `2345.67`
- `2.345,67`
- `2,345.67`

Do not use `type="number"` for monetary values.

## Controlled example

```tsx
<MoneyInput
  value={amount}
  onValueChange={setAmount}
  placeholder="0.00"
/>
```

## FormData example

```tsx
<MoneyInput
  name="amount"
  placeholder="0.00"
/>
```

Continue using FICONTER's existing money parser when the value is saved.

## Suggested commit message

`fix(finance): repair global money input build and cross-platform entry`
