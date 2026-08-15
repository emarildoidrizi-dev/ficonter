FICONTER CLEAN ROLLBACK

Purpose
-------
This package fixes the previous overlay-style rollback.

It restores the exact original mobile-stabilization baseline and removes
83 files that were introduced afterward, including:

- app/dashboard/profile/page.tsx
- components/TransactionsActivityWorkspace.tsx
- components/TransactionsActivityWorkspace.module.css
- later mobile verification scripts and mockup notes

Why this is needed
------------------
Copying an older ZIP over a newer repository restores old files but does NOT
delete files that did not exist in the old version. That is why Vercel still
found app/dashboard/profile/page.tsx and failed on the obsolete `profileOnly`
prop.

How to apply on Windows
-----------------------
1. Extract this ZIP directly into the ROOT of your local `ficonter` repository.
   The folder where package.json is located.
2. Double-click APPLY_CLEAN_ROLLBACK.bat.
3. Wait until it says CLEAN ROLLBACK COMPLETE.
4. Open GitHub Desktop.
5. Review the changes, commit, and push.

The script preserves:
- .git
- node_modules
- .env
- .env.local

Recommended commit message
--------------------------
revert(mobile): restore clean original mobile stabilization baseline
