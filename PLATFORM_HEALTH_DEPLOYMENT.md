# FICONTER Platform Health and Security Deployment

## Included

- Real Auth check through the server-only Supabase Admin API.
- Real PostgreSQL/PostgREST check against the admin-role table.
- Real Storage API check by listing project buckets.
- Real browser Realtime connection status from the live audit subscription.
- Healthy, Degraded, and Offline states.
- Measured response latency.
- Automatic checks every 60 seconds and whenever the admin tab becomes active.
- Manual refresh control.
- Centralized server-only privileged Supabase client.
- Fail-closed admin-role and protected-super-admin checks.
- Static API security verification script.

## Deployment

No SQL migration is required for this package.

Replace the files listed in `UPLOAD_INSTRUCTIONS_PLATFORM_HEALTH.txt`, commit,
and wait for the latest Vercel deployment to show Ready.

## Environment variables

At least one privileged server variable must exist in Vercel:

- `SUPABASE_SERVICE_ROLE_KEY` (current legacy key), or
- `SUPABASE_SECRET_KEY` (new secret-key format)

Never prefix either variable with `NEXT_PUBLIC_`.
