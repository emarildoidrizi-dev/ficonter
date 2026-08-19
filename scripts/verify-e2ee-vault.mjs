import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const vault = await import(
  pathToFileURL(path.join(process.cwd(),"lib","e2ee","vault.ts")).href
);

const {
  createNewVault,
  unlockVaultWithRecovery,
  encryptVaultPayload,
  decryptVaultPayload
} = vault;

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function mustReject(label, fn) {
  let failed = false;
  try { await fn(); } catch { failed = true; }
  assert.equal(failed, true, `${label} must fail closed`);
}

function tamper(value) {
  return (value[0] === "A" ? "B" : "A") + value.slice(1);
}

console.log("Running FICONTER vault security verification...");

const created = await createNewVault(userA);

assert.equal(created.vaultKey.extractable, false);
assert.equal(created.wrappedVaultKey.alg, "A256GCM");

const key = await unlockVaultWithRecovery(
  userA,
  created.recoveryCode,
  created.wrappedVaultKey
);

const payload = {
  amount: 1234.56,
  currency: "EUR",
  description: "Vault security test"
};

const encrypted = await encryptVaultPayload(
  key,
  userA,
  "bill",
  idA,
  payload
);

assert.equal(JSON.stringify(encrypted).includes("1234.56"), false);
assert.equal(
  JSON.stringify(encrypted).includes("Vault security test"),
  false
);

assert.deepEqual(
  await decryptVaultPayload(key,userA,"bill",idA,encrypted),
  payload
);

await mustReject("wrong user", () =>
  decryptVaultPayload(key,userB,"bill",idA,encrypted)
);

await mustReject("wrong domain", () =>
  decryptVaultPayload(key,userA,"debt",idA,encrypted)
);

await mustReject("wrong record", () =>
  decryptVaultPayload(
    key,
    userA,
    "bill",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    encrypted
  )
);

await mustReject("tampered IV", () =>
  decryptVaultPayload(key,userA,"bill",idA,{
    ...encrypted,
    iv: tamper(encrypted.iv)
  })
);

await mustReject("tampered ciphertext", () =>
  decryptVaultPayload(key,userA,"bill",idA,{
    ...encrypted,
    ct: tamper(encrypted.ct)
  })
);

console.log("FICONTER VAULT SECURITY VERIFICATION PASSED.");