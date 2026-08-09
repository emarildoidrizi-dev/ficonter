FICONTER — Hide Subscription for Owner / Super Admin / Admin

Branch:
feat/subscription-phase2-paypal

What this package does:
- Hides Settings > Subscription for Owner, Super Admin and Admin accounts.
- Removes Free / Personal Pro / Business Pro / PayPal controls from those admin accounts.
- Blocks direct ?section=subscription access for admins by redirecting to Profile.
- Leaves the Subscription section unchanged for normal customers.
- Uses FICONTER's existing role-based admin verification; it is not tied to a customer email.

Fast install:
1. Extract this ZIP into the ROOT of your FICONTER repository.
2. Double-click APPLY_FIX.bat.
3. Commit and push the changed files to branch feat/subscription-phase2-paypal.

Recommended commit:
fix(subscription): hide billing plans from administrators

Files modified by the installer:
app/dashboard/settings/page.tsx
components/SettingsWorkspace.tsx

The installer creates .bak backups before changing the files.
