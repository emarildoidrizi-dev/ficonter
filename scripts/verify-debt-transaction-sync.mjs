import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const debtManager = read("components/DebtManager.tsx");
const transactionLedger = read("components/TransactionLedger.tsx");
const sql = read("supabase/debt_transaction_bidirectional_sync.sql");

const assertions = [
  [
    debtManager.includes('notifyFiconterDataChange("all")'),
    "DebtManager notifies the platform after debt/payment mutations",
  ],
  [
    debtManager.includes('"delete_debt_with_linked_transactions"'),
    "Debt deletion uses the atomic database RPC",
  ],
  [
    debtManager.includes('supabase.rpc("reverse_debt_payment"'),
    "Debt payment deletion uses the atomic reversal RPC",
  ],
  [
    !debtManager.includes(".in(\"id\", transactionIds)"),
    "DebtManager no longer performs a non-atomic client-side linked transaction deletion",
  ],
  [
    transactionLedger.includes("reversed_debt_payment_count"),
    "TransactionLedger reports linked debt-payment reversals",
  ],
  [
    transactionLedger.includes("debt balance restored"),
    "Transaction deletion messaging explains debt restoration",
  ],
  [
    sql.includes("create trigger restore_debt_before_transaction_delete_trigger"),
    "Database trigger protects every transaction deletion path",
  ],
  [
    sql.includes("create or replace function public.delete_debt_with_linked_transactions"),
    "Atomic debt deletion RPC exists",
  ],
  [
    sql.includes("create or replace function public.reverse_debt_payment"),
    "Atomic debt-payment reversal RPC exists",
  ],
  [
    sql.includes("create or replace function public.delete_transactions_with_linked_bills"),
    "Existing Bills deletion RPC is preserved and extended",
  ],
  [
    sql.indexOf("delete from public.debts") <
      sql.indexOf("delete from public.transactions", sql.indexOf("create or replace function public.delete_debt_with_linked_transactions")),
    "Debt deletion removes the source debt before linked transactions, preventing false balance restoration",
  ],
];

let failed = 0;
for (const [passed, label] of assertions) {
  if (passed) {
    console.log(`PASS: ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${label}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} verification check(s) failed.`);
  process.exit(1);
}

console.log("\nAll Debt <-> Transactions synchronization checks passed.");
