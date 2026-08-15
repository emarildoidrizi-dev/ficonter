-- FICONTER Phase 2 — Goal target time
-- Adds an optional clock time to the existing goal deadline without replacing
-- or duplicating the current target_date field.

begin;

alter table public.goals
  add column if not exists target_time time without time zone;

comment on column public.goals.target_time is
  'Optional local clock time for the goal target date. Displayed using the user device locale.';

notify pgrst, 'reload schema';

commit;
