import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const scripts = readdirSync(here)
  .filter((name) => name.startsWith("verify-") && name.endsWith(".mjs"))
  .filter((name) => name !== "verify-release-candidate.mjs")
  .sort();

const failures = [];
for (const script of scripts) {
  const relative = path.join("scripts", script);
  process.stdout.write(`\n===== ${relative} =====\n`);
  const result = spawnSync(process.execPath, [relative], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TERM: "dumb" },
  });
  if (result.status !== 0) failures.push(relative);
}

if (failures.length) {
  console.error(`\nRelease Candidate verification failed: ${failures.join(", ")}`);
  process.exit(1);
}

console.log(`\nFICONTER Release Candidate verification passed (${scripts.length} suites).`);
