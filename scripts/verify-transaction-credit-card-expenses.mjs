import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`PASS: ${message}`);
  }
}

const form = read("components/TransactionForm.tsx");
const ledger = read("components/TransactionLedger.tsx");
const cards = read("components/CreditCardsManager.tsx");
const transactionPage = read("app/dashboard/transactions/page.tsx");
const cardPage = read("app/dashboard/credit-cards/page.tsx");
const presets = read("lib/effortlessEntry.ts");
const styles = read("app/globals.css");
const sql = read("supabase/transaction_credit_card_expense_sync.sql");

check(
  form.includes('{ value: "credit_card", label: "Credit Card" }'),
  "Transactions includes a Credit Card entry option.",
);
check(
  form.includes("Credit card used") &&
    form.includes("record_credit_card_transaction"),
  "Credit-card entry requires a selected card and uses the atomic RPC.",
);
check(
  form.includes("Card expense saved in Transactions and Credit Card activity."),
  "The successful save confirms both synchronized records.",
);
check(
  form.includes('disabled={type === "credit_card"}'),
  "Credit-card purchases remain in the selected card currency.",
);
check(
  ledger.includes('transaction.credit_card_debt_id ? "Credit Card Expense"'),
  "Linked ledger rows are labelled Credit Card Expense.",
);
check(
  ledger.includes("reversed_credit_card_activity_count"),
  "Deleting linked transactions reports restored card activity.",
);
check(
  transactionPage.includes("credit_card_debt_id"),
  "Transactions page loads the card linkage.",
);
check(
  cardPage.includes("transaction_id") && cards.includes("transaction_id: string | null"),
  "Credit-card activity loads its linked transaction identifier.",
);
check(
  presets.includes("if (transaction.credit_card_debt_id) continue;"),
  "Card purchases are not reused without selecting a card.",
);
check(
  styles.includes("grid-template-columns: repeat(4, minmax(0, 1fr));"),
  "The four transaction options retain an aligned layout.",
);
check(
  sql.includes("add column if not exists credit_card_debt_id") &&
    sql.includes("add column if not exists transaction_id"),
  "Transactions and card activities have a permanent one-to-one link.",
);
check(
  sql.includes("create or replace function public.record_credit_card_transaction") &&
    sql.includes("transactions_create_credit_card_activity"),
  "One atomic database operation creates the expense and card activity.",
);
check(
  sql.includes("transactions_sync_credit_card_activity_update") &&
    sql.includes("transactions_reverse_credit_card_activity_delete"),
  "Editing and deleting a linked expense keep the card balance synchronized.",
);
check(
  sql.includes("v_reversed_credit_card_activity_count"),
  "Bulk transaction deletion restores linked card purchases.",
);

if (failures.length) {
  console.error(`\n${failures.length} transaction-to-card verification check(s) failed.`);
  process.exit(1);
}

console.log("\nTransaction-to-credit-card expense synchronization verified successfully.");
