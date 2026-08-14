# FICONTER Mobile UI Standard v1 — Locked

This build locks the approved mobile direction as the implementation baseline.

## Activity / Transactions
- Mobile header title is **Activity**.
- Activity now has an instant two-view switch: **Add transaction** / **Ledger**.
- Switching views is local UI state: no route reload and no long scroll between the form and ledger.
- The center quick-add action automatically returns Activity to **Add transaction**.
- Desktop continues to show the full entry + ledger workspace together.

## Mobile Ledger
- The permanent long control stack is replaced on mobile by:
  - Search
  - Filter
  - Date range
  - Tools
- CSV/PDF exports live under **Tools** on mobile.
- Detailed filters open only when requested.
- The transaction list is more compact and app-like.
- Existing edit/delete/bulk/export logic remains connected.

## Overview continuity
- Saved profile photo fills the circular avatar control.
- The greeting is larger and higher-contrast over daypart wallpapers.
- Existing full-screen wallpaper and compact shell work is retained.

## Desktop safety
The new Activity switching behavior is scoped to native mobile mode. Desktop retains the existing full workspace structure.
