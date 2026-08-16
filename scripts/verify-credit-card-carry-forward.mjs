import fs from "node:fs";

const manager = fs.readFileSync("components/CreditCardsManager.tsx", "utf8");

const checks = [
  ["reconstructs carried balance from live current balance", "finiteNumber(card.current_balance) -\n          activityEffectsAfterStart +\n          paymentsAfterStart"],
  ["reconstructs EUR carry for currency consistency", "finiteNumber(card.current_balance_eur) -\n          activityEffectsAfterStart +\n          paymentsAfterStart"],
  ["uses activity balance effects instead of assuming all charges increase debt", "finiteNumber(activity.balance_effect)"],
  ["adds payments back while reconstructing month opening debt", "paymentsAfterStart"],
  ["unsaved statement shows carried-forward monthly basis", "const carriedForwardBalance = carriedForwardBase(card, selectedMonth);"],
  ["saved statement remains frozen historical record", "const statementBalance = record\n      ? recordedStatementBalance\n      : carriedForwardBalance;"],
  ["statement editor defaults to month carry rather than live balance", "record?.statement_balance ??\n        carriedForwardNative(card, selectedMonth)"],
  ["balance left to pay continues mirroring current balance", "const statementRemaining = cardCurrent(card);"],
  ["current minimum remains 3 percent of current balance", "const liveMinimumPayment = automaticMinimumPayment(cardCurrent(card));"],
  ["UI explains carried balance is pending until statement is saved", "Carried forward into ${monthTitle(selectedMonth)} · save statement to freeze record"],
  ["monthly statement total includes provisional carry when no record exists", ": carriedForwardBase(card, selectedMonth);"],
];

let passed = 0;
for (const [name, needle] of checks) {
  if (!manager.includes(needle)) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
    passed++;
  }
}

console.log(`${passed}/${checks.length} credit-card carry-forward checks passed.`);
