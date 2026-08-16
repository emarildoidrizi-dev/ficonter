# FICONTER V1.23 — Explicit Save Governance

## Locked rule
User-editable values are drafts until an explicit **Save**, **Apply**, or **Confirm** action succeeds. Typing, selecting, toggling, or choosing a different option does not persist the change by itself.

Two deliberate interaction exceptions now exist because the selection itself is the confirmation: **language selection** and **active Business profile switching**. Business profile switching is an immediate workspace action, not a Settings-form draft.

If the user leaves a normal editable view without committing the draft, the last confirmed value remains the source of truth.

## Implemented coverage
- Settings preferences keep committed and draft snapshots separately.
- Theme and density selections no longer change the global interface before **Save appearance**.
- Notification and financial-preference controls remain drafts until their Save buttons are used.
- Remember-device is now a draft toggle with **Save device preference**.
- Header language selection is an immediate-confirm exception; selecting a language applies and persists it directly.
- Monthly Planner start balance no longer saves on blur; it has **Save start balance**.
- Monthly Planner breakdown presentation is visit-only and is no longer silently written to localStorage.
- Effortless Entry style uses a draft selection and **Save entry style** before changing/persisting the workflow preference.
- Admin support status uses a draft selector and **Save status**.
- Active Business-profile selection is an immediate-action exception on desktop, tablet and mobile/PWA. No separate Save/Apply/confirmation is required.

## Draft discard behavior
- Switching Settings sections restores the last committed Settings values.
- Changing Planner month restores that month’s saved start balance.
- Selecting a different support thread restores the thread’s saved status.
- Component/route unmount naturally discards unsaved form state.

## Non-persistent controls
Search boxes, filters, selection/highlight state and similar view-only controls remain immediate because they do not write user data or preferences.
