# Mobile UI Phase 6.8 — Top-right account menu

- The top-right account circle is now the dedicated account control.
- Tapping it opens a compact two-action menu only: **Profile** and **Log out**.
- Profile routes directly to `/dashboard/settings?section=profile`.
- Log out uses the existing Supabase sign-out flow.
- The account actions were removed from the full navigation sheet to avoid duplication.
- The account menu closes on route change, outside tap, Escape, or when the main navigation opens.
- The existing screen-stack, swipe-back, business profile switcher, mobile shell, and bottom navigation are unchanged.
