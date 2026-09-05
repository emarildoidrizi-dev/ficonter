import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "docs/operations/backup-recovery.md",
  ".github/workflows/backup-recovery-readiness.yml",
  ".github/workflows/secure-production-backup.yml",
  "scripts/run-secure-backup.sh",
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}

const doc = existsSync(requiredFiles[0]) ? readFileSync(requiredFiles[0], "utf8") : "";
const readinessWorkflow = existsSync(requiredFiles[1]) ? readFileSync(requiredFiles[1], "utf8") : "";
const backupWorkflow = existsSync(requiredFiles[2]) ? readFileSync(requiredFiles[2], "utf8") : "";
const runner = existsSync(requiredFiles[3]) ? readFileSync(requiredFiles[3], "utf8") : "";

const requiredBackupSecrets = [
  "SUPABASE_DB_URL",
  "SUPABASE_STORAGE_S3_ENDPOINT",
  "SUPABASE_STORAGE_S3_REGION",
  "SUPABASE_STORAGE_S3_ACCESS_KEY_ID",
  "SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY",
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_REGION",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
];

const checks = [
  [doc.includes("Storage is independent from database backups"), "documents database/storage separation"],
  [doc.includes("supabase db dump"), "uses supported Supabase logical dump workflow"],
  [doc.includes("Never upload backups to GitHub Actions artifacts"), "forbids GitHub artifact storage of customer backups"],
  [doc.includes("one isolated database restore drill succeeds"), "requires database restore validation"],
  [doc.includes("one isolated Storage restore drill succeeds"), "requires Storage restore validation"],
  [readinessWorkflow.includes("workflow_dispatch"), "backup readiness workflow can run manually"],
  [readinessWorkflow.includes("schedule:"), "backup readiness workflow runs on schedule"],
  [readinessWorkflow.includes("verify-backup-recovery-readiness.mjs"), "readiness workflow executes verifier"],
  [!readinessWorkflow.includes("actions/upload-artifact"), "readiness workflow does not upload sensitive backups to GitHub artifacts"],
  [backupWorkflow.includes("workflow_dispatch"), "production backup workflow can run manually"],
  [backupWorkflow.includes("schedule:"), "production backup workflow runs daily"],
  [backupWorkflow.includes("scripts/run-secure-backup.sh"), "production workflow executes secure backup runner"],
  [backupWorkflow.includes("supabase/setup-cli"), "production workflow installs Supabase CLI"],
  [backupWorkflow.includes("rclone"), "production workflow installs rclone"],
  [backupWorkflow.includes("cancel-in-progress: false"), "production backup runs cannot cancel each other"],
  [!backupWorkflow.includes("actions/upload-artifact"), "production workflow never uploads backup data to GitHub artifacts"],
  [runner.includes("set -euo pipefail"), "backup runner fails closed"],
  [runner.includes("supabase db dump"), "backup runner exports database with Supabase CLI"],
  [runner.includes("rclone copy \"supabase:${bucket}\""), "backup runner copies every discovered Storage bucket"],
  [runner.includes("rclone check"), "backup runner verifies copied Storage objects"],
  [runner.includes("sha256sum database/*.sql"), "backup runner creates database checksums"],
  [runner.includes("BACKUP_S3_BUCKET"), "backup runner requires independent destination configuration"],
  [!runner.includes("actions/upload-artifact"), "backup runner never writes backups to GitHub artifacts"],
  [!runner.includes("NEXT_PUBLIC_"), "backup credentials are never defined as browser-public variables"],
  ...requiredBackupSecrets.map((name) => [
    backupWorkflow.includes(`secrets.${name}`),
    `production backup reads ${name} from GitHub Secrets`,
  ]),
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
