import fs from "node:fs";

const provider =
  fs.readFileSync(
    "components/VaultProvider.tsx",
    "utf8",
  );

const session =
  fs.readFileSync(
    "lib/e2ee/browserVaultSession.ts",
    "utf8",
  );

for (const token of [
  "restoreVaultKeyForBrowserSession",
  "rememberVaultKeyForBrowserSession",
  "forgetVaultBrowserSession",
  "setActiveVaultKey(restoredKey)",
]) {
  if (!provider.includes(token)) {
    throw new Error(
      `VaultProvider missing required token: ${token}`,
    );
  }
}

for (const token of [
  'const SESSION_MARKER = "ficonter:vault-session:v1"',
  "window.sessionStorage",
  "indexedDB.open",
  "vaultKey.extractable",
  "crypto.randomUUID()",
]) {
  if (!session.includes(token)) {
    throw new Error(
      `browserVaultSession missing required token: ${token}`,
    );
  }
}

for (const forbidden of [
  ".from(",
  "supabase",
  "localStorage",
  "exportKey(",
  "wrapped_vault_key",
  "recoveryCode",
]) {
  if (session.includes(forbidden)) {
    throw new Error(
      `browserVaultSession contains forbidden token: ${forbidden}`,
    );
  }
}

console.log(
  "FICONTER E2EE VAULT SESSION PERSISTENCE VERIFICATION PASSED.",
);
