# FICONTER V1.26.1 — Quality Gate Cleanup

The GitHub quality gate was discovering every `scripts/verify-*.mjs` file in the repository. Old verification files left behind by ZIP-overwrite updates were therefore treated as current release suites and caused the PR check to fail even though Vercel deployed successfully.

## Fix
- The release candidate verifier now uses an explicit current-release suite manifest.
- Retired/unlisted verify scripts are ignored by the quality gate instead of failing the release.
- `CLEANUP_RETIRED_VERIFY_SCRIPTS.bat` deletes the known obsolete root-level verification files so Git records them as deletions.
- Historical verification files under `scripts/historical/` are preserved.

## Apply
1. Extract this package over the repository.
2. Run `CLEANUP_RETIRED_VERIFY_SCRIPTS.bat` once.
3. In GitHub Desktop, confirm the retired scripts show as deleted.
4. Commit and push.
5. The PR quality gate should rerun using only the current release manifest.
