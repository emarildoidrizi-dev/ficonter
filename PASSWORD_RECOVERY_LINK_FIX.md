# FICONTER password-recovery link fix

## Problem fixed

The previous password-reset email used Supabase's direct one-time confirmation URL and then redirected into `/auth/callback`. That path can fail immediately when:

1. an email client/security service prefetches the one-time link before the user clicks it; or
2. a PKCE recovery link is opened without the browser verifier that initiated the request.

Both cases can surface to the user as `error=expired_link` even when the email was just received.

## New flow

1. `/recover-account` calls `resetPasswordForEmail()` with the exact, query-free FICONTER-owned `/auth/recovery` redirect.
2. The Supabase Reset Password email template links to `/auth/recovery` and includes `token_hash` + `type=recovery`.
3. A GET to `/auth/recovery` **does not verify or consume** the token.
4. The user sees `Continue securely` and explicitly presses `Continue to reset password`.
5. A POST to `/auth/recovery/confirm` verifies the recovery token with `verifyOtp({ type: "recovery", token_hash })` and writes the recovery session to SSR cookies.
6. FICONTER redirects to `/update-password`, where the user chooses a new password.

This follows Supabase's production guidance for single-use auth links that can be prefetched by email scanners: land first on a domain you control and require a deliberate user action before consuming the one-time token.

## REQUIRED one-time Supabase Dashboard change

For a hosted Supabase project, code alone cannot replace the hosted email template. Do this once:

1. Supabase Dashboard -> Authentication -> Email Templates.
2. Open **Reset Password**.
3. Keep the subject you want (for example: `Reset your FICONTER password`).
4. Replace the template body with the contents of `SUPABASE_RESET_PASSWORD_TEMPLATE.html` in this repository.
5. Save.

The critical link is:

`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`

`redirectTo` itself must stay query-free (`/auth/recovery`). This is deliberate: production uses an exact Supabase redirect allow-list entry, and adding `?next=...` to the value can make the exact match fail and cause Supabase to fall back to the Site URL (the landing page). `/auth/recovery` already defaults to `/update-password`.

Do **not** use `{{ .ConfirmationURL }}` for the FICONTER password-recovery button, because that URL consumes the one-time token as soon as it is fetched.

## Redirect URL allow list

Supabase Dashboard -> Authentication -> URL Configuration should allow the environments that can request recovery, for example:

- `https://ficonter-beta.vercel.app/**`
- `https://ficonter.com/**` (production when active)
- `https://www.ficonter.com/**` (if used)
- `http://localhost:3000/**` (local development only)

## Existing compatibility

- `/auth/callback` remains for PKCE/OAuth and older flows.
- `/auth/confirm` still verifies non-recovery token-hash email flows.
- If a recovery token reaches `/auth/confirm`, it is redirected to the safe interstitial and is not consumed on GET.
