import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

const client = fs.readFileSync(
  path.join(repo, "lib", "supabase", "client.ts"),
  "utf8",
);

for (const token of [
  "BILL_PRIVATE_FIELDS",
  "sanitizeEncryptedBillWrite",
  'relation !== "bills"',
  "sanitized[field] = null",
  'property === "insert"',
  'property === "update"',
  'property === "upsert"',
]) {
  if (!client.includes(token)) {
    throw new Error(`Bills browser ciphertext boundary missing token: ${token}`);
  }
}

const migrationHelper = fs.readFileSync(
  path.join(repo, "lib", "e2ee", "billMigration.ts"),
  "utf8",
);

for (const token of [
  "encrypted_payload: encryptedPayload",
  "encryption_version: 1",
  "name: null",
  "amount: null",
  "currency: null",
  "notes: null",
]) {
  if (!migrationHelper.includes(token)) {
    throw new Error(`Bill migration does not scrub plaintext: ${token}`);
  }
}

const finalizer = fs.readFileSync(
  path.join(repo, "lib", "e2ee", "pendingBillTransactionFinalizer.ts"),
  "utf8",
);

for (const token of [
  "finalizePendingEncryptedBillTransactions",
  "decryptBillPayload(",
  "encryptTransactionPayload(",
  '.eq("source_type", "bill")',
  "encryption_version: 1",
  "TRANSACTION_PLAINTEXT_CLEAR",
]) {
  if (!finalizer.includes(token)) {
    throw new Error(`Encrypted Bill transaction finalizer missing token: ${token}`);
  }
}

const provider = fs.readFileSync(
  path.join(repo, "components", "EncryptedTransactionProvider.tsx"),
  "utf8",
);

const billFinalizerIndex = provider.indexOf(
  "await finalizePendingEncryptedBillTransactions(",
);
const legacyFinalizerIndex = provider.indexOf(
  "await finalizePendingServerTransactions(",
);

if (billFinalizerIndex < 0 || legacyFinalizerIndex < 0) {
  throw new Error("Encrypted Transaction provider is missing a pending finalizer.");
}
if (billFinalizerIndex > legacyFinalizerIndex) {
  throw new Error(
    "Encrypted Bill transaction finalization must run before legacy source reconstruction.",
  );
}

const migration = fs.readFileSync(
  path.join(
    repo,
    "supabase",
    "migrations",
    "20260821231500_enforce_bills_ciphertext_only.sql",
  ),
  "utf8",
);

for (const token of [
  "bills_e2ee_ciphertext_only_check",
  "ficonter_bills_e2ee_write_guard",
  "automatic_payment_runs_bill_ciphertext_privacy_check",
  "process_automatic_encrypted_bills",
  "insert into public.transactions (\n    user_id,\n    encryption_version",
  "amount = null",
  "currency = null",
  "amount_eur = null",
  "ficonter-e2ee-bills",
]) {
  if (!migration.includes(token)) {
    throw new Error(`Bills ciphertext-only migration missing token: ${token}`);
  }
}

for (const forbidden of [
  "v_bill.amount,",
  "v_bill.currency,",
  "v_bill.amount_eur,",
  "v_bill.category,",
  "v_bill.name ||",
]) {
  const privateCoreStart = migration.indexOf(
    "create or replace function public.ficonter_record_bill_occurrence",
  );
  const privateCoreEnd = migration.indexOf(
    "create or replace function public.mark_bill_paid",
  );
  const core = migration.slice(privateCoreStart, privateCoreEnd);
  if (core.includes(forbidden)) {
    throw new Error(
      `Server Bill occurrence function still reads private plaintext: ${forbidden}`,
    );
  }
}

console.log("FICONTER BILLS CIPHERTEXT-ONLY VERIFICATION PASSED.");
