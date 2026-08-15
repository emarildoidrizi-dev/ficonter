# FICONTER V1.30 — Planner headers + Profile in Settings

## Monthly Planner
- Replaces large fixed pastel section banners with compact theme-aware headers.
- Uses the current theme surface and foreground tokens in every theme.
- Preserves category identity with a restrained accent marker/edge.
- Uses previously empty header space to show the live Actual total.
- Goals shows the live Invested total.
- Mobile headers remain compact and readable.

## Settings
- Restores Profile as the first Settings section.
- `/dashboard/settings?section=profile` now stays inside Settings.
- Profile photo, full name, display name and login-email controls remain explicit-save/confirmation flows.
- The dedicated Profile page remains available and now links directly to the restored Settings Profile section.

## Safety
- No financial calculations or data sources were changed.
- No subscription/admin entitlement logic was changed.
- Existing fast navigation and global theme visibility work from V1.29 are preserved.
