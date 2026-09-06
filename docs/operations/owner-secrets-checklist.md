# FICONTER Owner Secrets Recovery Checklist

## Purpose

This file lists the secret values and account-recovery methods that the Owner must retain separately from the FICONTER recovery archive.

Do not put real secret values in this repository.

## Rule

Keep the actual values in a separate owner-controlled secure record. The master recovery password must never be stored on the same physical drive as the master recovery archive.

## Required account recovery access

The Owner should be able to regain access to:

- domain registrar account for `ficonter.com`;
- DNS provider account;
- GitHub account or replacement Git host account;
- Supabase account;
- Vercel account or replacement hosting account;
- Google Workspace / business email administration;
- PayPal business/developer account when paid subscriptions are enabled;
- any email delivery provider used by Production;
- OpenAI/API provider account if Smart Insights uses an external API.

For each provider, retain current recovery email, recovery phone, MFA recovery method and any backup/recovery codes in the separate secure record.

## Production application secrets/configuration values

Retain the current values for these names when they are in use:

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- production database password

### FICONTER application

- `NEXT_PUBLIC_SITE_URL`
- `FICONTER_OWNER_EMAIL`
- `FICONTER_SUPER_ADMIN_EMAIL`
- `FICONTER_HEALTH_TOKEN`

### Smart Insights / API

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

### PayPal - only when paid subscriptions are enabled

- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_API_BASE`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_PLAN_PERSONAL_MONTHLY`
- `PAYPAL_PLAN_PERSONAL_ANNUAL`
- `PAYPAL_PLAN_BUSINESS_MONTHLY`
- `PAYPAL_PLAN_BUSINESS_ANNUAL`

### Email / SMTP

Retain the active provider account, API key or SMTP credential used by Production, plus the sender/domain verification details required to recreate outbound email.

### DNS / domain

Retain or document:

- registrar login recovery;
- DNS provider login recovery;
- authoritative nameservers;
- A/AAAA/CNAME records used by Production;
- MX records;
- SPF record;
- DKIM selectors/records;
- DMARC record;
- any verification TXT records required by hosting/email providers.

## Supabase service configuration to record

Keep a current record of the non-database settings required to recreate the managed service:

- Auth site URL and redirect URLs;
- enabled login providers;
- password/email-auth settings;
- SMTP/email templates/settings;
- JWT/API settings that are not automatically recreated;
- Realtime configuration;
- Storage bucket privacy/public settings and policies;
- Edge Functions and function secrets, if used;
- any project-level extensions or service settings required by FICONTER.

## Master recovery password

The FICONTER master recovery archive password is a separate critical secret.

Requirements:

- do not save it in GitHub;
- do not save it in `FICONTER-BACKUPS`;
- do not place it in the recovery archive itself;
- do not send it in email/chat;
- keep at least one recoverable owner-controlled copy of the password or recovery method separate from the backup SSD.

## Backup-session-only credentials

Supabase Storage S3 access credentials generated for an offline backup should be temporary.

After a successful backup:

1. verify the encrypted master archive;
2. revoke/delete the temporary S3 access key;
3. remove any screenshot containing the secret;
4. clear the credential from PowerShell/environment variables.

## Review cadence

Review this checklist whenever any of these change:

- provider account;
- password/MFA method;
- environment variable;
- domain/DNS provider;
- email provider;
- payment provider;
- Supabase project/service configuration;
- production hosting provider.

The checklist should also be reviewed during every formal disaster-recovery drill.
