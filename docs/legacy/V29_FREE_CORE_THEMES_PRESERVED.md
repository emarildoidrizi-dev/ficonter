# V29 Free Core Themes — Preserved Reference

This file preserves the only unique part of the old `crispy-telegram` Codespace that was not already represented in the current FICONTER `main` branch.

## Product rule

- Free themes: `light`, `dark`, `system`
- Premium themes: remain locked for Free users
- The large Appearance subscription banner should not block access to the three core themes

The current `main` branch already implements the functional rule above in `components/SettingsWorkspace.tsx`: free users can select Light, Dark, and System; non-free themes are disabled and labelled `Personal Pro`.

## Legacy visual styling recovered from the old Codespace

```css
/* V29_FREE_CORE_THEMES */
.optionCardLocked {
  cursor: not-allowed;
  opacity: .62;
}

.optionCardLocked .optionPreview {
  filter: saturate(.55);
}

.optionTitleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.themePlanBadge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 4px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-subtle);
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .02em;
  white-space: nowrap;
}

:global(html[data-resolved-theme="dark"]) .themePlanBadge {
  background: var(--surface-raised);
  border-color: var(--border-subtle);
  color: var(--text-secondary);
}
```

## Legacy script behavior recovered

The old `APPLY_V29_FREE_CORE_THEMES.sh` script was designed to:

1. patch `SettingsWorkspace.tsx` so Light, Dark, and System remained free;
2. keep premium themes locked for Free users;
3. remove the large Appearance subscription banner;
4. append the CSS above;
5. run `npm run build`;
6. commit with `fix(appearance): keep core themes free and lock premium themes`;
7. push directly to `main`.

The old script itself should **not** be reused because it was written against a Codespace approximately 690 commits behind the current repository and performed a direct push to `main`.

## Decision

Preserve this file as the recovery record. Do not copy the old Codespace wholesale into current `main`. Any future visual refinement should be implemented against the current Appearance component and tested through a fresh branch/PR.
