# FICONTER Account Recovery V1

## Scope

This patch hardens credential recovery for signed-out FICONTER customers on web and installed/PWA entry paths.

## Credential model

FICONTER currently authenticates customers with an email address and password. There is no separate customer username. The login UI now states this directly.

## Password recovery

1. Customer selects **Forgot password?**.
2. Customer enters the registered email address.
3. FICONTER calls Supabase password recovery and always returns a generic success response so the screen does not disclose whether the email is registered.
4. Requests are throttled in the UI for 60 seconds in addition to Supabase Auth's server-side limits.
5. The email recovery link returns through `/auth/callback` and then `/update-password`.
6. Invalid or expired links return to `/recover-account` with an actionable message.
7. The update screen validates the recovery user before enabling the password fields.
8. After a successful password update, FICONTER explicitly revokes existing sessions and returns the customer to login.

## Forgotten login email / "username"

Because the login ID is the registered email address, the recovery screen explains that FICONTER has no separate username.

Where Supabase Phone Auth is enabled and the customer previously linked a verified phone number:

1. Customer enters the phone number in international E.164 form.
2. FICONTER requests an SMS OTP with `shouldCreateUser: false`.
3. Responses remain generic so phone numbers cannot be used to enumerate accounts.
4. After valid OTP verification, FICONTER reveals only the authenticated user's login email.
5. The temporary OTP recovery session is signed out with `scope: "local"`, so other legitimate device sessions are not terminated.

If no verified phone is linked, FICONTER directs the customer to try likely email addresses through the password-recovery flow. Only the real mailbox receives a recovery message; the UI never confirms which candidate email exists.

## App / PWA behavior

The `entry=app` / `entry=brand` context is preserved through:

- Login → recovery
- Recovery email callback → update password
- Expired recovery link → recovery
- Update password → login

This prevents the installed-app recovery flow from unexpectedly returning to public-homepage navigation.

## Supabase deployment requirements

Before production rollout verify in Supabase Auth configuration:

- Production FICONTER Site URL is correct.
- The production login/callback origin is included in Auth redirect URLs.
- Any Beta domain that may request password resets is included in the allowed redirect URLs.
- Preview URLs are allowed only if the team deliberately supports account recovery from previews.
- Recovery email template points back through the configured redirect target.
- Production SMTP is configured and tested for reliable delivery.
- Phone Auth/SMS provider is configured only if phone-based login-email recovery will be offered.

Do not store SMTP, SMS-provider, service-role, or other secrets in the client bundle or this repository.

## Security decisions

- No email-account enumeration on reset request.
- No phone-account enumeration on OTP request.
- No external/open `next` redirect accepted by auth callback routes.
- Temporary phone-recovery session uses local sign-out only.
- Password-reset completion explicitly revokes older sessions.
- Reset/update pages never require service-role credentials.
