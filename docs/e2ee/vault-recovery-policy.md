# FICONTER Vault Recovery Policy

Status: LOCKED FOR STAGING IMPLEMENTATION
Branch: feature/e2ee-zero-knowledge
Scope: Customers whose subscription includes FICONTER Vault. Platform Owner / Super Admin / Admin operating in the administration workspace are outside this customer Vault flow.

## 1. Core security model

- Customer financial data remains encrypted client-side before storage.
- The readable financial Vault key must never be displayed to FICONTER personnel or stored as plaintext within FICONTER systems.
- FICONTER Vault is the paid security layer added on top of the encrypted financial-data architecture.
- Recovery credentials are key-management credentials. They are not customer financial data and must never be logged or stored in plaintext.
- Customer Service, Admin, Super Admin, and Owner must never receive a screen that displays a customer's decrypted financial records as part of recovery.

## 2. Recovery hierarchy

Recovery must always follow this order:

1. Existing unlocked/trusted device.
2. Trusted-device approval for a new device.
3. Customer recovery code.
4. Recovery-code replacement while a trusted device still has Vault access.
5. FICONTER Assisted Recovery as the final resort only after the customer-controlled methods fail.

FICONTER Assisted Recovery must never be the normal login path.

## 3. Normal paid-plan Vault behavior

- A customer activates FICONTER Vault only when their subscription includes the feature.
- On activation, the customer receives a recovery code and must confirm that recovery setup is complete.
- The Vault-protected financial workspace locks after 30 minutes without user activity.
- The account may remain authenticated, but protected financial data remains inaccessible until the Vault is unlocked again.
- The recovery/unlock credential is required after this inactivity lock unless a future approved trusted-device/passkey unlock method is explicitly added.
- Free-plan customers are not placed into this visible Vault-lock/recovery-code workflow.

## 4. Lost recovery code while a trusted device remains available

If the customer loses the recovery code but still has an unlocked/trusted device:

- The customer may replace the recovery code from that trusted session.
- A new recovery code is generated client-side.
- The existing Vault key is rewrapped under the new recovery credential.
- The previous recovery credential is revoked immediately and permanently.
- Existing encrypted financial records are not re-created or lost.

## 5. FICONTER Assisted Recovery — final resort

Assisted recovery is allowed only when normal recovery methods are unavailable.

Required conditions:

- The customer explicitly requests recovery.
- The customer controls the registered FICONTER account/email.
- The customer re-authenticates before recovery completes.
- Additional identity/security verification is completed according to the recovery-risk policy.
- The customer accepts the current FICONTER Vault Recovery Consent document.
- The consent version, timestamp, recovery request id, and verification result are recorded.
- An authorized FICONTER role approves the request according to the release RBAC policy.

The recovery service may use a protected emergency key-recovery capability solely to restore the customer's ability to access the existing Vault key.

## 6. What Customer Service may and may not do

Customer Service MAY:

- Find the customer account by registered account identifiers.
- Open a recovery case.
- Guide the customer through verification.
- Record recovery consent.
- Initiate the approved recovery workflow.
- See recovery status and audit events.

Customer Service MUST NOT:

- See the customer's existing recovery code.
- See the new recovery code.
- See the readable Vault key.
- Copy, export, inspect, transfer, or browse decrypted customer financial records as part of recovery.
- Manually create a reusable customer recovery secret in an admin screen.

## 7. Emergency recovery link

After approval:

- FICONTER sends a one-time, short-lived recovery link only to the registered account email.
- Opening the link does not itself grant Vault access.
- The customer must log in/re-authenticate again.
- The recovery token must be single-use and expire automatically.
- A used, expired, cancelled, or superseded token must be rejected.

## 8. New recovery credential after assisted recovery

- The customer's browser generates the new recovery credential.
- Staff never receive or display the new credential.
- The existing Vault key is rewrapped to the new recovery credential.
- The prior recovery credential is revoked permanently.
- The customer is shown the new recovery code and must confirm recovery setup.
- The customer may revoke previous trusted devices during the recovery completion flow.

## 9. Customer consent and privacy commitment

The recovery consent must state that FICONTER is authorized only to perform the technical recovery required to restore access to the encrypted Vault.

The recovery procedure must not grant staff permission to inspect, copy, export, transfer, sell, distribute, disclose, or otherwise use the customer's financial records for unrelated purposes.

FICONTER will not sell, rent, trade, monetize, distribute, or disclose customer financial data to any third party for advertising, marketing, profiling, data-brokerage, or unrelated commercial purposes.

Any disclosure required by applicable law must be limited to what is legally required and handled under FICONTER's Privacy Policy.

Customer-facing recovery documents must refer only to FICONTER. Names of implementation, infrastructure, hosting, code-management, database, authentication, communications, analytics, monitoring, or other connected service providers must not appear in those documents.

## 10. Notifications

The customer must be notified when:

- Assisted recovery is requested.
- A recovery request is approved or rejected.
- A recovery link is issued.
- Recovery completes.
- A recovery credential is replaced.
- Trusted devices are revoked as part of recovery.

The Owner must have audit visibility into administrative recovery activity without receiving customer recovery codes, readable Vault keys, or decrypted financial data.

## 11. Audit requirements

Record at minimum:

- Recovery request id.
- Customer account id.
- Request creation time.
- Verification status.
- Consent version and timestamp.
- Staff member who handled verification.
- Approving role/user.
- Recovery link issuance time and status.
- Recovery completion/cancellation/rejection.
- Previous recovery credential revocation event.
- Trusted-device revocation events.

Never log recovery codes, raw Vault keys, derived wrapping keys, plaintext financial payloads, or decrypted documents.

## 12. Product terminology

Because FICONTER deliberately retains a consent-based emergency recovery capability, customer-facing claims must not say that FICONTER has absolutely no possible recovery capability under every circumstance.

Approved positioning for this model:

"Client-side encrypted financial data with customer-controlled recovery and consent-based FICONTER Assisted Recovery."

Normal operation must continue to prevent ordinary FICONTER staff from viewing customer financial plaintext.

## 13. Release blocker

This policy is a production-release requirement. The E2EE staging branch must not be merged into main until the assisted-recovery architecture, authorization, consent, revocation, auditing, and staging tests required by this policy have been implemented and verified.
