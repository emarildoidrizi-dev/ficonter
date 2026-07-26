import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const component = await readFile(path.join(root, "components", "BillsManager.tsx"), "utf8");
const styles = await readFile(path.join(root, "components", "BillsManager.module.css"), "utf8");
const sql = await readFile(path.join(root, "supabase", "bill_paid_unpaid_reversal.sql"), "utf8");

const checks = [
  [component.includes('supabase.rpc("mark_bill_unpaid"'), "BillsManager calls the atomic mark_bill_unpaid RPC"],
  [component.includes('notifyFiconterDataChange("all")'), "All FICONTER financial modules receive a live refresh signal"],
  [component.includes("Mark unpaid"), "Paid Bill cards expose Mark unpaid"],
  [component.includes("RotateCcw"), "The reversal action has a clear icon"],
  [styles.includes(".unpaidButton"), "The unpaid action has a distinct visual treatment"],
  [sql.includes("status = 'pending'"), "The Bill returns to pending state"],
  [sql.includes("paid_at = null"), "The paid timestamp is cleared"],
  [sql.includes("transaction_id = null"), "The generated transaction link is cleared"],
  [sql.includes("delete from public.transactions"), "The linked generated transaction is removed"],
  [sql.includes("user_id = v_user_id"), "The RPC is scoped to the authenticated customer"],
];

let failed = false;
for (const [passed, label] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed = true;
}

if (failed) process.exit(1);
console.log("\nBill paid/unpaid synchronization verification passed.");
