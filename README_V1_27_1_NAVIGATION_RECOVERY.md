# FICONTER V1.27.1 — Navigation Recovery + Safe Language Auto-Confirm

Purpose: recover global client interaction after V1.27 without changing module routes, permissions, subscription logic, or financial behavior.

Changes:
- Restores the last stable global LanguageProvider behavior.
- Keeps language selection as the one explicit-save exception: choosing a language confirms and persists it, with no Save button.
- Avoids optimistic global language mutation before account persistence succeeds.
- Bumps the PWA static cache generation so installed clients discard stale static bundles/assets after deployment.
- Updates only the two affected verification contracts.

After deployment:
1. Wait for Vercel Production to be Ready.
2. Fully close any open FICONTER browser tab / installed PWA window once.
3. Reopen FICONTER. On desktop browser, Ctrl+Shift+R can be used once instead.
4. Test Overview -> Transactions -> Planner -> More -> Profile menu -> Log out.
5. Test one language change and confirm there is no separate Save button.
