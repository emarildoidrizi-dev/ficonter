begin;

create or replace function public.ficonter_replace_superseded_bill_occurrence()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_latest_run public.automatic_payment_runs%rowtype;
  v_latest_occurrence_date date;
begin
  -- Only consider recurring Bills that have already recorded at least one
  -- occurrence and whose next due date was advanced by automation.
  if old.paid_at is null
     or old.recurrence = 'none'
     or new.due_date is null
     or old.due_date is null
     or new.due_date >= old.due_date then
    return new;
  end if;

  select run_record.*
  into v_latest_run
  from public.automatic_payment_runs as run_record
  where run_record.source_type = 'bill'
    and run_record.source_id = old.id
    and run_record.user_id = old.user_id
    and run_record.status = 'completed'
  order by run_record.processed_at desc nulls last,
           run_record.scheduled_for desc nulls last,
           run_record.id desc
  limit 1;

  if not found then
    return new;
  end if;

  begin
    v_latest_occurrence_date := v_latest_run.occurrence_key::date;
  exception
    when others then
      return new;
  end;

  -- A reschedule that moves the Bill back to the latest recorded occurrence
  -- (or earlier) is a replacement of that occurrence, not a new charge.
  -- Future-cycle edits (for example Sep 21 -> Sep 15 after an Aug payment)
  -- remain historical-safe because Sep 15 is still later than the Aug run.
  if new.due_date > v_latest_occurrence_date then
    return new;
  end if;

  delete from public.automatic_payment_runs
  where id = v_latest_run.id;

  if v_latest_run.transaction_id is not null then
    delete from public.transactions
    where id = v_latest_run.transaction_id
      and user_id = old.user_id;
  end if;

  new.paid_at := null;
  new.transaction_id := null;
  new.status := 'pending';

  return new;
end;
$$;

revoke all on function public.ficonter_replace_superseded_bill_occurrence() from public, anon, authenticated;

drop trigger if exists bills_replace_superseded_occurrence on public.bills;
create trigger bills_replace_superseded_occurrence
before update of due_date on public.bills
for each row
execute function public.ficonter_replace_superseded_bill_occurrence();

comment on function public.ficonter_replace_superseded_bill_occurrence() is
  'When a recurring Bill is edited back into its latest already-recorded occurrence, removes that superseded Bill-generated transaction/run so the replacement is counted once while older genuine history is preserved.';

notify pgrst, 'reload schema';

commit;
