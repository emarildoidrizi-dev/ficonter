# FICONTER database migrations

This directory is the authoritative ordered database history starting from the
live Production schema captured on 5 August 2026.

## Baseline

`20260805000000_live_production_baseline.sql` is an exact, schema-only export of
the live Supabase `public` schema. It contains no customer table rows.

- Apply it only to a new empty Supabase project.
- Do not paste or run it against the existing FICONTER Production project.
- Before using `supabase db push` against the existing Production project, mark
  the baseline version as already applied with the Supabase migration-repair
  workflow.

## Subsequent migrations

Every schema change after the baseline must be added as one timestamped SQL file
and reviewed before execution. Do not overwrite an earlier migration after it
has been applied.

The first post-baseline migration is:

- `20260805000100_bill_paid_unpaid_reversal.sql`

The legacy standalone SQL files in `supabase/` remain temporarily for audit and
rollback reference. New changes must use this ordered directory.
