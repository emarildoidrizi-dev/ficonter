# FICONTER Global Theme Governance V1.18

## Permanent rule
Changing Appearance changes the complete FICONTER application: Personal, Business, Admin, desktop, tablet and phone. Text, icons, navigation, controls, cards, forms, menus, borders, placeholders and status states consume the selected theme's semantic tokens.

## Implementation
- Added `app/theme-governance.css` as the last global presentation layer.
- Premium light themes (Ocean Mist and Sandstone) are no longer overwritten by the default Coastal Light shell.
- Personal and Business headers now consume semantic theme surfaces/text/borders.
- Mobile bottom navigation and its central Add Transaction control are theme-aware.
- Legacy mobile `--fui-*` aliases now resolve to the active global theme.
- Settings visual states use semantic success/danger/accent tokens.
- Interactive SVG icons inherit the readable foreground of their control.
- Form text, placeholders and native select options adapt to light/dark theme resolution.
- Theme transitions are limited to color/surface changes and remain immediate (140 ms); geometry is never animated.

No financial logic, permissions, subscription rules, calculations, routing or database code was changed.
