# FICONTER V1.21 — Final Release Candidate upload

This ZIP is a **complete repository package**, not a partial hotfix.

1. Create a backup branch/tag from the current working FICONTER commit.
2. Extract this ZIP locally.
3. Replace the contents of the cloned FICONTER repository with the extracted contents.
4. Do **not** copy an older FICONTER ZIP over this version afterward.
5. In GitHub Desktop, review the changes and commit with:
   `fix(release): harden FICONTER and finalize pre-release QA`
6. Push to the current preview/release branch.
7. Wait for Vercel to complete the full Next.js + TypeScript production build.
8. If Vercel is green, perform the smoke checks in `FINAL_RELEASE_AUDIT_V1_21.md`.
9. Freeze/merge this release only after those smoke checks pass.

## Database

V1.21 does **not** introduce a new production SQL migration. Do not rerun old SQL files just because they are present in repository history.

## Important

The local audit environment could not install the full npm dependency tree, so Vercel remains the authoritative final semantic TypeScript/Next.js build gate.
