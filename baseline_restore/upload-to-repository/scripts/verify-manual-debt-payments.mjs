import { readFile } from "node:fs/promises";

const failures = [];

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const manager = await source("components/DebtManager.tsx");
const styles = await source("components/DebtManager.module.css");
const sql = await source("supabase/manual_debt_payment_confirmation.sql");

check(
  manager.includes('"record_debt_payment_atomic"'),
  "Debt payments use the existing atomic payment RPC.",
);
check(
  manager.includes("Record payment"),
  "Each debt card exposes a Record payment command.",
);
check(
  manager.includes("Manual payment confirmation"),
  "Debt setup explains manual payment confirmation.",
);
check(
  manager.includes("Payment history"),
  "Debt cards use neutral payment-history wording.",
);
check(
  !manager.includes("Automatic payment history"),
  "The old automatic payment-history wording is removed.",
);
check(
  !manager.includes("FICONTER automatically records the minimum"),
  "The UI no longer claims that minimum payments are recorded automatically.",
);
check(
  manager.includes("autopay: false") &&
    manager.includes("autopay_enabled_at: null"),
  "Debt saves keep automatic payment recording disabled.",
);
check(
  manager.includes("Payment due") &&
    manager.includes("confirmation required"),
  "The monthly due status remains visible until payment confirmation.",
);
check(
  styles.includes(".paymentButton") &&
    styles.includes(".manualPolicyTitle"),
  "Manual payment controls have responsive styling.",
);
check(
  sql.includes("enforce_manual_debt_payment_confirmation"),
  "Supabase enforces manual payment confirmation.",
);
check(
  sql.includes("autopay = false") &&
    sql.includes("autopay_enabled_at = null"),
  "Existing non-credit-card debt automation is disabled.",
);
check(
  sql.includes("where lower(coalesce(category, '')) <> 'credit card'"),
  "Credit-card liabilities remain outside the debt automation migration.",
);

if (failures.length) {
  console.error("Manual debt-payment verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Manual debt-payment confirmation verified successfully.");
