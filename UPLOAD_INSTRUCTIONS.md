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
   `fix(theme): guarantee readable surfaces and correct budget use`
7. Click **Commit to redesign/ficonter-v2**, then **Push origin**.
8. Wait for the Vercel Preview deployment to show **Ready** before testing.

The real coastal photo wallpapers remain available. The retired sidebar
atmosphere cards, Auto/Manual choice, motion controls, and their runtime effects
are removed.

This package retains the redesigned public landing experience and every earlier
coastal interface repair.

The Personal overview and Business workspace now share theme-aware surface,
text, border, control and progress tokens. The global contrast guard accounts
for gradients and enforces WCAG AA text contrast after every theme change.

The former Spending rhythm card is now Monthly budget use. It reports a real
percentage only when a monthly budget exists; otherwise it explains that no
budget is set and links to Budget setup. It never reports 0% for division by a
zero budget.

Do not combine this package with an older FICONTER ZIP after deployment; that
could restore retired code.
