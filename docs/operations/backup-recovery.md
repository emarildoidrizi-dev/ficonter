# FICONTER Backup and Recovery

## Objective

Maintain recoverable copies of both the Supabase Postgres database and Supabase Storage objects without committing customer data, financial records, authentication data, documents, or media to the public GitHub repository.

## Current production facts

- Supabase project: `bbqwhesigazgziiuexlv`
- Region: `eu-central-1`
- Database: PostgreSQL 17
- Storage is independent from database backups. Database restoration restores Storage metadata only; deleted Storage objects are not restored by a database backup.
- FICONTER therefore treats database backup and object backup as two separate recovery streams.

## Required recovery streams

### 1. Database

Create three logical exports using the current Supabase CLI:

- roles
- schema
- data

The backup job must use `supabase db dump` rather than raw `pg_dump` so Supabase-managed schemas and reserved roles are handled using Supabase's supported filtering.

The database connection string must be supplied only at runtime through a secret named `SUPABASE_DB_URL`.

### 2. Storage objects

All production buckets must be copied to a private off-site S3-compatible destination. Supabase S3 credentials are server-only credentials and must never be exposed to the browser or committed to GitHub.

Source secrets:

- `SUPABASE_STORAGE_S3_ENDPOINT`
- `SUPABASE_STORAGE_S3_REGION`
- `SUPABASE_STORAGE_S3_ACCESS_KEY_ID`
- `SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY`

Destination secrets:

- `BACKUP_S3_ENDPOINT`
- `BACKUP_S3_REGION`
- `BACKUP_S3_BUCKET`
- `BACKUP_S3_ACCESS_KEY_ID`
- `BACKUP_S3_SECRET_ACCESS_KEY`

The destination must be private, encrypted at rest, and independent of the Supabase project.

## Backup packaging

Each successful backup is stored under a UTC timestamp prefix and contains:

- `database/roles.sql`
- `database/schema.sql`
- `database/data.sql`
- `storage/<bucket>/...`
- `manifest/sha256.txt`
- `manifest/backup-info.txt`

The manifest contains checksums and counts only. It must not contain database connection strings, access keys, JWTs, encryption keys, or service-role credentials.

## Retention

Recommended baseline before public commercial launch:

- daily backup: retain 14 days
- weekly backup: retain 8 weeks
- monthly backup: retain 12 months

Retention is configured at the destination provider, not in this repository.

## Restore validation

A backup is not considered validated merely because upload succeeded. At least one restore drill must be completed before #15 is closed.

Use a non-production Supabase project for the drill.

Database drill:

1. Download one complete backup set.
2. Create or select an isolated non-production project.
3. Restore roles, schema, then data using the supported Supabase/psql process.
4. Confirm the application-critical schemas, authentication records, and representative financial tables exist.
5. Run FICONTER's database/security verification suites against the restored project.

Storage drill:

1. Restore copied objects into isolated test buckets only.
2. Confirm representative private objects can be listed and downloaded with authorized access.
3. Confirm public/private bucket classifications match production expectations.
4. Never overwrite production Storage during a validation drill.

## Recovery decision order

1. Application-only regression: roll back Vercel/GitHub deployment first.
2. Database corruption or accidental destructive mutation: use Supabase managed restore/PITR if available, otherwise logical off-site backup.
3. Deleted/corrupted Storage object: restore the affected object from the off-site Storage copy.
4. Full Supabase project loss: provision a new project, restore database, recreate project configuration/secrets, restore Storage objects, validate RLS/Auth/Realtime, then move application environment variables.

## Security rules

- Never upload backups to GitHub Actions artifacts.
- Never commit SQL data dumps to this repository.
- Never copy production data into a public bucket.
- Never put backup credentials in `NEXT_PUBLIC_*` variables.
- Do not run destructive restore commands against production as a test.
- Keep source Supabase S3 credentials read-capable only where practical; destination credentials should be restricted to the dedicated backup bucket.

## Closure criteria for launch item #15

#15 can be marked complete only when all of the following are true:

- a current database backup exists outside the production Supabase project;
- every live Storage bucket has an independent object copy;
- checksums/manifests are generated;
- the backup destination is private and access-controlled;
- one isolated database restore drill succeeds;
- one isolated Storage restore drill succeeds;
- the restore procedure and recovery owner are documented;
- backup age/failure monitoring is enabled.
