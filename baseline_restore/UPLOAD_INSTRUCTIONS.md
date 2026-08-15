# Upload instructions

This is a **complete repository package** for `redesign/ficonter-v2`.

1. Extract this ZIP on your computer. Do not upload the ZIP file itself to GitHub.
2. In Supabase, open **SQL Editor**, paste the complete contents of
   `MONTHLY_BUDGET_SUPABASE.sql`, and click **Run** once. A successful result may
   say `Success. No rows returned.`
3. Open the existing FICONTER repository in GitHub Desktop.
4. Confirm **Current branch** is `redesign/ficonter-v2`.
5. Copy everything from the extracted project folder into the root of the cloned
   FICONTER folder. Choose **Replace the files in the destination** when Windows
   asks.
6. Delete every obsolete path listed in `FILES_TO_DELETE_AFTER_UPLOAD.txt` if it
   still exists.
7. In GitHub Desktop, use the summary:
   `feat(planner): synchronize monthly spending budget`
8. Click **Commit to redesign/ficonter-v2**, then **Push origin**.
9. Wait for the Vercel Preview deployment to show **Ready** before testing.

The Monthly Planner now contains a dedicated **Monthly budget** card for the
selected month. Saving that amount updates the Overview's **Monthly budget use**
card from the same database record. The Overview reports completed spending in
real time, preserves honest percentages above 100%, and shows a clear unset
state instead of inventing a 0% result.

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

Paid customers now receive synchronized real coastal photographs for morning
(00:00–11:59), afternoon (12:00–17:59) and evening (18:00–23:59), using the
customer's local device time. The same schedule is active in Personal and
Business. Free customers always keep one fixed Coastal Beach photograph.

Appearance Settings shows the active plan behavior instead of conflicting
manual scene or wallpaper-off controls.

The public landing page now changes as one complete language surface. Its hero,
navigation, feature copy, financial demo, privacy copy, calls to action, image
descriptions and accessibility labels are translated in English, German,
Spanish, Albanian, Arabic, Portuguese, Italian and Russian. Arabic retains RTL
layout. The localization verification now includes the redesigned landing page,
so a future English-only phrase will fail the release check instead of reaching
deployment.

Do not combine this package with an older FICONTER ZIP after deployment; that
could restore retired code.
