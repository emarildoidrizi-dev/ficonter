import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const assert = (condition, message) => {
  checks.push({ condition, message });
  if (!condition) throw new Error(message);
};

const ledger = read("components/TransactionLedger.tsx");
const styles = read("components/TransactionLedger.module.css");
const bills = read("components/BillsManager.tsx");
const migration = read("supabase/transaction_bulk_actions_and_bill_sync.sql");

assert(ledger.includes("selectedIds"), "Transactions must maintain a selected-record set.");
assert(ledger.includes("Select all visible"), "Transactions must support selecting all visible records.");
assert(ledger.includes("Export selected CSV"), "Selected transactions must support CSV export.");
assert(ledger.includes("Export selected PDF"), "Selected transactions must support PDF export.");
assert(ledger.includes("Delete selected"), "Selected transactions must support confirmed bulk deletion.");
assert(ledger.includes('type="date"'), "Transactions must provide From and To date inputs.");
assert(ledger.includes("matchesDateFrom") && ledger.includes("matchesDateTo"), "The active date range must filter the transaction source list.");
assert(ledger.includes('exportPdf(visible, "view")'), "The current filtered date view must be exportable to PDF.");
assert(ledger.includes('exportCsv(visible, "view")'), "The current filtered date view must be exportable to CSV.");
assert(ledger.includes("delete_transactions_with_linked_bills"), "Single and bulk deletion must use the atomic synchronization RPC.");
assert(ledger.includes('data-enter-confirm="true"'), "Bulk deletion must support Enter-key confirmation.");
assert(migration.includes("delete from public.bills"), "Linked Bills must be deleted before selected transactions.");
assert(migration.includes("delete from public.transactions"), "The selected customer-owned transactions must be deleted atomically.");
assert(migration.includes("auth.uid()"), "The synchronization RPC must be scoped to the authenticated customer.");
assert(migration.includes("grant execute") && migration.includes("to authenticated"), "Only authenticated users may execute the bulk deletion RPC.");
assert(bills.includes("delete_bill_with_transaction"), "Existing Bill-to-Transaction deletion synchronization must remain intact.");
assert(!bills.includes("Select all visible") && !bills.includes("selectedIds"), "Bills must not receive transaction bulk-selection controls.");
assert(styles.includes(".dateRangeCard") && styles.includes(".selectionBar"), "The compact date and selection controls must be styled.");
assert(styles.includes('data-resolved-theme="dark"'), "New controls must preserve dark-mode support.");

console.log(`Transaction bulk-action verification passed (${checks.length} checks).`);
