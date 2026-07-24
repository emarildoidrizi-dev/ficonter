# FICONTER Security Review

## High-priority findings corrected

1. **Account-deletion API lacked same-origin protection**
   - Added strict Origin verification to reduce cross-site request attacks.
   - Admin errors are logged server-side without exposing provider details to users.

2. **Exchange-rate API was publicly callable**
   - It now requires a valid authenticated FICONTER user.
   - Currency inputs use an allowlist.
   - External requests time out after eight seconds.
   - Provider response bodies are no longer returned to clients.

3. **Missing HTTP security headers**
   - Added Content Security Policy, frame protection, MIME sniffing protection,
     Referrer Policy, Permissions Policy and cross-origin isolation headers.

4. **Database hardening**
   - RLS is enabled and forced on all current financial tables.
   - RPC execution is revoked from anonymous/public roles.
   - Financial RPCs are explicitly granted only to authenticated users.
   - Trigger helper execution is revoked from API roles.

5. **Duplicate-linked-record protection**
   - Added unique partial indexes so a transaction cannot be linked to more than
     one bill or more than one debt payment.

6. **Profile-photo Storage**
   - Bucket remains private.
   - Maximum stored image size remains 2 MB.
   - Only JPEG objects inside the authenticated user's own folder are allowed.

## Existing protections verified

- Dashboard routes verify the authenticated user server-side.
- Financial tables already use user-scoped RLS policies.
- Bill payment uses a database RPC rather than a client-only multi-step write.
- Password recovery uses Supabase Auth recovery sessions.
- Service-role credentials remain server-side only.

## Follow-up work recommended later

- Add an immutable audit log for security-sensitive actions.
- Add CAPTCHA/Turnstile to registration and password recovery.
- Add server-side rate limiting through a durable store such as Upstash Redis.
- Add automated dependency scanning and error monitoring.
- Add integration tests that attempt cross-user reads/writes for every table.
