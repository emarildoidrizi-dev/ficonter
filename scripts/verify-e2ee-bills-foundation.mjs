import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.cwd();

const helper = fs.readFileSync(
  path.join(repo, "lib", "e2ee", "billPayload.ts"),
  "utf8",
);

for (const token of [
  "VaultCiphertextEnvelopeV1",
  "encryptVaultPayload(",
  "decryptVaultPayload(",
  '"bill"',
  "encrypted_payload",
  "encryption_version",
]) {
  if (!helper.includes(token)) {
    throw new Error(`Bill E2EE helper missing required token: ${token}`);
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
const billId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const created = await createNewVault(userA);
assert.equal(created.vaultKey.extractable, false);

const expected = {
  name: "Electricity",
  company: "Example Energy",
  category: "Electricity",
  amount: 81.25,
  currency: "EUR",
  amount_eur: 81.25,
  exchange_rate_to_eur: 1,
  payment_method: "Direct debit",
  notes: "Private test note",
};

const encrypted = await encryptVaultPayload(
  created.vaultKey,
  userA,
  "bill",
  billId,
  expected,
);

const serialized = JSON.stringify(encrypted);

for (const plaintext of [
  "Electricity",
  "Example Energy",
  "81.25",
  "Direct debit",
  "Private test note",
]) {
  assert.equal(
    serialized.includes(plaintext),
    false,
    `Ciphertext leaked Bill plaintext: ${plaintext}`,
  );
}

assert.deepEqual(
  await decryptVaultPayload(
    created.vaultKey,
    userA,
    "bill",
    billId,
    encrypted,
  ),
  expected,
);

await assert.rejects(() =>
  decryptVaultPayload(
    created.vaultKey,
    userB,
    "bill",
    billId,
    encrypted,
  ),
);

await assert.rejects(() =>
  decryptVaultPayload(
    created.vaultKey,
    userA,
    "bill",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    encrypted,
  ),
);

console.log(
  "FICONTER BILLS E2EE FOUNDATION V3 VERIFICATION PASSED.",
);
