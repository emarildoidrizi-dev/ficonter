import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "docs/operations/backup-recovery.md",
  "docs/operations/owner-secrets-checklist.md",
  ".github/workflows/backup-recovery-readiness.yml",
  "scripts/create-owner-offline-backup.ps1",
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}

const doc = existsSync(requiredFiles[0]) ? readFileSync(requiredFiles[0], "utf8") : "";
const secretsDoc = existsSync(requiredFiles[1]) ? readFileSync(requiredFiles[1], "utf8") : "";
const readinessWorkflow = existsSync(requiredFiles[2]) ? readFileSync(requiredFiles[2], "utf8") : "";
const runner = existsSync(requiredFiles[3]) ? readFileSync(requiredFiles[3], "utf8") : "";

const checks = [
  [doc.includes("Owner's direct physical control"), "documents owner-controlled physical backup model"],
  [doc.includes("AES-encrypted master recovery archive"), "documents encrypted master recovery archive"],
  [doc.includes("No-Docker backup runner"), "documents no-Docker backup model"],
  [doc.includes("Git bundle") || doc.includes("Git history"), "documents complete code-history backup"],
  [doc.includes("Database backups do not contain the bytes"), "documents database/storage separation"],
  [doc.includes("No destination S3, AWS, Google Cloud"), "forbids external cloud backup destination"],
  [doc.includes("Never upload owner recovery archives to GitHub Actions artifacts"), "forbids GitHub artifact storage of owner backups"],
  [doc.includes("APPLICATION DATA RECOVERY PASSED"), "records isolated database recovery evidence"],
  [doc.includes("22 files restored") && doc.includes("465,762,369"), "records Storage recovery evidence"],
  [doc.includes("owner-controlled recovery baseline is COMPLETE"), "records completed recovery baseline"],
  [secretsDoc.includes("Do not put real secret values in this repository"), "secrets checklist forbids committed secret values"],
  [secretsDoc.includes("master recovery password") && secretsDoc.includes("separate"), "secrets checklist separates master password from backup media"],
  [readinessWorkflow.includes("verify-backup-recovery-readiness.mjs"), "readiness workflow executes verifier"],
  [!readinessWorkflow.includes("actions/upload-artifact"), "readiness workflow does not upload sensitive backups"],
  [runner.includes("git bundle create"), "owner runner creates full Git bundle"],
  [runner.includes("git archive"), "owner runner creates current source snapshot"],
  [runner.includes("pg_dump"), "owner runner exports database without Docker"],
  [runner.includes("pg_restore --list"), "owner runner validates PostgreSQL dump"],
  [!runner.includes("supabase db dump"), "owner runner does not require Supabase CLI database dump"],
  [runner.includes("rclone copy"), "owner runner copies Supabase Storage locally"],
  [runner.includes("rclone check"), "owner runner verifies Storage copies"],
  [runner.includes("Get-FileHash -Algorithm SHA256"), "owner runner generates SHA-256 manifest"],
  [runner.includes("7z a") && runner.includes("-mhe=on"), "owner runner creates encrypted-header master archive"],
  [runner.includes("7z t"), "owner runner tests final encrypted archive"],
  [runner.includes("BackupRoot must be outside the FICONTER repository"), "owner runner refuses repository-local destination"],
  [runner.includes("TEMPORARY Supabase Storage S3"), "owner runner requires temporary Storage credentials"],
  [runner.includes("Remove-Item Env:RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY"), "owner runner clears temporary Storage secret"],
  [runner.includes("Remove-Item Env:PGPASSWORD"), "owner runner clears database password environment variable"],
  [!runner.includes("BACKUP_S3_"), "owner runner has no external destination S3 credentials"],
  [!runner.includes("actions/upload-artifact"), "owner runner never writes to GitHub artifacts"],
  [!runner.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"), "owner runner never exposes privileged key as browser-public variable"],
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
