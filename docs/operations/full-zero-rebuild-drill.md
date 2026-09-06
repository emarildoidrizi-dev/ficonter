# FICONTER Full Zero-Rebuild Disaster Drill

## Goal

Prove that FICONTER can be rebuilt from the owner-controlled recovery material without modifying Production.

## Safety rule

Never run the drill against Production project `bbqwhesigazgziiuexlv` or the live `ficonter.com` domain.

Use a fresh temporary Supabase project and a private/non-production deployment.

## Required recovery material

Keep all recovery material under the Owner's recovery location, normally:

`D:\FICONTER-BACKUPS`

Required files:

- latest `FICONTER-MASTER-RECOVERY-*.7z`;
- `FICONTER-OWNER-SECRETS.7z` when the encrypted Owner Secrets Vault has been created;
- Emergency Recovery Plan PDF;
- the master recovery password stored separately from the SSD.

## Phase 1 - fresh replacement Supabase project

1. Create a new temporary Supabase project in `eu-central-1`.
2. Do not connect the production domain or production users to it.
3. Record the temporary project ref, session-pooler host, database username, Storage S3 endpoint and project URL.
4. Generate temporary target Storage S3 credentials.
5. Run `scripts/rebuild-supabase-from-recovery.ps1` using the latest owner recovery archive.

The rebuild script must refuse the Production project ref.

## Phase 2 - validate recovered database

At minimum validate these tables:

- transactions;
- bills;
- debts;
- goals;
- monthly_budget_plans;
- credit_card_monthly_records;
- profiles;
- businesses;
- auth.users.

Record row counts and compare them with the source backup baseline.

Managed Supabase schema ownership warnings during a full logical restore do not by themselves prove failure. Application data, Auth records and required database objects must be validated explicitly.

## Phase 3 - restore Storage

Restore all bucket folders from the owner archive to the replacement project's S3 endpoint.

Validate every bucket with `rclone check --size-only --one-way`.

Known Production buckets as of 2026-09-06:

- business-assets;
- business-documents;
- email-assets;
- financial-documents;
- owner-music;
- profile-photos;
- vault-recovery-consents.

## Phase 4 - recreate managed Supabase configuration

Recreate or verify settings that are not guaranteed to come from the database dump:

- Auth site URL and redirect URLs;
- email/password Auth settings;
- SMTP provider settings and templates;
- Realtime publication/configuration;
- Storage bucket visibility/configuration;
- API/JWT settings as applicable;
- database extensions/settings required by FICONTER;
- Edge Functions and function secrets if any are introduced later.

As of 2026-09-06, Production has no deployed Supabase Edge Functions.

## Phase 5 - private FICONTER deployment

Deploy recovered FICONTER source privately using a non-production hostname.

Configure the deployment with the temporary recovery Supabase project and the values from the encrypted Owner Secrets Vault.

Do not point `ficonter.com` at the drill deployment.

## Phase 6 - acceptance test

The drill passes only when all of the following work in the recovered environment:

- sign in;
- user isolation;
- Overview;
- Transactions;
- Bills;
- Monthly Planner;
- Debt;
- Goals;
- Credit Card records;
- Profile / Settings;
- Storage-backed documents and images;
- Realtime synchronization;
- Owner/Admin authorization;
- health endpoint;
- email/recovery flow where safe to test;
- subscription/payment configuration in sandbox or disabled mode, never by charging a real customer.

## Phase 7 - evidence

Record:

- temporary Supabase project ref;
- temporary deployment URL;
- recovery archive filename and SHA-256;
- database validation counts;
- Storage validation result;
- test date;
- pass/fail for each acceptance item.

## Phase 8 - teardown

After the drill passes:

1. delete/revoke temporary Storage access keys;
2. remove temporary local decrypted files;
3. remove drill-only secrets from the temporary deployment;
4. delete the temporary project/deployment if no longer needed;
5. keep only the non-secret drill evidence in the recovery documentation.

## Completion definition

The full zero-rebuild item is complete only after a fresh project and private deployment have been rebuilt from the owner recovery material and the acceptance test passes end-to-end.
