import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function requireText(file, values) {
  const source = read(file);
  for (const value of values) {
    if (!source.includes(value)) {
      throw new Error(`${file} is missing: ${value}`);
    }
  }
  return source;
}

const auth = requireText("components/AuthForm.tsx", [
  'name="baseCurrency"',
  "ficonter_base_currency",
  "ficonter_preferences",
  "CURRENCY_CODES",
]);

const settings = requireText("components/SettingsWorkspace.tsx", [
  "Base currency",
  "Save base currency",
  '.from("profiles")',
  ".update({ base_currency: normalized })",
  "Original amounts stay unchanged",
]);

const dashboard = requireText("app/dashboard/layout.tsx", [
  "<BaseCurrencyBootstrap",
  'workspace="personal"',
  '.select("base_currency")',
]);

const business = requireText("app/business/layout.tsx", [
  "<BaseCurrencyBootstrap",
  'workspace="business"',
  "business?.base_currency",
]);

const transactionForm = requireText("components/TransactionForm.tsx", [
  "readBrowserBaseCurrency",
  "BASE_CURRENCY_CHANGED_EVENT",
]);

const migration = requireText("supabase/global_currency_engine_phase2.sql", [
  "ficonter_apply_signup_base_currency",
  "zz_ficonter_apply_signup_base_currency",
  "ficonter_base_currency",
]);

for (const forbidden of [
  "update public.transactions",
  "delete from public.transactions",
  "alter table public.transactions",
]) {
  if (migration.toLowerCase().includes(forbidden)) {
    throw new Error(
      `Phase 2 must not mutate existing transactions: found ${forbidden}`,
    );
  }
}

const financialBlock = settings.slice(
  settings.indexOf('{active === "financial"'),
  settings.indexOf('{active === "notifications"'),
);

if (!financialBlock.includes("<form className={styles.form} onSubmit={saveBaseCurrency}>")) {
  throw new Error("Base currency form is not present in Financial preferences.");
}
if (
  financialBlock.indexOf("saveBaseCurrency") >
  financialBlock.indexOf("canUseFinancialPreferences ?")
) {
  throw new Error(
    "Base currency must remain available before the paid Financial Preferences gate.",
  );
}

console.log("Currency Engine Phase 2 verification passed.");
console.log("- Registration currency selector present");
console.log("- All ISO currency options sourced from CURRENCY_CODES");
console.log("- Personal base currency is available to Free and paid accounts");
console.log("- Personal and Business workspace currency bootstrap present");
console.log("- New personal transactions default to the active base currency");
console.log("- Existing transactions are not mutated by Phase 2 SQL");
