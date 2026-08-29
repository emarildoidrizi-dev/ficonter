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
const encryptedWorkspace = read("components/EncryptedCreditCardsWorkspace.tsx");
const manager = read("components/CreditCardsManager.tsx");
const sidebar = read("components/Sidebar.tsx");
const debt = read("components/DebtManager.tsx");
const nativeChrome = read("components/FiconterNativeAppChrome.tsx");
const speed = read("components/NavigationSpeedBoost.tsx");
const migration = read("supabase/credit_card_management_v1.sql");
const exportSource = read("lib/accountExport.ts");
const settings = read("components/SettingsWorkspace.tsx");

check(
  page.includes("EncryptedCreditCardsWorkspace") &&
    encryptedWorkspace.includes('from("credit_card_activities")') &&
    encryptedWorkspace.includes('.eq("user_id", userId)'),
  "Credit Cards encrypted workspace loads user-scoped card activity.",
);
check(
  page.includes("EncryptedCreditCardsWorkspace") &&
    encryptedWorkspace.includes('from("debts")') &&
    encryptedWorkspace.includes('.eq("debt_kind", "credit_card")') &&
    encryptedWorkspace.includes('.eq("user_id", userId)'),
  "Credit Cards encrypted workspace reads existing user-scoped credit-card debt rows.",
);
check(manager.includes('"record_credit_card_payment"'), "Confirmed card payments use an atomic RPC.");
check(manager.includes('"record_credit_card_activity"'), "Card balance activity uses an atomic RPC.");
check(manager.includes('.from("debts")') && manager.includes("statement_balance: statementBalance") && !manager.includes('supabase.rpc("update_credit_card_statement"'), "Monthly statements save issuer snapshots without rewriting the live balance.");
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
const monthlyHistoryMigration = read("supabase/credit_card_monthly_history_v1.sql");

check(manager.includes("AUTOMATIC_MINIMUM_PAYMENT_RATE = 0.03"), "Minimum payment is calculated automatically at 3%.");
check(manager.includes("<span>Minimum payment due</span>"), "Credit-card cards use the clear Minimum payment due label.");
check(!manager.includes("<span>Minimum remaining</span>"), "The confusing Minimum remaining label has been removed.");
check(manager.includes("selectedMonth === monthKey() ? cardCurrent(card) : statementBalance"), "Current-month minimum payment derives from Current balance while historical records stay historical.");
check(manager.includes("readOnly") && manager.includes("Minimum payment due — automatic 3%"), "The statement form displays a protected automatic 3% amount.");
check(minimumMigration.includes("new.statement_balance * 0.03"), "Supabase enforces the 3% minimum-payment rule.");
check(minimumMigration.includes("credit_card_minimum_payment_3_percent"), "The 3% database trigger is included.");

check(
  encryptedWorkspace.includes('from("credit_card_monthly_records")') &&
    encryptedWorkspace.includes('.eq("user_id", userId)') &&
    encryptedWorkspace.includes("decryptCreditCardMonthlyRecordPayload"),
  "Credit Cards encrypted workspace loads and decrypts permanent monthly statement records.",
);
check(manager.includes('type="month"') && manager.includes("selectedMonth"), "Credit Cards includes a Monthly Planner-style month selector.");
check(manager.includes("Paid this month") && manager.includes("Balance left to pay") && manager.includes("Interest charged"), "Selected-month payment, remaining balance and interest metrics are visible.");
check(manager.includes("inMonth(payment.paid_at, selectedMonth)") && manager.includes("inMonth(activity.occurred_at, selectedMonth)"), "Payments and card activity are filtered into their original month.");
check(manager.includes("paymentsTowardStatement") && manager.includes("nextMonthlyRecord"), "Minimum-payment status is limited to the correct statement cycle.");
check(monthlyHistoryMigration.includes("create table if not exists public.credit_card_monthly_records"), "Supabase stores one permanent record per card and month.");
check(monthlyHistoryMigration.includes("unique (debt_id, month_start)"), "Monthly statement records cannot be duplicated.");
check(monthlyHistoryMigration.includes("sync_credit_card_monthly_record"), "Confirmed statements automatically create or update monthly history.");
check(exportSource.includes('| "credit_card_monthly_records"') && settings.includes('"credit_card_monthly_records"'), "Account export includes credit-card monthly history.");
check(manager.includes('"save_credit_card_monthly_record"') && manager.includes("historicalStatement"), "Older statement months can be backfilled without changing the live balance.");
check(monthlyHistoryMigration.includes("create or replace function public.save_credit_card_monthly_record"), "Supabase provides an owner-scoped historical statement RPC.");
check(monthlyHistoryMigration.includes("p_statement_date >= v_debt.statement_date"), "Historical statement RPC cannot overwrite the current or a future balance.");

if (failures) {
  console.error(`\n${failures} Credit Cards verification check(s) failed.`);
  process.exit(1);
}

console.log("\nCredit Cards management verification passed.");
