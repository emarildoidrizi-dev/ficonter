# FICONTER Guided Financial Setup

## Upload

Upload every file in this package to the identical path in the GitHub repository. Create the new folders and files where required, and replace the listed existing files.

## Deployment

1. Upload all files from this package.
2. Commit the changes.
3. Allow Vercel to deploy the new commit.
4. Open `/dashboard` and confirm that the Financial Profile card appears above the KPI cards.
5. Open `/dashboard/setup` from the card or the profile menu.
6. Test income-only data: the profile must remain incomplete and score readiness must remain Pending.
7. Add an expense: score readiness must become Preliminary.
8. Confirm zero-value areas such as no debt or no bills, then verify the progress percentage updates.
9. Create a Monthly Planner plan and confirm completion updates without refreshing the browser.

## Database and configuration

- No Supabase SQL migration is required.
- No environment-variable changes are required.
- No file deletion is required.
- Setup confirmations are stored in authenticated user metadata under `ficonter_setup`.
- The feature never creates, moves, reserves or duplicates financial amounts.

## Verification

Run:

```bash
npm run verify:financial-setup
```

## Commit message

```text
feat(onboarding): add guided financial setup and score readiness
```
