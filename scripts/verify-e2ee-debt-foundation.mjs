import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.cwd();

for (const [file, requiredTokens] of [
  [
    path.join(repo, "lib", "e2ee", "debtPayload.ts"),
    [
      "VaultCiphertextEnvelopeV1",
      "encryptVaultPayload(",
      "decryptVaultPayload(",
      '"debt"',
      "encrypted_payload",
      "encryption_version",
    ],
  ],
  [
    path.join(repo, "lib", "e2ee", "debtPaymentPayload.ts"),
    [
      "VaultCiphertextEnvelopeV1",
      "encryptVaultPayload(",
      "decryptVaultPayload(",
      '"debt-payment"',
      "encrypted_payload",
      "encryption_version",
    ],
  ],
]) {
  const helper = fs.readFileSync(file, "utf8");
  for (const token of requiredTokens) {
    if (!helper.includes(token)) {
      throw new Error(`Debt E2EE helper missing required token: ${token}`);
    }
  }
}

const migration = fs.readFileSync(
  path.join(
    repo,
    "supabase",
    "migrations",
    "20260821223000_add_debt_e2ee_foundation.sql",
  ),
  "utf8",
);

for (const token of [
  "alter table public.debts",
  "alter table public.debt_payments",
  "encrypted_payload jsonb",
  "encryption_version smallint",
  "A256GCM",
  "Server must not decrypt",
]) {
  if (!migration.includes(token)) {
    throw new Error(`Debt E2EE migration missing required token: ${token}`);
  }
}

const vault = await import(
  pathToFileURL(path.join(repo, "lib", "e2ee", "vault.ts")).href
);

const {
  createNewVault,
  encryptVaultPayload,
  decryptVaultPayload,
} = vault;

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const debtId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const paymentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const created = await createNewVault(userA);
assert.equal(created.vaultKey.extractable, false);

const debt = {
  name: "Private loan",
  lender: "Example lender",
  description: "Private debt note",
  category: "Personal loan",
  original_balance: 7500,
  current_balance: 6125.4,
  currency: "EUR",
  original_balance_eur: 7500,
  current_balance_eur: 6125.4,
  exchange_rate_to_eur: 1,
  annual_interest_rate: 6.5,
  minimum_payment: 250,
  minimum_payment_eur: 250,
};

const encryptedDebt = await encryptVaultPayload(
  created.vaultKey,
  userA,
  "debt",
  debtId,
  debt,
);

const serializedDebt = JSON.stringify(encryptedDebt);
for (const plaintext of [
  "Private loan",
  "Example lender",
  "6125.4",
  "250",
]) {
  assert.equal(
    serializedDebt.includes(plaintext),
    false,
    `Ciphertext leaked Debt plaintext: ${plaintext}`,
  );
}

assert.deepEqual(
  await decryptVaultPayload(
    created.vaultKey,
    userA,
    "debt",
    debtId,
    encryptedDebt,
  ),
  debt,
);

const payment = {
  amount: 250,
  currency: "EUR",
  amount_eur: 250,
  exchange_rate_to_eur: 1,
  notes: "Private payment note",
};

const encryptedPayment = await encryptVaultPayload(
  created.vaultKey,
  userA,
  "debt-payment",
  paymentId,
  payment,
);

const serializedPayment = JSON.stringify(encryptedPayment);
for (const plaintext of ["Private payment note", "250"]) {
  assert.equal(
    serializedPayment.includes(plaintext),
    false,
    `Ciphertext leaked Debt payment plaintext: ${plaintext}`,
  );
}

assert.deepEqual(
  await decryptVaultPayload(
    created.vaultKey,
    userA,
    "debt-payment",
    paymentId,
    encryptedPayment,
  ),
  payment,
);

await assert.rejects(() =>
  decryptVaultPayload(
    created.vaultKey,
    userB,
    "debt",
    debtId,
    encryptedDebt,
  ),
);

await assert.rejects(() =>
  decryptVaultPayload(
    created.vaultKey,
    userA,
    "debt-payment",
    debtId,
    encryptedPayment,
  ),
);

console.log("FICONTER DEBT E2EE FOUNDATION V1 VERIFICATION PASSED.");
