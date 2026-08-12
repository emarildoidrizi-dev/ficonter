-- FICONTER Currency Engine — Phase 4 rollback
begin;

drop function if exists public.record_goal_investment(
  uuid, numeric, numeric, text, numeric, timestamptz, text, date
);

notify pgrst, 'reload schema';

commit;
