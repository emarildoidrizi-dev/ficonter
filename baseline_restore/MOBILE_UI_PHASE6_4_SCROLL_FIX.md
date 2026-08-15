# FICONTER Mobile UI Phase 6.4 — Bottom Scroll Clearance

## Issue fixed
On mobile, the fixed bottom navigation could visually cover the final KPI/card near the end of a module, most visibly on Business → Sales. Users need to be able to scroll the last card fully above the navigation rather than have it finish underneath the dock.

## Change
- Increased the authoritative mobile page-bottom clearance from 92px to 148px on phones.
- Uses the same 148px clearance on tablets.
- Added matching `scroll-padding-bottom` to the actual `.app-main` scroll surface.
- Added a small final-child breathing margin.
- Landscape short-screen mode uses a reduced but safe 112px clearance.
- Keyboard-open behavior is unchanged: the dock hides and bottom padding contracts while typing.

## Scope
This is a mobile-shell geometry fix only. It applies globally to Personal and Business modules and does not change calculations, Supabase logic, routing, subscriptions, business switching, themes, or financial data.
