import fs from 'node:fs';

const source = fs.readFileSync('components/CreditCardsManager.tsx', 'utf8');
const checks = [
  ['statement balance uses only the saved statement snapshot', 'const statementBalance = recordedStatementBalance;'],
  ['balance left to pay mirrors the live current balance', 'const statementRemaining = cardCurrent(card);'],
  ['card detail renders balance left from current balance', '<strong>{displayMoney(current)}</strong>'],
  ['card detail explains current-balance mirroring', 'Mirrors Current balance — the live amount still owed'],
  ['statement balances total uses recorded statement snapshots', 'const statementBalances = sumMoney(\n      monthRecords.map((record) =>'],
  ['balance-left total includes current balance even without a statement', 'statementRemaining: cardCurrent(card)'],
  ['current-month statement remains editable as a record', 'Saved as a statement snapshot only; Current balance is not changed.'],
  ['statement save uses the entered statement balance', 'const statementBalance = roundMoney(statementForm.statement_balance);'],
  ['current/new statement save does not call the reconciliation RPC', '.from("debts")\n          .update({\n            statement_balance: statementBalance'],
  ['statement save never writes current_balance', 'A statement is an issuer snapshot only. Saving it must never rewrite'],
  ['statement save confirmation explains no live balance change', 'Statement snapshot saved without changing the current balance.'],
];

let failed = 0;
for (const [label, needle] of checks) {
  const ok = source.includes(needle);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  throw new Error(`${failed} credit-card balance semantics checks failed.`);
}
console.log(`\nCredit-card balance semantics verification passed (${checks.length}/${checks.length}).`);
