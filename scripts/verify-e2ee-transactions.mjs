import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function requireText(rel, pattern, message) {
  const text = read(rel);
  if (!pattern.test(text)) errors.push(`${rel}: ${message}`);
}

function forbidText(rel, pattern, message) {
  const text = read(rel);
  if (pattern.test(text)) errors.push(`${rel}: ${message}`);
}

const directReaderFiles = [
  "app/dashboard/budget/page.tsx",
  "app/dashboard/cash-flow/page.tsx",
  "app/dashboard/overview/page.tsx",
  "components/MonthlyPlanner.tsx",
  "components/CashFlowIntelligence.tsx",
  "components/useBaseCurrencySourceData.ts",
  "components/SettingsWorkspace.tsx",
  "components/SavingsIntelligence.tsx",
  "app/api/documents/[id]/extract/route.ts",
];

for (const rel of directReaderFiles) {
  forbidText(
    rel,
    /\.from\(["']transactions["']\)\s*\n?\s*\.select\(/,
    "must not read readable transaction contents directly from Supabase",
  );
}

requireText(
  "components/EncryptedTransactionProvider.tsx",
  /migrateLegacyPlaintextTransactions[\s\S]*finalizePendingServerTransactions[\s\S]*\.eq\("encryption_version", 1\)/,
  "provider must migrate legacy rows, finalize pending rows, then read encrypted v1 rows",
);
requireText(
  "components/TransactionForm.tsx",
  /const payload = \{\s*user_id: user\.id,\s*encrypted_payload: encryptedPayload,\s*encryption_version: 1,\s*\}/,
  "new transaction insert must be ciphertext-only",
);
requireText(
  "components/TransactionLedger.tsx",
  /encryptTransactionPayload[\s\S]*\.update\(\{\s*encrypted_payload: encryptedPayload,\s*encryption_version: 1,/,
  "transaction edits must encrypt before update",
);
requireText(
  "components/SavingsIntelligence.tsx",
  /encryptTransactionPayload[\s\S]*encryption_version: 1/,
  "saving edits must encrypt before update",
);
requireText(
  "components/BillsManager.tsx",
  /Unlock your Financial Vault before editing a paid bill\.[\s\S]*encryptTransactionPayload/,
  "paid-bill linked transaction edits must require the vault and encrypt",
);
requireText(
  "components/useBaseCurrencySourceData.ts",
  /transactions: encryptedTransactions as CurrencySourceData\["transactions"\]/,
  "financial intelligence source must use decrypted provider transactions",
);
requireText(
  "components/AiInsights.tsx",
  /body: JSON\.stringify\(\{ inputs: reconciledInputs \}\)/,
  "Smart Insights must send the client-reconciled aggregate input model",
);
forbidText(
  "app/api/wealth/ai-insights/route.ts",
  /get_ai_insights_inputs/,
  "Smart Insights API must not rebuild transaction-derived inputs from server plaintext",
);
requireText(
  "supabase/migrations/20260818170500_enforce_transactions_ciphertext_only.sql",
  /transactions_e2ee_ciphertext_only_check[\s\S]*transactions_e2ee_write_guard[\s\S]*transactions_scrub_server_insert/,
  "database migration must enforce ciphertext/pending-row invariants",
);
requireText(
  "supabase/migrations/20260818170500_enforce_transactions_ciphertext_only.sql",
  /alter column currency drop default/,
  "currency default must be removed so encrypted inserts cannot leak a plaintext default",
);
requireText(
  "lib/supabase/database.types.ts",
  /transactions: \{\s*Row: \{\s*amount: number \| null/,
  "generated transaction row type must accept nullable readable fields",
);

if (errors.length) {
  console.error("FICONTER transaction E2EE verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("FICONTER transaction E2EE static verification PASSED.");
