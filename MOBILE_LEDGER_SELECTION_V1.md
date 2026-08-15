# FICONTER Mobile Ledger Selection V1

## Locked behavior
- Normal mobile Ledger stays clean: no permanent checkboxes and no per-row Edit/Delete buttons.
- Long-press a transaction for ~700 ms to enter selection mode.
- A subtle device vibration is requested when selection mode activates, when supported.
- After selection mode is active, normal taps select/deselect additional transactions.
- Selection toolbar provides:
  - Exit selection mode
  - Select all / Clear all for the current filtered result
  - Edit (enabled only when exactly one transaction is selected)
  - Delete (works for one or many selected transactions)
- Bulk delete keeps the existing confirmation dialog and linked Bill/debt-payment safety behavior.
- Mobile rows are compacted to approximately 58–60 px high while desktop Ledger behavior remains unchanged.
- A small helper message explains: “Press and hold a transaction to select.”

## Validation
- Existing FICONTER mobile UI Phase 6: 24/24 checks passed.
- New Ledger selection behavior: 10/10 checks passed.
