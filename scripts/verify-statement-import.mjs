import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "app/dashboard/transactions/page.tsx",
  "components/StatementImportWorkspace.tsx",
  "components/StatementImportWorkspace.module.css",
  "lib/statementImport.ts",
  "supabase/statement_import_v1.sql",
];

const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

for (const file of requiredFiles) {
  check(fs.existsSync(path.join(root, file)), `${file} is missing.`);
}

const page = fs.readFileSync(path.join(root, "app/dashboard/transactions/page.tsx"), "utf8");
const component = fs.readFileSync(path.join(root, "components/StatementImportWorkspace.tsx"), "utf8");
const library = fs.readFileSync(path.join(root, "lib/statementImport.ts"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase/statement_import_v1.sql"), "utf8");

check(page.includes("StatementImportWorkspace"), "Transactions page does not render Statement Import.");
check(component.includes("Nothing is saved until you review and confirm it."), "Customer approval message is missing.");
check(component.includes("MAX_ROWS = 2000"), "Import row limit is missing.");
check(component.includes("possibleDuplicate"), "Duplicate review is missing.");
check(component.includes("statement_import_profiles"), "Saved bank formats are missing.");
check(component.includes("transaction_category_rules"), "Category memory is missing.");
check(component.includes("import_statement_transactions"), "Secure import RPC is not used.");
check(component.includes("notifyFiconterDataChange(\"transactions\")"), "Platform-wide refresh is missing.");
check(library.includes("detectDelimiter"), "Delimiter detection is missing.");
check(library.includes("parseDelimitedText"), "Quoted CSV parser is missing.");
check(library.includes("parseStatementDate"), "Date parsing is missing.");
check(library.includes("parseMoney"), "Number-format parsing is missing.");
check(library.includes("suggestCategory"), "Category suggestion logic is missing.");
check(library.includes("transactionSignature"), "Client duplicate signature is missing.");
check(sql.includes("enable row level security"), "RLS is not enabled for import tables.");
check(sql.includes("security definer"), "Secure import function is missing.");
check(sql.includes("auth.uid()"), "Import ownership validation is missing.");
check(sql.includes("digest("), "Server fingerprint protection is missing.");
check(sql.includes("grant execute on function public.import_statement_transactions"), "Authenticated RPC permission is missing.");
check(sql.includes("notify pgrst, 'reload schema'"), "Schema cache reload is missing.");

if (failures.length) {
  console.error(`Statement Import verification failed (${failures.length}/${checks}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Statement Import verification passed: ${checks} checks.`);
