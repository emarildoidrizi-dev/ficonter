-- FICONTER Phase 1B-A
-- Fix recurring Bill/Debt automatic recording cadence.
--
-- The existing processor is scheduled every 15 minutes, which means a Bill
-- configured for 22:55 may not be recorded until the next cron run.
-- FICONTER exposes minute-level scheduling in the UI, so the backend cadence
-- must also be minute-level.
--
-- This migration is for STAGING first. It does not alter bill amounts,
-- transactions, vault keys, or E2EE ciphertext.

begin;

create extension if not exists "pg_cron";

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'ficonter-automatic-payments'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'ficonter-automatic-payments',
  '* * * * *',
  $cron$
    select public.process_automatic_payments();
  $cron$
);

comment on function public.process_automatic_payments()
is 'Records armed FICONTER Bill and Debt schedules every minute without moving bank funds.';

notify pgrst, 'reload schema';

commit;

-- Manual staging verification after db push:
-- select jobid, jobname, schedule, active
-- from cron.job
-- where jobname = 'ficonter-automatic-payments';
--
-- Expected schedule:
-- * * * * *
