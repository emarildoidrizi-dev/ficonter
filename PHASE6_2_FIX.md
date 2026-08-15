# FICONTER Mobile Phase 6.2 — Landing Login + Business Profile Fix

## Public mobile landing header
- The landing page now owns its language selector instead of relying on the global fixed control.
- `Log in` remains visible in the top header on phones <= 640px.
- Desktop marketing links remain hidden on small screens to keep the header compact.
- Mobile header order is: FICONTER brand, Log in, Language.
- The main `Start free` CTA remains the registration action, avoiding duplicate large signup controls in the small header.

## Business workspace
This package includes the prior Phase 6.1 active-business selector fix:
- Active business selector is available at the top of the mobile Business workspace.
- Switching uses the existing active-business workspace RPC/workflow.
- The current screen refreshes after a successful switch so business-specific data changes immediately.
- Archived businesses are excluded from selectable profiles.

## Scope
No financial calculations, currency conversion logic, subscription rules, permissions, database schema, or desktop financial module behavior were changed by this landing-header correction.
