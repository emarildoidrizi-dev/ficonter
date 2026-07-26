# FICONTER deployment steps

1. Upload every included file to the matching path in the GitHub `main` branch.
2. Commit with:
   `fix(platform): clear read badges instantly and dismiss document notices`
3. Wait for the newest Vercel deployment to show **Ready**.
4. Test customer and administrator inbox read states.
5. Upload, edit, and delete a test document and confirm each success banner disappears after five seconds.

No SQL or environment-variable work is required.
