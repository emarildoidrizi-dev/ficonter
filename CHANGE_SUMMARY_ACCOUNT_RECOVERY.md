# Account Recovery Hardening — Change Summary

- Clarifies that the FICONTER login identifier is the registered email address, not a separate username.
- Preserves app/brand entry context throughout account recovery.
- Hardens password-reset requests against account enumeration.
- Adds 60-second client resend cooldowns alongside Supabase Auth rate limiting.
- Handles invalid and expired reset links with a clean recovery route.
- Validates the recovery user before enabling password change.
- Explicitly revokes existing sessions after a successful password reset, with local cleanup fallback.
- Supports login-email recovery through an already-linked verified phone number and Supabase SMS OTP.
- Uses `shouldCreateUser: false` for recovery OTP requests.
- Uses local-only sign-out for the temporary SMS recovery session so other legitimate device sessions are not terminated.
- Adds E.164 phone normalization/validation, resend flow, and invalid/expired code handling.
- Provides a safe email-recovery fallback when no verified phone is available.
- Adds complete translations for all new recovery UI in EN, DE, ES, SQ, AR, PT, IT, and RU.
- Adds `verify-account-recovery.mjs` to the release candidate manifest.

Validation:
- Account recovery: 28/28 checks passed.
- Localization: 0 uncovered static/runtime strings/templates.
- Phase 1 QA TypeScript/TSX syntax transpilation: passed.
- Full FICONTER release candidate: 69/69 suites passed.
