# FICONTER Responsive Navigation V1.13

## Locked rule

### Phones
- Settings/drill-down children replace the parent content area.
- One tap -> one client-side route -> one slide -> stop.
- Back reverses the phone page stack.
- Rotation keeps the phone behavior because device class, not viewport width alone, owns the rule.

### Tablets / iPads / larger touch layouts
- No page-stack slide for Settings section selection.
- Settings navigation and the selected detail remain in the larger-screen in-page workspace.
- Section switching is local React state for immediate response with no route wait.

### Profile governance
- Profile is removed from the Settings section list.
- `/dashboard/settings?section=profile` redirects to `/dashboard/profile`.
- The avatar/profile menu remains the navigation entry point for Profile.
- Settings copy no longer describes profile management.
