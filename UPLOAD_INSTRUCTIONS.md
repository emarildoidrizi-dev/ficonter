# Upload instructions

This is a **complete repository package** for `redesign/ficonter-v2`.

1. Extract this ZIP on your computer. Do not upload the ZIP file itself to GitHub.
2. Open the existing FICONTER repository in GitHub Desktop.
3. Confirm **Current branch** is `redesign/ficonter-v2`.
4. Copy everything from the extracted project folder into the root of the cloned
   FICONTER folder. Choose **Replace the files in the destination** when Windows
   asks.
5. Delete every obsolete path listed in `FILES_TO_DELETE_AFTER_UPLOAD.txt` if it
   still exists.
6. In GitHub Desktop, use the summary:
   `fix(overview): synchronize cash-flow columns with totals`
7. Click **Commit to redesign/ficonter-v2**, then **Push origin**.
8. Wait for the Vercel Preview deployment to show **Ready** before testing.

The real coastal photo wallpapers remain available. The retired sidebar
atmosphere cards, Auto/Manual choice, motion controls, and their runtime effects
are removed.

The Overview cash-flow chart now compares the current month's Income and Spent
totals on one proportional scale. The two figures shown above the chart are the
exact values used to determine the column heights.

Do not combine this package with an older FICONTER ZIP after deployment; that
could restore retired code.
