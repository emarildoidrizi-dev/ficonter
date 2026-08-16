# FICONTER Password Recovery Canonical Fix

## Why this patch exists

A live recovery email was observed opening the public landing page with a URL shaped like:

`https://ficonter.com/?token_hash=...&type=recovery`

That proves the one-time recovery token reached FICONTER, but the email's base destination resolved to the Site URL instead of `/auth/recovery`.

## Changes

1. Hosted password-reset requests now always pass the canonical production redirect:
   `https://www.ficonter.com/auth/recovery`
2. The Supabase Reset Password template no longer depends on `{{ .RedirectTo }}` for the production recovery button. It links directly to:
   `https://www.ficonter.com/auth/recovery?token_hash={{ .TokenHash }}&type=recovery`
3. The public `/` page now contains a recovery safety net. If a recovery `token_hash` ever lands at the root anyway, FICONTER immediately redirects it to `/auth/recovery` without consuming the token.
4. Local development still uses the local origin for reset requests.

## Supabase dashboard template

Use this exact button href in Authentication → Emails → Reset password:

`https://www.ficonter.com/auth/recovery?token_hash={{ .TokenHash }}&type=recovery`

Keep the production redirect allow-list entry:

`https://www.ficonter.com/auth/recovery`

## Expected flow

Forgot password → FICONTER email → `/auth/recovery` → explicit Continue POST → OTP verification → `/update-password` → save new password.
