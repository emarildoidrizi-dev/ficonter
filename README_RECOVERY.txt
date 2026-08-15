FICONTER V1.26.2 — FinancialSetupGuide Recovery

This package restores ONLY the required current files:
- components/FinancialSetupGuide.tsx
- components/FinancialSetupGuide.module.css

Do not delete FinancialSetupGuide. The current route app/dashboard/setup/page.tsx imports it.

Apply:
1. Extract this ZIP into the FICONTER repository root.
2. Replace/restore the two files under components/.
3. In GitHub Desktop, confirm both files appear as added/restored.
4. Commit: fix(build): restore required FinancialSetupGuide component
5. Push origin and wait for checks.
