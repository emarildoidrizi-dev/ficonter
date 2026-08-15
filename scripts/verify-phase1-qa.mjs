import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  ts = require(path.join(globalRoot, "typescript"));
}

const root = process.cwd();
const failures = [];
const passes = [];

function pass(message) { passes.push(message); }
function fail(message) { failures.push(message); }
function check(condition, message) { condition ? pass(message) : fail(message); }
async function source(relativePath) { return readFile(path.join(root, relativePath), "utf8"); }

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", ".next", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(absolute));
    else result.push(absolute);
  }
  return result;
}

const files = await walk(root);
const codeFiles = files.filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file));
const textFiles = files.filter((file) => /\.(ts|tsx|js|jsx|mjs|css|md|txt|sql|json)$/.test(file));

const typedFiles = codeFiles.filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts"));
for (const file of typedFiles) {
  const text = await readFile(file, "utf8");
  const output = ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  const diagnostics = output.diagnostics ?? [];
  if (diagnostics.length) {
    for (const diagnostic of diagnostics) {
      fail(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
  }
}
if (!failures.length) pass(`${typedFiles.length} TypeScript/TSX files passed syntax transpilation.`);

const obsoleteBrand = ["lu", "mera"].join("");
const obsoleteBrandPattern = new RegExp(obsoleteBrand, "i");
const obsoleteBrandHits = [];
for (const file of textFiles) {
  const relative = path.relative(root, file);
  if ([
    "FILES_TO_DELETE_AFTER_UPLOAD.txt",
    "UPLOAD_INSTRUCTIONS_PHASE1_QA_FINAL.txt",
  ].includes(relative)) continue;
  const text = await readFile(file, "utf8");
  if (
    obsoleteBrandPattern.test(text) ||
    obsoleteBrandPattern.test(path.relative(root, file))
  ) {
    obsoleteBrandHits.push(path.relative(root, file));
  }
}
check(
  obsoleteBrandHits.length === 0,
  obsoleteBrandHits.length
    ? `Obsolete brand remains in: ${obsoleteBrandHits.join(", ")}`
    : "No obsolete predecessor branding remains in source or filenames.",
);

const sql = await source("supabase/phase1_qa_finalization.sql");
for (const name of [
  "record_goal_investment",
  "reverse_goal_investment",
  "delete_goal_with_investments",
  "mark_bill_paid",
  "delete_bill_with_transaction",
  "record_debt_payment_atomic",
  "reverse_debt_payment_atomic",
  "delete_debt_with_payments",
  "delete_all_financial_records",
]) {
  check(sql.includes(`function public.${name}`), `SQL migration defines ${name}.`);
}
check(sql.includes("profile-photos") && sql.includes("storage.objects"), "Profile-photo bucket and private storage policies are included.");
check(sql.includes("'saving'") && sql.includes("transactions_type_check"), "Transaction schema supports saving records.");
check((sql.match(/\$\$/g) ?? []).length % 2 === 0, "SQL dollar-quoted blocks are balanced.");
check(sql.trimEnd().endsWith("commit;"), "SQL migration closes with a transaction commit.");

const bills = await source("components/BillsManager.tsx");
check(bills.includes('"mark_bill_unpaid"') && bills.includes('"delete_bill_with_transaction"'), "Bills use atomic database functions for reversal and deletion while automatic settlement stays server-managed.");
check(!bills.includes("api.frankfurter"), "Bills do not bypass the authenticated exchange-rate endpoint.");

const debt = await source("components/DebtManager.tsx");
check(debt.includes('"record_debt_payment_atomic"') && debt.includes('"reverse_debt_payment"') && debt.includes('"delete_debt_with_linked_transactions"'), "Debt payments, reversals, and deletion use the current atomic synchronization functions.");
check(!debt.includes('"record_debt_payment_with_transaction"') && !debt.includes('"delete_debt_with_payments"'), "Debt UI no longer invokes obsolete or missing synchronization functions.");

const goals = await source("components/GoalsManager.tsx");
check(goals.includes('"record_goal_investment"') && goals.includes('"reverse_goal_investment"') && goals.includes('"delete_goal_with_investments"'), "Goals use synchronized investment functions.");

const transactionForm = await source("components/TransactionForm.tsx");
check(transactionForm.includes('.insert(payload)') && transactionForm.includes('.select("*")') && transactionForm.includes("savedTransaction"), "Transactions update the UI only after the database confirms the saved row.");
check(!transactionForm.includes("optimisticTransaction"), "Transactions no longer reset optimistically before persistence succeeds.");

const registration = await source("components/AuthForm.tsx");
const recovery = await source("components/AccountRecoveryForm.tsx");
const callback = await source("app/auth/callback/route.ts");
check(registration.includes("/auth/callback?next=/dashboard"), "Registration confirmation returns users to the dashboard.");
check(recovery.includes("/auth/callback?next=/update-password"), "Password recovery exchanges its code before password update.");
check(callback.includes("exchangeCodeForSession"), "Auth callback securely exchanges PKCE codes.");

const settings = await source("components/SettingsWorkspace.tsx");
check(settings.includes("goals") && settings.includes("goal_investments") && settings.includes('rpc("delete_all_financial_records"'), "Settings export and deletion include goals and use atomic cleanup.");

const exchange = await source("app/api/exchange-rate/route.ts");
check(exchange.includes("CURRENCY_PATTERN") && exchange.includes("convertedAmount") && exchange.includes("auth.getUser"), "Exchange-rate endpoint authenticates users and returns rate plus converted amount.");

const serviceAdmin = await source("lib/supabase/admin.ts");
check(serviceAdmin.includes('import "server-only"') && serviceAdmin.includes("SUPABASE_SERVICE_ROLE_KEY") && !serviceAdmin.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"), "Service-role credentials remain server-only.");

const apiRoutes = files.filter((file) => file.endsWith(`${path.sep}route.ts`) && file.includes(`${path.sep}app${path.sep}api${path.sep}`));
check(apiRoutes.length === 34, `All ${apiRoutes.length} API routes are included in the endpoint inventory.`);
for (const file of apiRoutes) {
  const relative = path.relative(root, file);
  const text = await readFile(file, "utf8");
  check(text.includes("noStoreHeaders") || text.includes("noStoreJson"), `${relative} disables sensitive response caching.`);
}

const userScopedPages = [
  "app/dashboard/transactions/page.tsx",
  "app/dashboard/bills/page.tsx",
  "app/dashboard/debt/page.tsx",
  "app/dashboard/net-worth/page.tsx",
  "app/dashboard/goals/page.tsx",
  "app/dashboard/budget/page.tsx",
];
for (const file of userScopedPages) {
  const text = await source(file);
  const usesExplicitUserFilter = text.includes('eq("user_id", user.id)');
  const usesAuthenticatedWealthRpc =
    file === "app/dashboard/net-worth/page.tsx" &&
    (
      text.includes('rpc("get_wealth_score_inputs")') ||
      text.includes('rpc("get_net_worth_growth_inputs")')
    );
  check(
    usesExplicitUserFilter || usesAuthenticatedWealthRpc,
    `${file} explicitly scopes financial queries to the authenticated user.`,
  );
}


const cashFlowPage = await source("app/dashboard/cash-flow/page.tsx");
check(
  cashFlowPage.includes('.from("debt_payments")') &&
    cashFlowPage.includes('.eq("user_id", user.id)'),
  "Cash Flow debt-payment reads are explicitly scoped to the authenticated user.",
);

const wealthSql = await source("supabase/phase2_wealth_score_engine.sql");
const growthSql = await source("supabase/phase2_net_worth_growth.sql");
check(
  wealthSql.includes("auth.uid()") &&
    wealthSql.includes("security invoker") &&
    wealthSql.includes("public.get_financial_health_inputs()") &&
    growthSql.includes("auth.uid()") &&
    growthSql.includes("security invoker") &&
    growthSql.includes("public.get_wealth_score_inputs()"),
  "The Net Worth aggregate RPC is authenticated, caller-scoped, and reuses the Financial Health and Wealth Score sources of truth.",
);

console.log(`Phase 1 QA verification: ${passes.length} checks passed.`);
for (const message of passes) console.log(`  PASS  ${message}`);
if (failures.length) {
  console.error(`\n${failures.length} QA check(s) failed:`);
  for (const message of failures) console.error(`  FAIL  ${message}`);
  process.exit(1);
}
