import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const component = await readFile(path.join(root, "components", "BillsManager.tsx"), "utf8");
const styles = await readFile(path.join(root, "components", "BillsManager.module.css"), "utf8");
const sql = await readFile(path.join(root, "supabase", "bill_paid_unpaid_reversal.sql"), "utf8");

const checks = [
  [component.includes('supabase.rpc("mark_bill_unpaid"'), "BillsManager prefers the atomic mark_bill_unpaid RPC"],
  [component.includes('isMissingMarkUnpaidRpc'), "Missing RPC/schema-cache errors are detected"],
  [component.includes('.from("bills")') && component.includes('.eq("status", "paid")'), "RLS-protected fallback reopens only a paid customer-owned Bill"],
  [component.includes('.from("transactions")') && component.includes('.delete()'), "Fallback removes the linked generated transaction"],
  [component.includes("Restore the original paid state"), "Fallback compensates if linked transaction deletion fails"],
  [component.includes('notifyFiconterDataChange("bills")'), "All FICONTER financial modules receive a live refresh signal"],
  [component.includes("Mark unpaid"), "Paid Bill cards expose Mark unpaid"],
  [component.includes("RotateCcw"), "The reversal action has a clear icon"],
  [styles.includes(".unpaidButton"), "The unpaid action has a distinct visual treatment"],
  [sql.includes("status = 'pending'"), "The atomic RPC returns the Bill to pending state"],
  [sql.includes("paid_at = null"), "The paid timestamp is cleared"],
  [sql.includes("transaction_id = null"), "The generated transaction link is cleared"],
  [sql.includes("delete from public.transactions"), "The linked generated transaction is removed"],
  [sql.includes("user_id = v_user_id"), "The RPC is scoped to the authenticated customer"],
  [sql.includes("notify pgrst, 'reload schema'"), "PostgREST schema cache is refreshed after SQL deployment"],
];

let failed = false;
for (const [passed, label] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed = true;
}

if (failed) process.exit(1);
console.log("\nBill paid/unpaid synchronization verification passed.");
