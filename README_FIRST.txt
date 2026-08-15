FICONTER VERCEL BUILD CLEANUP

WHY THE BUILD FAILED
The repository still contained old rollback copies under baseline_restore/upload-to-repository.
The root tsconfig includes **/*.ts and **/*.tsx, so Vercel type-checked those stale duplicate files and reported incompatible props/theme exports.

WHAT THIS FIX DOES
1. Deletes baseline_restore/.
2. Deletes upload-to-repository/.
3. Removes rollback helper files and stale tsconfig.tsbuildinfo.
4. Restores the approved FICONTER Mobile Unified V1 source.
5. Adds baseline_restore and upload-to-repository to tsconfig exclusions as a second safety guard.
6. Does NOT delete .git, node_modules, .env, or .env.local.

HOW TO USE
1. Extract this ZIP INTO the root of your local FICONTER repository (the folder that contains .git and package.json).
2. Run APPLY_VERCEL_BUILD_CLEANUP.bat.
3. Open GitHub Desktop.
4. Commit all resulting changes.
5. Push origin.
6. Let Vercel redeploy.

COMMIT MESSAGE
fix(build): remove stale rollback sources from production typecheck
