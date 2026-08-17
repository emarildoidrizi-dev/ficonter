# FICONTER — Global Money Input System

This package replaces the device-specific decimal workaround with one platform-wide money-input contract.

## Goal

All FICONTER monetary inputs must accept both comma and dot decimals on:
- iPhone / iPad
- Android
- Windows
- macOS
- Chrome
- Safari
- Edge
- installed PWA
- normal browser

Accepted examples:
- `2345,67`
- `2345.67`
- `2.345,67`
- `2,345.67`

All resolve to the same monetary value before storage.

## Package contents

- `components/MoneyInput.tsx`
  Shared cross-platform money input component.

- `money.ts.patch`
  Shared parser/sanitizer patch for `lib/finance/money.ts`.

- `GLOBAL_MONEY_INPUT_MIGRATION.md`
  Exact rules for replacing existing money-entry controls across FICONTER.

- `scripts/verify-global-money-inputs.mjs`
  Static regression audit for obvious remaining native numeric money fields.

## Critical implementation rule

Money entry must never rely on browser-native `type="number"` validation.

Use:
- `type="text"`
- `inputMode="decimal"`
- shared `MoneyInput`
- `parseMoneyInput()` at save boundaries
- `roundMoney()` after successful parsing

## Recommended branch

`fix/global-money-input-system`

## Suggested commit

`fix(finance): standardize decimal money input across FICONTER`

## Verification

Test at least:
1. Transaction `2345,67`
2. Transaction `2345.67`
3. Monthly Budget `2345,67`
4. Bill `19,99`
5. Debt payment `150,50`
6. Savings `0,50`
7. Credit-card amount `1.355,88`
8. Business monetary form
9. iPhone installed PWA
10. Android/browser
11. Desktop Chrome
12. Safari

The code in this ZIP is intentionally manual: it does not modify GitHub or your branch automatically.
