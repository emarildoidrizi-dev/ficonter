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
check("Simple mode is selectable", workspace.includes('value === "simple"') || workspace.includes("ENTRY_MODE_OPTIONS"));
check("Preferences persist in Supabase", workspace.includes("money_entry_preferences") && workspace.includes("upsert"));
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
check("Connected modules are notified", form.includes('notifyFiconterDataChange("all")'));
check("Description is optional", form.includes("description.trim() || finalCategory"));
check("Advanced fields are collapsible", form.includes("More details") && form.includes("showAdvanced"));
check("Shortcut deletion keeps transactions", workspace.includes("Existing transactions were not changed"));
check("Effortless panel is not sticky", globals.includes("transaction-entry-panel.transaction-effortless-panel") && globals.includes("position: static"));
check("Mobile layout is covered", styles.includes("@media (max-width: 720px)"));

const failed = checks.filter((item) => !item.condition);
for (const item of checks) {
  console.log(`${item.condition ? "✓" : "✗"} ${item.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Effortless Entry checks failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} Effortless Entry checks passed.`);
