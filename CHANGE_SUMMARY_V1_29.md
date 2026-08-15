# FICONTER V1.29 — Instant Navigation + Automatic Theme Visibility

## 1. Faster navigation
- Warms the most-used Personal and Business routes immediately after the shell becomes interactive.
- Warms secondary modules during browser idle time on normal/fast connections.
- Respects Data Saver and 2G/slow-2G connections.
- Keeps per-user/per-business prefetch state across same-workspace navigation.
- Enables Next.js prefetch on desktop Personal and Business navigation links.
- Delays the route-loading indicator by 140ms so genuinely instant navigation does not look like a refresh.
- Preserves existing phone route-stack/back behavior.
- Bumps the PWA static cache generation so installed apps receive the new navigation/theme assets immediately after deployment.

## 2. Theme visibility
- Adds a final global semantic visibility layer after all historical theme/mobile CSS.
- Banners, bars, cards, panels, drawers, menus, dialogs, toolbars, financial values and controls inherit readable theme foregrounds.
- Menus, dialogs, sheets, popovers and dropdowns receive a theme-aware surface so wallpaper never sits directly behind their text.
- Financial amounts, balances, totals and numeric values use the primary foreground.
- Inputs, placeholders, options and icons automatically follow the active theme.
- The runtime WCAG contrast guard now protects phone/tablet content too.
- The guard audits only theme changes and newly-added route subtrees instead of rescanning the whole app after every text mutation.
- Strengthens faint text colors in Light/Coastal, Ocean Mist and Sandstone themes.

## Safety
- No financial calculations, Supabase schema, subscription logic, role logic or data-writing behavior is changed.
- Explicit Save/Apply governance remains unchanged.
- Language auto-confirm remains unchanged.
