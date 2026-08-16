# FICONTER — Instant Business Switching V1

## Governance
Active Business profile selection is an immediate application action. It is a deliberate exception to FICONTER's explicit-save governance, alongside immediate language selection.

The Business switch must not require Save, Apply, or confirmation. Editable fields inside Business settings and administration remain governed by explicit Save/Apply.

## Implemented behavior
- Desktop Business selector switches on selection.
- Mobile/PWA top Business selector switches on selection.
- Mobile/PWA More-sheet Business selector switches on selection.
- Manage Businesses card opening uses the same guarded server action instead of writing the active workspace directly from the client.
- `selectedBusinessId` and `pendingBusinessId` draft state used by the old Apply workflow were removed.
- The old desktop hard-reload fallback was removed.
- The selected Business is reflected optimistically across mounted Business shell controls through a small client event bridge.
- Persistence remains centralized in `switchActiveBusinessAction` and the existing `set_active_business_workspace` database RPC.
- After persistence succeeds, `router.refresh()` reconciles server-rendered Business data through the Next.js client router. This is not a browser/full-page reload.
- While reconciliation is in flight, the previous Business module is temporarily non-interactive and visually muted so the user cannot act on stale Business A data under a Business B selector.
- If the action/database/session path fails, the previous Business ID is restored and a compact error status is shown.
- The Manage Businesses path also restores the previous active card/profile if switching fails.

## Data isolation
No Business financial records are copied or mutated during a switch. The persisted `active_business_id` only changes which already-isolated Business workspace is resolved by `getBusinessContext()`.

## Branch/source note
This package is prepared as `feature/instant-business-switching`. The uploaded source archive did not contain `.git` metadata and was named `ficonter-feature-landing-page-v2`, so Git ancestry from `main` cannot be proven from the archive itself. No landing-page behavior was intentionally modified by this patch.

## Verification
Run:

`npm run verify:instant-business-switching`

and the existing explicit-save governance check:

`npm run verify:explicit-save`
