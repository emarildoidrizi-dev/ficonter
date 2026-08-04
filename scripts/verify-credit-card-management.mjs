import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
let failures = 0;

function check(condition, message) {
  if (condition) {
    console.log(`PASS  ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${message}`);
  }
}

const page = read("app/dashboard/credit-cards/page.tsx");
const manager = read("components/CreditCardsManager.tsx");
const sidebar = read("components/Sidebar.tsx");
const debt = read("components/DebtManager.tsx");
const nativeChrome = read("components/FiconterNativeAppChrome.tsx");
const speed = read("components/NavigationSpeedBoost.tsx");
const migration = read("supabase/credit_card_management_v1.sql");
const exportSource = read("lib/accountExport.ts");
const settings = read("components/SettingsWorkspace.tsx");

check(page.includes('from("credit_card_activities")'), "Credit Cards page loads card activity.");
check(page.includes('.ilike("category", "credit card")'), "Credit Cards page reads existing credit-card debt rows.");
check(manager.includes('"record_credit_card_payment"'), "Confirmed card payments use an atomic RPC.");
check(manager.includes('"record_credit_card_activity"'), "Card balance activity uses an atomic RPC.");
check(manager.includes('"update_credit_card_statement"'), "Monthly statements reconcile the shared balance.");
check(manager.includes('notifyFiconterDataChange("all")'), "Credit-card changes notify every financial module.");
check(manager.includes('category: "Credit card"'), "New cards use the existing Debt source of truth.");
check(!manager.includes('from("credit_cards")'), "No duplicate credit-card account table is created.");
check(sidebar.includes('["/dashboard/credit-cards", CreditCard, "Credit Cards"]'), "Desktop sidebar includes Credit Cards.");
check(sidebar.includes('["/dashboard/net-worth", TrendingUp, "Net Worth"]'), "Financial progress order includes Net Worth.");
check(nativeChrome.includes('href: "/dashboard/credit-cards"'), "Installed app drawer includes Credit Cards.");
check(speed.includes('"/dashboard/credit-cards"'), "Credit Cards route is prefetched.");
check(debt.includes('debt.category !== "Credit card"'), "Generic debt automation excludes credit cards.");
check(debt.includes('href="/dashboard/credit-cards"'), "Debt page links to dedicated Credit Cards management.");
check(!debt.match(/const CATEGORIES:[\s\S]*?\[\s*"Credit card"/), "Debt creation no longer offers Credit card as a duplicate category.");
check(migration.includes("add column if not exists credit_limit"), "Migration extends the existing debt row with card details.");
check(migration.includes("create table if not exists public.credit_card_activities"), "Migration creates non-cash card activity history.");
check(migration.includes("'Credit-card payment'"), "Payments use the existing transaction engine.");
check(migration.includes("autopay = false"), "Credit cards require confirmed payments rather than assumed automatic payments.");
check(migration.includes("v_post_statement_activity"), "Statement reconciliation preserves later card activity.");
check(migration.includes("v_post_statement_payments"), "Statement reconciliation preserves later confirmed payments.");
check(migration.includes("cannot be earlier than the confirmed statement date"), "Confirmed statements cannot be silently moved backwards.");
check(migration.includes("cannot be reversed directly"), "Statement reconciliations cannot be reversed into inconsistent card data.");
check(manager.includes('activity_type !== "statement_adjustment"'), "Confirmed statement reconciliations are locked in the interface.");
check(exportSource.includes('| "credit_card_activities"'), "Account export includes credit-card activity.");
check(settings.includes('"credit_card_activities"'), "JSON/PDF account archive loads credit-card activity.");

const minimumMigration = read("supabase/credit_card_minimum_payment_3_percent.sql");

check(
  manager.includes("AUTOMATIC_MINIMUM_PAYMENT_RATE = 0.03"),
  "Minimum payment is calculated automatically at 3%."
);
check(
  manager.includes("<span>Minimum payment due</span>"),
  "Credit-card cards use the clear Minimum payment due label."
);
check(
  !manager.includes("<span>Minimum remaining</span>"),
  "The confusing Minimum remaining label has been removed."
);
check(
  manager.includes("automaticMinimumPayment(statementBalance)"),
  "Statement saving derives minimum payment from statement balance."
);
check(
  manager.includes("readOnly") &&
    manager.includes("Minimum payment due — automatic 3%"),
  "The statement form displays a protected automatic 3% amount."
);
check(
  minimumMigration.includes("new.statement_balance * 0.03"),
  "Supabase enforces the 3% minimum-payment rule."
);
check(
  minimumMigration.includes("credit_card_minimum_payment_3_percent"),
  "The 3% database trigger is included."
);

if (failures) {
  console.error(`\n${failures} Credit Cards verification check(s) failed.`);
  process.exit(1);
}

console.log("\nCredit Cards management verification passed.");
