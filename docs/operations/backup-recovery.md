# FICONTER Backup and Recovery

## Objective

Keep a recoverable FICONTER backup under the Owner's direct physical control, without storing production backup copies in AWS or another third-party backup destination.

The owner-controlled backup must cover three separate things:

1. the full FICONTER Git history and a current source snapshot;
2. the Supabase Postgres database;
3. Supabase Storage objects.

Production customer data, authentication records, financial data, documents, and media must never be committed to the public GitHub repository or uploaded to GitHub Actions artifacts.

## Owner-controlled offline model

The approved FICONTER recovery model is an encrypted external SSD or equivalent encrypted removable drive physically controlled by the Owner.

GitHub and Supabase remain live service providers, but the disaster-recovery copy is not stored with another cloud backup provider.

The local backup runner is:

`scripts/create-owner-offline-backup.ps1`

It is intentionally not scheduled in GitHub Actions because a GitHub-hosted runner cannot write to the Owner's physically attached drive.

## Backup contents

Each backup set is written to a timestamped folder such as:

`FICONTER-20260906T070000Z/`

and contains:

- `code/ficonter-full-history.bundle` — complete Git history, branches and refs available locally;
- `code/ficonter-main-source.zip` — current source snapshot;
- `database/roles.sql`;
- `database/schema.sql`;
- `database/data.sql`;
- `storage/<bucket>/...`;
- `manifest/backup-info.txt`;
- `manifest/sha256.txt`.

The Git bundle allows the repository to be reconstructed even if normal Git hosting is unavailable. The source ZIP is a convenient current-code snapshot.

## Database backup

The runner uses the Supabase CLI and `supabase db dump` for roles, schema and data.

The production database connection string is supplied only at runtime through `SUPABASE_DB_URL`. It must not be written into the backup manifest or committed to the repository.

## Storage backup

Database backups do not contain the bytes of Supabase Storage objects. Storage therefore has to be copied separately.

The runner reads server-side Supabase S3 credentials only from local environment variables:

- `SUPABASE_STORAGE_S3_ENDPOINT`
- `SUPABASE_STORAGE_S3_REGION`
- `SUPABASE_STORAGE_S3_ACCESS_KEY_ID`
- `SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY`

It discovers every live bucket, copies the objects to the Owner's local backup directory, and verifies each copy with `rclone check`.

No destination S3/AWS credentials are used.

## Physical security

The backup destination should be an encrypted external SSD controlled by the Owner. On Windows, BitLocker or an equivalent full-volume encryption mechanism is appropriate.

Recommended operating model:

- SSD A: primary owner backup, kept offline when not in use;
- SSD B: second owner-controlled copy, stored in a different secure physical location;
- do not leave either drive permanently connected to the production computer;
- do not store the encryption recovery key on the same drive;
- do not place the production backup folder inside OneDrive, Dropbox, Google Drive, iCloud, or another automatic cloud-sync directory unless the Owner explicitly changes this policy.

## Running a backup

Prerequisites on the Owner's computer:

- Git;
- Supabase CLI;
- rclone;
- the required production database and Storage credentials loaded locally as environment variables;
- the encrypted external drive mounted and unlocked.

Run from PowerShell:

`powershell -ExecutionPolicy Bypass -File scripts/create-owner-offline-backup.ps1 -BackupRoot "E:\\FICONTER-BACKUPS"`

Replace `E:\\FICONTER-BACKUPS` with the actual encrypted drive path.

The runner refuses to place the backup inside the FICONTER repository.

## Verification

Every backup creates SHA-256 checksums for the files in the backup set. Storage objects are also compared against the Supabase source using `rclone check`.

A backup should not be considered valid until:

- the script exits successfully;
- the timestamped backup directory exists on the encrypted drive;
- `manifest/sha256.txt` exists;
- the Git bundle can be verified with `git bundle verify`;
- a sample database restore and Storage restore have been tested in a non-production environment.

## Recovery drill evidence

### 2026-09-06 — isolated staging row-recovery drill

Project: `FICONTER E2EE STAGING` (`zlegwxjplrxojeosgphq`).

Representative encrypted financial rows were copied to temporary recovery snapshots, deleted in staging, restored, and compared column-for-column.

Results:

- Transactions: restored exactly.
- Bills: restored exactly.
- Debt: restored exactly.
- Credit-card monthly history: two linked rows restored exactly.
- Production data was not modified.

This proves representative financial records can survive a controlled delete/restore cycle. A complete owner-drive backup and full restore drill are still required before backup/recovery is marked fully complete.

## Recovery order

1. Application/code regression: use the local Git bundle/source snapshot or normal Git history to recover the application.
2. Database loss/corruption: restore the owner-held logical database dump into an isolated/new Supabase project.
3. Storage loss: restore the affected bucket objects from the owner-held Storage copy.
4. Full Supabase project loss: provision a replacement project, restore database and Storage, reconfigure secrets, validate RLS/Auth/Realtime, then repoint the application.

## Security rules

- Never commit production database dumps or Storage objects to GitHub.
- Never upload owner backups to GitHub Actions artifacts.
- Never write passwords, database URLs, S3 secrets, JWTs, service-role keys, or encryption keys into the manifest.
- Never run a destructive restore drill against production.
- Keep the backup media encrypted and offline when not actively creating or validating a backup.
- Treat possession of an unlocked backup drive as privileged production-data access.

## Retention

A practical owner-controlled baseline is:

- keep the latest 7 daily backups;
- keep 4 weekly backups;
- keep 6 monthly backups.

Older sets can be deleted manually after a newer backup has been verified.

## Completion criteria

Backup/recovery is fully complete only when:

- one real production backup has been created on the Owner's encrypted removable drive;
- the full Git bundle and source snapshot are present;
- the database roles/schema/data dumps are present;
- every live Storage bucket has been copied;
- checksums are present and validate;
- an isolated full database restore succeeds;
- an isolated Storage restore succeeds;
- the Owner can physically locate and unlock the backup media;
- a second owner-controlled copy exists in a separate secure physical location.
