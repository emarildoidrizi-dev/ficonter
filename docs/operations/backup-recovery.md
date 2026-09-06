# FICONTER Backup and Recovery

## Objective

Keep a recoverable FICONTER backup under the Owner's direct physical control, without storing production backup copies in AWS or another third-party backup destination.

The recovery set covers three independent assets:

1. the full FICONTER Git history and a current source snapshot;
2. the production PostgreSQL database;
3. all Supabase Storage objects.

Production customer data, authentication records, financial data, documents and media must never be committed to the public GitHub repository or uploaded to GitHub Actions artifacts.

## Approved owner-controlled model

The approved FICONTER model is an AES-encrypted master recovery archive stored on removable media physically controlled by the Owner.

Current production recovery archive naming convention:

`FICONTER-MASTER-RECOVERY-YYYY-MM-DD.7z`

The archive is created with 7-Zip AES encryption and encrypted archive headers (`-mhe=on`). The master password is never stored in Git, in the recovery manifest, or next to the recovery archive.

The local backup runner is:

`scripts/create-owner-offline-backup.ps1`

It is intentionally not scheduled in GitHub Actions because a GitHub-hosted runner cannot write to the Owner's physically attached drive.

## No-Docker backup runner

The approved owner runner does not require Docker.

Prerequisites on the Owner computer:

- Git;
- PostgreSQL client tools (`pg_dump` and `pg_restore`);
- rclone;
- 7-Zip command-line (`7z`);
- a temporary Supabase Storage S3 access key generated only for the backup session;
- the production database password;
- the FICONTER master recovery password.

The runner securely prompts for sensitive values at runtime instead of writing them into the repository.

## What each backup contains

Inside the encrypted master archive:

- `code/FICONTER-CODE.bundle` - complete Git history available locally;
- `code/FICONTER-SOURCE.zip` - current source snapshot;
- `database/FICONTER-PRODUCTION.dump` - PostgreSQL custom-format production database dump;
- `storage/<bucket>/...` - local copy of every Storage object;
- `manifest/BACKUP-INFO.txt` - non-secret backup metadata;
- `manifest/RECOVERY-CONFIGURATION.txt` - non-secret infrastructure/configuration inventory;
- `manifest/READ-FIRST.txt` - emergency recovery order;
- `manifest/SHA256SUMS.txt` - SHA-256 integrity hashes for the recovery contents.

The source repository snapshot also contains this runbook and the Owner Secrets checklist.

## Database backup

The no-Docker runner uses `pg_dump` directly against the production Supabase PostgreSQL pooler and writes a custom-format dump with owner/privilege restoration disabled.

The production database password is held only in process memory for the backup operation and is cleared afterward.

The dump is immediately checked with `pg_restore --list` before the master archive is created.

Important recovery note: Supabase is more than PostgreSQL. A raw database dump can preserve application data and Auth records, but a replacement Supabase environment may still require managed roles, service configuration, extensions, Auth settings, Realtime settings, SMTP settings and Storage service configuration to be recreated. This is why the recovery configuration record and Owner Secrets record are part of the disaster-recovery design.

## Storage backup

Database backups do not contain the bytes of Supabase Storage objects. Storage is therefore copied separately.

The runner uses a temporary Supabase Storage S3 access key. It discovers every live bucket, copies all objects locally and verifies each bucket with `rclone check` using file size comparison.

The temporary S3 key must be revoked/deleted immediately after a successful backup.

No destination S3, AWS, Google Cloud or other external backup provider is used.

## Master encryption

After code, database, Storage and manifests are created and verified, the runner creates one master archive with:

- 7z format;
- AES encryption;
- encrypted archive headers/filenames;
- Owner-supplied master recovery password.

The runner then tests the encrypted master archive with `7z t`. The temporary working directory is deleted afterward so the final backup destination contains only the encrypted recovery archive.

## Running a backup

Example from PowerShell:

`powershell -ExecutionPolicy Bypass -File scripts/create-owner-offline-backup.ps1 -BackupRoot "D:\\FICONTER-BACKUPS"`

The runner refuses to place the backup inside the FICONTER source repository.

The script will prompt for:

1. production Supabase database password;
2. temporary Supabase Storage S3 access key ID;
3. temporary Supabase Storage S3 secret;
4. FICONTER master recovery password.

Do not paste these values into chat, GitHub issues, screenshots, email or documentation.

## Recovery order

1. Protect the original recovery archive and work from a copy where practical.
2. Extract the master archive only on a trusted computer.
3. Verify `manifest/SHA256SUMS.txt`.
4. Recover application code from `code/FICONTER-CODE.bundle` or `code/FICONTER-SOURCE.zip`.
5. Restore `database/FICONTER-PRODUCTION.dump` into an isolated/new PostgreSQL or replacement Supabase target.
6. Recreate Storage buckets and restore `storage/<bucket>/...`.
7. Recreate environment variables and service configuration from `manifest/RECOVERY-CONFIGURATION.txt` plus the separate Owner Secrets Record.
8. Validate Auth, RLS, Realtime, Storage, payments, health checks and application behavior.
9. Reconnect `ficonter.com` only after the isolated replacement passes validation.

Never run a destructive restore drill against Production.

## Recovery drill evidence - 2026-09-06

A real production owner-controlled recovery set was created and tested without modifying Production.

### Code

- Git bundle verified.
- Bundle cloned into an isolated restore directory.
- Full source tree restored.
- Git object verification completed.
- Result: PASSED.

### Database

- Encrypted database archive decrypted successfully.
- PostgreSQL custom dump restored into local PostgreSQL 18.6.
- Core FICONTER table row counts matched Production for the tested tables.
- `auth.users` restored with 10 users and matched Production.
- Result: APPLICATION DATA RECOVERY PASSED.

The raw restore reported Supabase-managed infrastructure errors in plain PostgreSQL. These do not invalidate the recovered FICONTER data, but they confirm that rebuilding the complete managed Supabase service also requires service configuration beyond the database dump.

### Storage

- Encrypted Storage archive decrypted successfully.
- 22 files restored.
- 18 folders restored.
- Total restored bytes: 465,762,369.
- All expected bucket folders were present.
- Result: PASSED.

### Integrity and cleanup

- SHA-256 integrity validation passed for the production recovery files.
- Temporary plaintext restore-test directories were deleted after validation.
- Temporary Supabase Storage S3 access credentials were revoked after backup.
- Production was not modified during the restore drill.

## Recovery configuration

The backup includes a non-secret configuration inventory covering:

- production Supabase project/region;
- PostgreSQL connection identifiers;
- Storage S3 endpoint/region;
- production domain names;
- required application environment-variable names;
- PayPal configuration variable names when paid subscriptions are enabled.

Secret values are intentionally excluded.

The repository also contains:

`docs/operations/owner-secrets-checklist.md`

That checklist identifies which secret values/account recovery methods the Owner must retain separately.

## Security rules

- Never commit production database dumps or Storage objects to GitHub.
- Never upload owner recovery archives to GitHub Actions artifacts.
- Never write passwords, database passwords, S3 secrets, JWTs, service-role keys, payment secrets or the master recovery password into Git.
- Never store the master recovery password on the same physical drive as the master recovery archive.
- Never restore directly over damaged Production before testing in an isolated target.
- Disconnect the removable backup drive when it is not actively being used.
- Treat an unlocked/extracted recovery set as privileged production-data access.

## Physical resilience

The current encrypted master archive removes dependence on the laptop and on the continued existence of GitHub/Supabase/Vercel for the survival of FICONTER's code and core data.

A second encrypted physical copy stored at a different secure location is strongly recommended before FICONTER holds material amounts of customer data. This protects against drive failure, theft, fire, water damage or accidental formatting. It is a physical-redundancy enhancement; it does not change the validity of the primary tested recovery archive.

## Retention

For regular operations, keep verified archives using a simple rotation such as:

- latest 7 daily backups;
- 4 weekly backups;
- 6 monthly backups.

Delete an older archive only after a newer archive has been created and verified.

## Completion status

As of 2026-09-06, the owner-controlled recovery baseline is COMPLETE for:

- real production code backup;
- real production database backup;
- real production Storage backup;
- AES-encrypted master archive;
- encrypted archive verification;
- SHA-256 integrity verification;
- isolated code recovery test;
- isolated core database/Auth data recovery test;
- isolated Storage recovery test;
- emergency recovery order;
- non-secret recovery configuration inventory;
- no-Docker repeatable owner backup runner.

The system is a cold disaster-recovery design, not a hot-standby/failover cluster. A simultaneous provider outage can therefore cause downtime while replacement infrastructure is provisioned and validated.
