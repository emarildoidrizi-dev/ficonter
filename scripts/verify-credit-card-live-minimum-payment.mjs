import fs from 'node:fs';

const manager = fs.readFileSync('components/CreditCardsManager.tsx', 'utf8');
const reconciliation = fs.readFileSync('lib/finance/baseCurrencyReconciliation.ts', 'utf8');
const debtManager = fs.readFileSync('components/DebtManager.tsx', 'utf8');

const checks = [
  ['current month derives live minimum from current balance', 'const liveMinimumPayment = automaticMinimumPayment(cardCurrent(card));'],
  ['current month chooses live minimum', 'const minimumPayment = isCurrentMonth\n      ? liveMinimumPayment'],
  ['current month does not subtract payments twice', 'const minimumRemaining = isCurrentMonth\n      ? minimumPayment'],
  ['monthly summary uses live current balance minimum', 'minimumRemaining: automaticMinimumPayment(cardCurrent(card))'],
  ['statement modal uses current balance for current month', 'selectedMonth === monthKey() ? cardCurrent(card) : statementBalance'],
  ['UI explicitly says minimum follows current balance', 'Automatic 3% of Current balance · updates live'],
  ['cross-module reconciliation calculates credit-card min live', 'return roundMoney(debtCurrentAmount(debt, context) * 0.03);'],
  ['Debt bridge calculates credit-card min live', 'return roundMoney(currentDebtValue(debt) * 0.03);'],
  ['statement balance stays historical once recorded', 'const statementBalance = record\n      ? recordedStatementBalance\n      : carriedForwardBalance;'],
  ['balance left remains live', 'const statementRemaining = cardCurrent(card);'],
];

let passed = 0;
for (const [name, needle] of checks) {
  const haystack = name.includes('cross-module') ? reconciliation : name.includes('Debt bridge') ? debtManager : manager;
  if (!haystack.includes(needle)) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
    passed++;
  }
}

console.log(`${passed}/${checks.length} credit-card live minimum checks passed.`);
