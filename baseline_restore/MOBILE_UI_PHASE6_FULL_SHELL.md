# FICONTER Mobile UI Phase 6 — Full Shell & UI Redesign

## Design direction: Quiet Control

Phase 6 changes the mobile presentation from a responsive website treatment into a coherent phone/tablet application shell. It is intentionally practical, calm, and thumb-friendly rather than decorative.

### Shell

- Replaced the hamburger-style header identity with a compact FICONTER mark.
- The current section remains visible in the top command bar.
- The Personal/Business badge is now an immediate workspace switch target.
- Replaced the floating bottom pill with an edge-anchored navigation bar for predictable thumb targets and more usable width.
- Quick Add remains centered and prominent.
- Replaced the long side drawer with a bottom-sheet More menu.
- More menu uses compact two-column navigation tiles on phones and three columns on tablets/short landscape screens.
- Subscription locks, active-route state, workspace switching, sign-out, focus containment, Escape close, prefetching and route behavior are preserved.

### Visual system

- Added `app/mobile-shell-v2.css` as the final mobile-only visual authority.
- Unified radius, spacing, shadows, typography and surface hierarchy.
- Reduced oversized headings and heavy card decoration.
- Stabilized list rows, summary cards, forms, tables and settings panels.
- Kept selected FICONTER themes as the source of truth for financial content colors.
- Kept application chrome on a stable neutral charcoal/gold palette to prevent navigation color instability.
- Phone/tablet only; desktop presentation is not targeted by this stylesheet.

### Module treatment

The V2 layer includes explicit treatment for:

- Overview
- Transactions
- Monthly Planner
- Bills
- Credit Cards
- Debt
- Goals
- Savings
- Cash Flow
- Net Worth
- Financial GPS
- Settings
- Business Overview
- Business Transactions
- Sales
- Business Manager
- Inventory
- Suppliers
- Reports
- Dense financial tables and bottom-sheet dialogs

### Ergonomics retained

- 48px minimum practical targets.
- Keyboard-aware bottom navigation hiding.
- Safe-area support.
- Visible-viewport modal sizing.
- Small phone overrides.
- Landscape overrides.
- Tablet-specific layout.
- Reduced-motion support.
- Drawer/sheet background scroll lock and keyboard focus containment.

## Important

This phase changes presentation and navigation structure only. It does not alter Supabase schemas, financial calculations, subscription rules, currency conversion, realtime synchronization, or business logic.
