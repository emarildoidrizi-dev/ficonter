# FICONTER Phase 1 Security Review

## Privileged Supabase authentication

- Privileged Supabase access is centralized in `lib/supabase/admin.ts`.
- The privileged client is explicitly server-only.
- It accepts `SUPABASE_SECRET_KEY` or the legacy
  `SUPABASE_SERVICE_ROLE_KEY` and rejects the public anon/publishable key.
- It never persists a session, refreshes a token or reads browser cookies.
- Admin-role verification fails closed when the privileged check is unavailable.
- Protected super-admin accounts cannot delete themselves through the normal
  account-deletion endpoint.

## API endpoint verification

| Endpoint | Access | Input / request protection |
| --- | --- | --- |
| `GET /api/health` | Public liveness only | Returns no infrastructure or secret details |
| `GET /api/exchange-rate` | Authenticated user | Currency allowlist and upstream timeout |
| `DELETE /api/account/delete` | Authenticated user | Same-origin and protected-super-admin checks |
| `GET /api/admin/users` | Admin only | Privacy-safe directory and aggregate counts |
| `PATCH /api/admin/users/[id]` | Admin hierarchy | Same-origin, UUID and action validation |
| `DELETE /api/admin/users/[id]` | Admin hierarchy | Same-origin, UUID, audit and protection checks |
| `GET /api/admin/health` | Admin only | No-store, sanitized health results |

## Existing protections retained

- RLS remains enabled for exposed financial tables.
- Dashboard pages validate the authenticated user server-side.
- Security-sensitive writes use server routes or database RPCs.
- Content Security Policy, frame protection, MIME protection, Referrer Policy
  and Permissions Policy remain enabled.
- Admin views expose aggregate usage only, never customer financial values.

## Automated verification

Run:

```bash
npm run verify:phase1
npm run lint
npm run build
```

The static verification checks every API route guard and scans client components
for privileged-key references. Live cross-user RLS penetration tests still
require a dedicated test Supabase project and two disposable accounts.
