# Theme contrast and monthly budget use fix

## What the overview card is for

The former **Spending rhythm** card compared completed spending in the current month with the customer's planned monthly outflow. It is useful when a monthly budget exists because it shows how much of that budget has been used.

## Confirmed calculation bug

When the budget was `0`, the earlier code forced the result to `0%`. That was misleading: spending divided by a zero budget is not 0%; the percentage is undefined.

The repaired card is called **Monthly budget use**:

- With a budget, it shows the real used percentage. Values above 100% are preserved and displayed.
- Without a budget, it shows an em dash, the amount spent this month, an explanation that no budget is set, and a link to Budget setup.
- The circular graphic is retained because it is useful when a budget exists; it no longer pretends that missing data means perfect performance.

## Confirmed theme contrast bug

The Personal overview used fixed light cream card backgrounds while dark theme text tokens were active. The automatic contrast checker also ignored CSS gradients and did not parse hex token colors, so it could choose white text for a pale card.

The repair:

- replaces fixed overview card, text, border, control, progress, and chart colors with shared theme tokens;
- applies to light and dark palettes and remains synchronized with the token-based Business workspace;
- upgrades the automatic contrast checker to WCAG AA `4.5:1` for normal text;
- accounts for gradient surfaces and hex/sRGB theme colors;
- keeps the guard active after theme, wallpaper, route content, and responsive layout changes;
- increases supporting-text contrast in the fixed light coastal palette.

## Verification

- Appearance verification suite passed.
- Focused ESLint passed.
- Next.js production build passed, including TypeScript and all Personal and Business routes.

The local build used harmless placeholder public Supabase values only for prerender verification. No credentials are included in this package.
