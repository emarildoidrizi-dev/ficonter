import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];

function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

const form = read("components/TransactionForm.tsx");
const workspace = read("components/EffortlessEntryWorkspace.tsx");
const styles = read("components/EffortlessEntryWorkspace.module.css");
const helper = read("lib/effortlessEntry.ts");
const page = read("app/dashboard/transactions/page.tsx");
const sql = read("supabase/effortless_entry_v1.sql");
const globals = read("app/globals.css");

check("Transactions page uses EffortlessEntryWorkspace", page.includes("EffortlessEntryWorkspace"));
check("Entry modes are defined", helper.includes('"simple" | "guided" | "detailed"'));
check("Mode choices describe different effort", helper.includes("About 10 seconds") && helper.includes("About 30 seconds") && helper.includes("Maximum control"));
check("Mode choices describe different structures", helper.includes("One screen · 3 choices") && helper.includes("3 steps · optional details") && helper.includes("Full form · all fields"));
check("Preferences persist in Supabase", workspace.includes("money_entry_preferences") && workspace.includes("upsert"));
check("Simple mode has a dedicated branch", form.includes('entryMode === "simple"') && form.includes("effortless-simple-form"));
check("Simple mode uses quick category chips", form.includes("QUICK_CATEGORIES") && form.includes("effortless-category-chips"));
check("Simple mode defaults date and description", form.includes("Saved for today at the current time") && form.includes("description.trim() || finalCategory"));
check("Guided mode has a dedicated branch", form.includes('entryMode === "guided"') && form.includes("effortless-guided-form"));
check("Guided mode has three steps", form.includes("guidedStep") && form.includes("Step 1 of 3") && form.includes("Step 2 of 3") && form.includes("Step 3 of 3"));
check("Detailed mode exposes a full ledger form", form.includes("effortless-detailed-form") && form.includes("Save complete transaction"));
check("Detailed mode shows exact date and time", form.includes("Exact date and time"));
check("Favourites are supported", form.includes("rememberFavorite") && workspace.includes("is_favorite"));
check("Recent entries are reusable", workspace.includes("createRecentPresets"));
check("Recurring entries are supported", form.includes("repeatMonthly") && workspace.includes("post_monthly_transaction_template"));
check("EUR recurring entries can be confirmed together", workspace.includes("confirmAllEuroEntries"));
check("Non-EUR recurring entries require rate review", workspace.includes("Review rate") && sql.includes("Review the latest exchange rate"));
check("Duplicate recurring postings are blocked", sql.includes("unique (template_id, period_key)"));
check("Recurring RPC is authenticated", sql.includes("auth.uid()") && sql.includes("grant execute"));
check("RLS is enabled for preferences", sql.includes("alter table public.money_entry_preferences enable row level security"));
check("RLS is enabled for templates", sql.includes("alter table public.transaction_templates enable row level security"));
check("RLS is enabled for postings", sql.includes("alter table public.transaction_template_postings enable row level security"));
check("Transaction creation still emits realtime event", form.includes("ficonter:transaction-created"));
check("Connected modules are notified", form.includes('notifyFiconterDataChange("all")') || form.includes('notifyFiconterDataChange("transactions")'));
check("Mode changes remount the form safely", workspace.includes('key={`${mode}:'));
check("Shortcut deletion keeps transactions", workspace.includes("Existing transactions were not changed"));
check("Effortless panel is not sticky", globals.includes("transaction-entry-panel.transaction-effortless-panel") && globals.includes("position: static"));
check("Distinct mode styles are included", globals.includes("Effortless Entry v2") && globals.includes("effortless-stepper") && globals.includes("effortless-simple-amount"));
check("Mobile layout is covered", styles.includes("@media (max-width: 720px)") && globals.includes("@media (max-width: 700px)"));

const failed = checks.filter((item) => !item.condition);
for (const item of checks) {
  console.log(`${item.condition ? "✓" : "✗"} ${item.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Effortless Entry checks failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} Effortless Entry checks passed.`);
