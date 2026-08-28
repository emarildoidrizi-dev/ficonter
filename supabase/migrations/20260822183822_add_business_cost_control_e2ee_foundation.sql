begin;

alter table public.business_cost_budgets
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_cost_budgets
  alter column amount_base drop not null;

alter table public.business_recurring_costs
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_recurring_costs
  alter column name drop not null,
  alter column category_name drop not null,
  alter column cost_nature drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_base drop not null,
  alter column exchange_rate_to_base drop not null;

create table if not exists public.business_recurring_cost_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recurring_cost_id uuid not null references public.business_recurring_costs(id) on delete cascade,
  occurrence_key text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  transaction_id uuid references public.business_transactions(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (recurring_cost_id, occurrence_key)
);

alter table public.business_recurring_cost_runs enable row level security;
drop policy if exists business_recurring_cost_runs_select on public.business_recurring_cost_runs;
create policy business_recurring_cost_runs_select on public.business_recurring_cost_runs
for select using (public.business_member_has_access(business_id));

create or replace function public.process_business_encrypted_recurring_costs()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_cost public.business_recurring_costs%rowtype;
  v_due timestamptz;
  v_cycle_key text;
  v_next timestamptz;
  v_pending integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('ficonter:e2ee:business-recurring-costs',0)) then
    return jsonb_build_object('status','already_running','pending_created',0);
  end if;

  for v_cost in
    select cost.*
    from public.business_recurring_costs cost
    join public.businesses business
      on business.id = cost.business_id
     and business.status = 'active'
    where cost.status = 'active'
      and cost.encryption_version = 1
      and cost.encrypted_payload is not null
      and cost.next_run_at is not null
      and cost.next_run_at <= now()
    order by cost.next_run_at, cost.id
    for update of cost skip locked
  loop
    v_due := v_cost.next_run_at;
    v_cycle_key := to_char(v_due at time zone v_cost.timezone, 'YYYY-MM');

    insert into public.business_recurring_cost_runs(
      business_id, recurring_cost_id, occurrence_key, scheduled_for, status
    ) values (
      v_cost.business_id, v_cost.id, v_cycle_key, v_due, 'pending'
    ) on conflict (recurring_cost_id, occurrence_key) do nothing;
    if found then v_pending := v_pending + 1; end if;

    v_next := public.business_next_recurring_timestamp(
      v_cost.start_date,
      v_cost.due_day,
      v_cost.record_time,
      v_cost.timezone,
      v_due + interval '1 second'
    );

    if v_cost.end_date is not null
       and (v_next at time zone v_cost.timezone)::date > v_cost.end_date then
      update public.business_recurring_costs
      set status='ended', next_run_at=null, last_recorded_at=v_due, last_error=null, updated_at=now()
      where id=v_cost.id;
    else
      update public.business_recurring_costs
      set next_run_at=v_next, last_recorded_at=v_due, last_error=null, updated_at=now()
      where id=v_cost.id;
    end if;
  end loop;

  return jsonb_build_object('status','completed','pending_created',v_pending,'processed_at',now());
end;
$$;

create or replace function public.finalize_business_recurring_cost_run_e2ee(
  p_run_id uuid,
  p_transaction_id uuid,
  p_transaction_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.business_recurring_cost_runs%rowtype;
  v_cost public.business_recurring_costs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;
  if p_transaction_id is null or p_transaction_payload is null then
    raise exception 'Encrypted transaction payload is required.' using errcode='22023';
  end if;

  select * into v_run
  from public.business_recurring_cost_runs
  where id=p_run_id
  for update;
  if not found then raise exception 'Recurring cost run was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_run.business_id) then
    raise exception 'Business write access is required.' using errcode='42501';
  end if;
  if v_run.status='completed' and v_run.transaction_id is not null then
    return jsonb_build_object('id',v_run.transaction_id,'existing',true);
  end if;
  if v_run.status <> 'pending' then
    raise exception 'Recurring cost run is not pending.' using errcode='22023';
  end if;

  select * into v_cost
  from public.business_recurring_costs
  where id=v_run.recurring_cost_id and business_id=v_run.business_id;
  if not found or v_cost.encryption_version is distinct from 1 or v_cost.encrypted_payload is null then
    raise exception 'Encrypted recurring cost is unavailable.' using errcode='22023';
  end if;

  insert into public.business_transactions(
    id,business_id,created_by,source_recurring_cost_id,recurrence_key,encrypted_payload,encryption_version
  ) values (
    p_transaction_id,v_run.business_id,v_cost.created_by,v_cost.id,v_run.occurrence_key,p_transaction_payload,1
  );

  update public.business_recurring_cost_runs
  set status='completed',transaction_id=p_transaction_id,error_message=null,processed_at=now()
  where id=v_run.id;

  return jsonb_build_object('id',p_transaction_id,'existing',false);
exception
  when unique_violation then
    select transaction_id into v_run.transaction_id
    from public.business_recurring_cost_runs where id=p_run_id;
    if v_run.transaction_id is not null then
      return jsonb_build_object('id',v_run.transaction_id,'existing',true);
    end if;
    raise;
end;
$$;

revoke all on function public.finalize_business_recurring_cost_run_e2ee(uuid,uuid,jsonb) from public, anon;
grant execute on function public.finalize_business_recurring_cost_run_e2ee(uuid,uuid,jsonb) to authenticated, service_role;

revoke all on function public.process_business_encrypted_recurring_costs() from public, anon, authenticated;
grant execute on function public.process_business_encrypted_recurring_costs() to service_role;

revoke all on function public.process_business_recurring_costs() from public, anon, authenticated;
grant execute on function public.process_business_recurring_costs() to service_role;

commit;
