import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const suites = [
  "verify-e2ee-vault.mjs",
  "verify-e2ee-transactions.mjs",
  "verify-e2ee-bills-foundation.mjs",
  "verify-e2ee-bills-ciphertext-only.mjs",
  "verify-e2ee-debt-foundation.mjs",
  "verify-phase1-security.mjs",
  "verify-financial-consistency.mjs",
  "verify-performance-accuracy.mjs",
  "verify-platform-performance-stability-v2.mjs",
  "verify-account-recovery.mjs",
  "verify-profile-identity.mjs",
  "verify-contact-support.mjs",
  "verify-support-conversation-deletion.mjs",
  "verify-support-selected-state.mjs",
  "verify-currency-foundation.mjs",
  "verify-currency-phase4.mjs",
  "verify-config-driven-localization.mjs",
  "verify-explicit-save-governance-v123.mjs",
  "verify-responsive-navigation-v113.mjs",
  "verify-production-resilience.mjs",
];

const failures = [];

for (const suite of suites) {
  const relative = path.join("scripts", suite);
  process.stdout.write(`\n===== ${relative} =====\n`);
  const result = spawnSync(process.execPath, [relative], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TERM: "dumb" },
  });

  if (result.status !== 0) failures.push(relative);
}

if (failures.length > 0) {
  console.error(`\nProduction core verification failed: ${failures.join(", ")}`);
  process.exit(1);
}

console.log(`\nFICONTER production core verification passed (${suites.length} current suites).`);
