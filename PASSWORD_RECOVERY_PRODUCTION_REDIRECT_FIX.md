# Password Recovery Production Redirect Fix

## Symptom
A valid FICONTER password-reset email arrived, but clicking **Continue password reset** opened the public FICONTER landing page instead of the recovery screen.

## Root cause
The client was calling `resetPasswordForEmail()` with a redirect target containing a query string (`/auth/recovery?next=...`). Production Supabase was configured with the exact allowed redirect `https://www.ficonter.com/auth/recovery`. If the query-bearing value does not match that exact allow-list entry, Supabase falls back to the configured Site URL (`https://www.ficonter.com`), which is the landing page.

## Fix
- Password reset now sends a query-free `redirectTo`: `/auth/recovery`.
- `/auth/recovery` already defaults its safe next page to `/update-password`.
- The hosted email template appends `?token_hash=...&type=recovery` to that clean redirect target.
- The current FICONTER email emblem remains in the hosted template.

## Supabase production values
Keep:
- Site URL: `https://www.ficonter.com`
- Redirect URL: `https://www.ficonter.com/auth/recovery`

No query-string variant is needed after this code is deployed.
