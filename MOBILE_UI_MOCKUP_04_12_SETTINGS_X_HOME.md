# FICONTER Mobile Mockup 04.12 — Settings X → Home

- The X button on the instant Settings sheet now closes the sheet and immediately triggers the existing direct Home action.
- If the user is already on Overview, the action only closes Settings and returns to the top without an unnecessary navigation.
- If the user opened Settings while on a Settings detail route or another module, X routes directly to `/dashboard/overview`.
- Drawer, account sheet, and Settings sheet are closed before the Home transition.
- No Supabase, financial calculations, subscription logic, or desktop navigation was changed.

Commit message: `fix(mobile): make Settings close button return directly Home`
