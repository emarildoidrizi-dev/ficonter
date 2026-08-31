import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "docs/operations/backup-recovery.md",
  ".github/workflows/backup-recovery-readiness.yml",
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}

const doc = existsSync(requiredFiles[0]) ? readFileSync(requiredFiles[0], "utf8") : "";
const workflow = existsSync(requiredFiles[1]) ? readFileSync(requiredFiles[1], "utf8") : "";

const checks = [
  [doc.includes("Storage is independent from database backups"), "documents database/storage separation"],
  [doc.includes("supabase db dump"), "uses supported Supabase logical dump workflow"],
  [doc.includes("Never upload backups to GitHub Actions artifacts"), "forbids GitHub artifact storage of customer backups"],
  [doc.includes("one isolated database restore drill succeeds"), "requires database restore validation"],
  [doc.includes("one isolated Storage restore drill succeeds"), "requires Storage restore validation"],
  [workflow.includes("workflow_dispatch"), "backup readiness workflow can run manually"],
  [workflow.includes("schedule:"), "backup readiness workflow runs on schedule"],
  [workflow.includes("verify-backup-recovery-readiness.mjs"), "workflow executes readiness verifier"],
  [!workflow.includes("actions/upload-artifact"), "workflow does not upload sensitive backups to GitHub artifacts"],
  [!workflow.includes("SUPABASE_DB_URL:"), "workflow does not expose database URL in source"],
];

for (const [ok, label] of checks) {
  if (ok) console.log(`PASS  ${label}`);
  else {
    console.error(`FAIL  ${label}`);
    failures.push(label);
  }
}

if (failures.length) {
  console.error(`Backup/recovery readiness verification failed (${failures.length} issue(s)).`);
  process.exit(1);
}

console.log(`Backup/recovery readiness verification passed (${checks.length} checks).`);
