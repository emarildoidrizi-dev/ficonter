# Legacy SQL status

The standalone SQL files directly under `supabase/` predate the ordered
migration baseline. They are retained temporarily for audit, rollback and
historical traceability.

They are not an ordered deployment mechanism. The active database source of
truth is now:

1. `supabase/migrations/20260805000000_live_production_baseline.sql`
2. every later timestamped file in `supabase/migrations/`

Do not combine or rerun the legacy files against Production without a reviewed
migration plan because several of them redefine the same functions.
