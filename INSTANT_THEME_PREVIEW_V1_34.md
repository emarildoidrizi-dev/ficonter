# FICONTER V1.34 — Instant Theme + Typography Preview

## Behaviour
- Clicking a theme updates the global `data-theme` and `data-resolved-theme` attributes synchronously in the click handler.
- The colour palette and V1.33 typography both consume those same attributes, so they switch in the same browser style recalculation.
- No route refresh, page reload, Supabase request or localStorage write is required to preview a theme.
- `Save appearance` remains the persistence boundary.
- Leaving Appearance or Settings without saving restores the last committed appearance.
- The PWA cache is versioned so installed clients receive the updated runtime.

## Safety rule
The preview path mutates DOM presentation only. It does not persist account preferences.
