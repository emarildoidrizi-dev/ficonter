# FICONTER V1.21 — Deployment gate

1. Back up the current branch.
2. Upload the complete V1.21 repository package.
3. Commit: `fix(release): harden FICONTER and finalize pre-release QA`
4. Push to Vercel Preview first.
5. Require a green Vercel production compile/typecheck.
6. Test login, Overview, Transactions, Add Transaction (+), Planner, More, Profile/Settings, language, theme, Back navigation, Business switching, and Admin authorization.
7. Test one real save/edit/delete cycle with a disposable test record.
8. Confirm mobile phone and tablet/iPad behavior separately.
9. If all checks pass, promote/merge and freeze the release.

No new SQL migration is required by V1.21.
