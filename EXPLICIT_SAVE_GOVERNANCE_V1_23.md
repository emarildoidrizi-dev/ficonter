# FICONTER V1.23 — Explicit Save Governance

## Locked rule
User-editable values are drafts until an explicit **Save**, **Apply**, or **Confirm** action succeeds. Typing, selecting, toggling, or choosing a different option does not persist the change by itself.

If the user leaves the relevant view without committing the draft, the last confirmed value remains the source of truth.

## Implemented coverage
- Settings preferences keep committed and draft snapshots separately.
- Theme and density selections no longer change the global interface before **Save appearance**.
- Notification and financial-preference controls remain drafts until their Save buttons are used.
- Remember-device is now a draft toggle with **Save device preference**.
- Header language selection uses a draft choice and **Save language**; the interface language changes only after the save succeeds.
- Monthly Planner start balance no longer saves on blur; it has **Save start balance**.
- Monthly Planner breakdown presentation is visit-only and is no longer silently written to localStorage.
- Effortless Entry style uses a draft selection and **Save entry style** before changing/persisting the workflow preference.
- Admin support status uses a draft selector and **Save status**.
- Business-profile selection uses an explicit **Apply** action on desktop and mobile before changing the persisted active business.

## Draft discard behavior
- Switching Settings sections restores the last committed Settings values.
- Closing the language menu without Save discards the language draft.
- Changing Planner month restores that month’s saved start balance.
- Selecting a different support thread restores the thread’s saved status.
- Leaving a Business route discards an un-applied business-profile selection.
- Component/route unmount naturally discards unsaved form state.

## Non-persistent controls
Search boxes, filters, selection/highlight state and similar view-only controls remain immediate because they do not write user data or preferences.
