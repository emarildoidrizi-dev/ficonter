# FICONTER Mobile Back Navigation V1

Implemented a single mobile back-navigation rule across Personal, Business, and Admin.

## Behavior
- Secondary/drill-down routes show a compact Back arrow in the mobile header.
- Root screens stay clean and do not show Back.
- Back returns to the previous in-app route using client-side navigation (no full-page refresh effect).
- Direct/deep links fall back safely to the relevant workspace Overview.
- More remains the only full menu entry point.
- Logo remains branding only.
- Avatar remains Profile + Log out only.

## Root routes without Back
Personal:
- Overview
- Transactions
- Planner

Business:
- Overview
- Sales
- Transactions

Admin and secondary modules receive Back automatically.

## Commit message
`feat(mobile): add contextual back navigation across app sections`
