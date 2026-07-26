-- FICONTER Phase 2 — Goal investment recorded timestamp correction
-- Removes the unused goal target-time field introduced by the previous update.
-- Goal investments already use a timestamptz value; the application now sends
-- the exact local date and time selected when the investment is recorded.

begin;

alter table public.goals
  drop column if exists target_time;

notify pgrst, 'reload schema';

commit;
