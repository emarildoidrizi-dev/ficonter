import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { CURRENT_RELEASE_SUITES } from "./release-suite-manifest.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const missing = CURRENT_RELEASE_SUITES.filter((name) => !existsSync(path.join(here, name)));
if (missing.length) {
  console.error(`Release manifest references missing verification suites: ${missing.join(", ")}`);
  process.exit(1);
}

const activeSet = new Set(CURRENT_RELEASE_SUITES);
const unlisted = readdirSync(here)
  .filter((name) => name.startsWith("verify-") && name.endsWith(".mjs"))
  .filter((name) => name !== "verify-release-candidate.mjs")
  .filter((name) => !activeSet.has(name))
  .sort();

if (unlisted.length) {
  console.warn(`Ignoring retired/unlisted verification scripts: ${unlisted.join(", ")}`);
}

const failures = [];
for (const script of CURRENT_RELEASE_SUITES) {
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

console.log(`\nFICONTER Release Candidate verification passed (${CURRENT_RELEASE_SUITES.length} current suites).`);
