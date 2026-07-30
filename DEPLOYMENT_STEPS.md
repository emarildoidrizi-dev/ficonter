# FICONTER Release Candidate 1 — Deployment

## Recommended method

Use this package as the complete repository state rather than stacking another partial hotfix ZIP.

1. Create a backup branch from the current GitHub `main` branch.
2. Extract the Release Candidate ZIP locally.
3. Replace the repository contents with the extracted `ficonter-main` contents.
4. Delete the obsolete files listed in `FILES_TO_DELETE_AFTER_UPLOAD.txt` if they still exist.
5. Commit and push to a preview branch first.
6. Wait for Vercel to complete the production compilation.
7. Run the acceptance checks in `CONSOLIDATION_REPORT.md`.
8. Merge the preview branch into `main` only after the checks pass.

## Commit message

```text
chore(platform): consolidate FICONTER release candidate 1
```

## Supabase

No new consolidation SQL is required. Do not rerun migrations blindly. Confirm that the existing production database already contains the required Bill and Debt functions described in `CONSOLIDATION_REPORT.md`.
