# FICONTER Production Operations & Recovery Runbook

## Purpose

This runbook defines the minimum deterministic response for production incidents. It is designed to protect customer financial data first, restore availability second, and preserve evidence for diagnosis.

## Core principles

1. Never make destructive production changes while the cause of an incident is unknown.
2. Preserve customer data before attempting convenience fixes.
3. Prefer rollback to the last known-good application deployment over live patching under pressure.
4. Treat database and Storage recovery as separate concerns.
5. Do not assume a healthy web process means the database is healthy.
6. Do not disable authorization, RLS, or integrity checks to restore service.
7. Do not expose service-role credentials or monitoring tokens to the browser.

## Health checks

### Public liveness

`GET /api/health`

Expected response: HTTP 200 with `status: healthy`.

This proves the FICONTER web application can respond. It does not prove database health.

### Protected deep health

`GET /api/health?deep=1`

Header: `x-ficonter-health-token: <FICONTER_HEALTH_TOKEN>`

Expected healthy response: HTTP 200 with database status and latency.

Expected dependency failure response: HTTP 503 with `status: degraded`.

The deep check must only be used by trusted monitoring. Never publish the token.

## Incident severity

### SEV-1 — Data integrity / security

Examples:
- customer data visible to another customer
- unexplained financial record mutation or deletion
- authentication/authorization bypass
- widespread incorrect financial writes

Response:
1. Stop or disable the affected write path if it can be isolated safely.
2. Preserve logs and timestamps.
3. Do not run broad corrective SQL until the affected scope is known.
4. Identify the last known-good deployment and database state.
5. Restore service only after authorization and data-integrity checks pass.

### SEV-2 — Major outage

Examples:
- dashboard unavailable for most users
- database unavailable
- critical API returning sustained 5xx responses

Response:
1. Check `/api/health`.
2. Run the protected deep health check.
3. Inspect Vercel runtime errors and recent deployments.
4. If a recent deployment is the likely cause, roll back to the last known-good production deployment.
5. If the database is unavailable, avoid repeated migrations or schema edits; inspect Supabase service status/logs first.

### SEV-3 — Isolated feature degradation

Examples:
- document upload unavailable
- PayPal checkout unavailable
- notifications/realtime temporarily degraded

Response:
1. Keep unrelated financial modules operational.
2. Show a controlled user-facing error in the affected feature.
3. Do not widen the incident by changing shared infrastructure unnecessarily.

## Application rollback

FICONTER production is deployed from protected GitHub `main` through Vercel.

When a newly deployed version introduces a regression:
1. Confirm the prior production deployment was healthy.
2. Roll back/promote the last known-good deployment in Vercel, or revert the responsible GitHub commit through a PR.
3. Verify `/api/health` after rollback.
4. Re-test the affected user workflow.
5. Fix forward on a branch; never patch protected `main` directly.

## Database recovery

Database recovery protects structured records such as transactions, bills, debts, goals, business records, subscription state, settings, and support data.

Current operational rule:
- Never assume Supabase Free provides a production recovery guarantee.
- Before wider external use, maintain an explicit database backup strategy.
- Any restore must select a point before the destructive/corrupting event.
- Restoring a database can require downtime and does not restore deleted Storage objects.

Before a destructive schema/data operation:
1. Confirm the exact affected tables/functions.
2. Prefer additive/backward-compatible migrations.
3. Validate on a preview/staging environment when practical.
4. Record the intended rollback path.

## Storage recovery

Supabase database backups do not restore the binary contents of Storage buckets.

Critical FICONTER Storage includes customer financial and business documents, profile images, recovery consent documents, and other uploaded assets.

Operational rule:
- Treat Storage backup as an independent requirement.
- Do not rely on database metadata as proof an object can be restored.
- Before wider launch, maintain an off-platform or otherwise independent copy strategy for critical Storage objects where legally and cryptographically appropriate.

## Financial write integrity

Multi-record financial operations should use atomic database functions where the workflow spans multiple linked records. If any step fails, the operation should fail without leaving a partial financial state.

Never replace an atomic operation with sequential client-side writes merely for convenience.

## External dependency failure

### PayPal
- Existing customer access must not depend on PayPal being reachable on every page load.
- Failed checkout/webhook processing must not mutate a subscription into an unverified paid state.

### Email
- Email delivery problems must not block core financial functionality.

### Realtime
- Temporary realtime loss must not be treated as data loss.
- Reconnect/reconcile from the authoritative database state.

### Storage
- A Storage outage must not make unrelated financial modules unavailable.

## Monitoring thresholds

Initial operational objectives:
- unexpected HTTP 5xx increase: investigate immediately
- sustained database health-check latency above normal baseline: investigate
- repeated authentication failures outside expected user behavior: investigate
- repeated PayPal webhook failures: investigate before live billing
- sustained Storage errors: isolate Documents/uploads from core finance

Thresholds should be calibrated from real usage rather than guessed permanently.

## After every incident

1. Identify root cause.
2. Document customer/data impact.
3. Add a regression test where possible.
4. Add a guardrail that prevents the same failure class.
5. Verify production after the fix.
6. Do not close the incident until data consistency is confirmed.
