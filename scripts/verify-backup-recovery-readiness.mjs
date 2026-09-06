import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "docs/operations/backup-recovery.md",
  ".github/workflows/backup-recovery-readiness.yml",
  "scripts/create-owner-offline-backup.ps1",
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}

const doc = existsSync(requiredFiles[0]) ? readFileSync(requiredFiles[0], "utf8") : "";
const readinessWorkflow = existsSync(requiredFiles[1]) ? readFileSync(requiredFiles[1], "utf8") : "";
const runner = existsSync(requiredFiles[2]) ? readFileSync(requiredFiles[2], "utf8") : "";

const checks = [
  [doc.includes("Owner's direct physical control"), "documents owner-controlled physical backup model"],
  [doc.includes("encrypted external SSD"), "requires encrypted removable media"],
  [doc.includes("complete Git history"), "documents complete code-history backup"],
  [doc.includes("database backups do not contain the bytes") || doc.includes("Database backups do not contain the bytes"), "documents database/storage separation"],
  [doc.includes("No destination S3/AWS credentials are used"), "forbids external cloud backup destination"],
  [doc.includes("Never upload owner backups to GitHub Actions artifacts"), "forbids GitHub artifact storage of owner backups"],
  [doc.includes("isolated full database restore succeeds"), "requires full database restore validation"],
  [doc.includes("isolated Storage restore succeeds"), "requires Storage restore validation"],
  [readinessWorkflow.includes("verify-backup-recovery-readiness.mjs"), "readiness workflow executes verifier"],
  [!readinessWorkflow.includes("actions/upload-artifact"), "readiness workflow does not upload sensitive backups"],
  [runner.includes("git bundle create"), "owner runner creates full Git bundle"],
  [runner.includes("git archive"), "owner runner creates current source snapshot"],
  [runner.includes("supabase db dump"), "owner runner exports database with Supabase CLI"],
  [runner.includes("rclone copy"), "owner runner copies Supabase Storage locally"],
  [runner.includes("rclone check"), "owner runner verifies Storage copies"],
  [runner.includes("Get-FileHash -Algorithm SHA256"), "owner runner generates SHA-256 manifest"],
  [runner.includes("BackupRoot must be outside the FICONTER repository"), "owner runner refuses repository-local destination"],
  [!runner.includes("BACKUP_S3_"), "owner runner has no external destination S3 credentials"],
  [!runner.includes("actions/upload-artifact"), "owner runner never writes to GitHub artifacts"],
  [!runner.includes("NEXT_PUBLIC_"), "owner backup credentials are never browser-public variables"],
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
