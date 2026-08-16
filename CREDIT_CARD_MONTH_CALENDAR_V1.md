# FICONTER Credit Card Month Calendar V1

Adds a dedicated full-width month-navigation bar to Credit Cards, aligned with the Monthly Planner month-navigation model.

## Behavior
- Previous/next month arrows.
- Seven-month quick navigation rail centered on the selected month.
- Active month is visibly highlighted.
- Current real-world month carries a `Current` marker.
- Direct native month picker remains available for jumping farther back/forward.
- Changing month updates statement history, activity, payments, minimum-payment record, and carry-forward view together.
- No Save/Apply action: month navigation is an immediate viewing action only.
- Responsive on desktop, tablet, and mobile/PWA with a horizontally scrollable month rail.

## Governance
- No historical statement data is rewritten by navigation.
- Current Balance / Balance Left to Pay live semantics remain unchanged.
- Historical monthly records remain immutable snapshots after save.
