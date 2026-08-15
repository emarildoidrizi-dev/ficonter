-- FICONTER BUSINESS — PHASE B3 COST CONTROL
-- Adds managed cost categories, cost centres, monthly budgets, automatic
-- recurring business costs and Cost Control analytics foundations.
--
-- Automatic recurring costs record expected expenses inside FICONTER.
-- They do not move money, contact a bank or verify an external payment.
--
-- Run this entire file once in Supabase SQL Editor.

begin;

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ==========================================================================
-- Cost Control master data
-- ==========================================================================

create table if not exists public.business_cost_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text,
  default_nature text not null default 'variable'
    check (default_nature in ('fixed', 'variable')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_cost_categories_name_unique
  on public.business_cost_categories (business_id, lower(name));

create table if not exists public.business_cost_centres (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_cost_centres_name_unique
  on public.business_cost_centres (business_id, lower(name));

create table if not exists public.business_cost_budgets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.business_cost_categories(id) on delete cascade,
  budget_month date not null,
  amount_base numeric(18, 2) not null check (amount_base >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, category_id, budget_month),
  check (extract(day from budget_month) = 1)
);

create table if not exists public.business_recurring_costs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 180),
  supplier text,
  category_id uuid references public.business_cost_categories(id) on delete set null,
  category_name text not null check (char_length(trim(category_name)) between 1 and 100),
  cost_centre_id uuid references public.business_cost_centres(id) on delete set null,
  cost_nature text not null default 'fixed'
    check (cost_nature in ('fixed', 'variable')),
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  amount_base numeric(18, 2) not null check (amount_base > 0),
  exchange_rate_to_base numeric(20, 8) not null default 1
    check (exchange_rate_to_base > 0),
  exchange_rate_date date,
  exchange_rate_source text,
  due_day smallint not null check (due_day between 1 and 31),
  record_time time without time zone not null default '09:00',
  timezone text not null default 'UTC',
  start_date date not null default current_date,
  end_date date,
  next_run_at timestamptz,
  last_recorded_at timestamptz,
  last_error text,
  payment_method text,
  reference text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

alter table public.business_transactions
  add column if not exists cost_category_id uuid
    references public.business_cost_categories(id) on delete set null,
  add column if not exists cost_centre_id uuid
    references public.business_cost_centres(id) on delete set null,
  add column if not exists source_recurring_cost_id uuid
    references public.business_recurring_costs(id) on delete set null,
  add column if not exists recurrence_key text;

create index if not exists business_cost_categories_business_idx
  on public.business_cost_categories (business_id, is_active, name);
create index if not exists business_cost_centres_business_idx
  on public.business_cost_centres (business_id, is_active, name);
create index if not exists business_cost_budgets_month_idx
  on public.business_cost_budgets (business_id, budget_month, category_id);
create index if not exists business_recurring_costs_due_idx
  on public.business_recurring_costs (status, next_run_at)
  where status = 'active';
create index if not exists business_transactions_cost_control_idx
  on public.business_transactions
    (business_id, transaction_date desc, cost_category_id, cost_centre_id)
  where type = 'expense';
create unique index if not exists business_transactions_recurring_cycle_unique
  on public.business_transactions (source_recurring_cost_id, recurrence_key)
  where source_recurring_cost_id is not null and recurrence_key is not null;

-- ==========================================================================
-- Updated-at triggers
-- ==========================================================================

drop trigger if exists business_cost_categories_touch_updated_at
  on public.business_cost_categories;
create trigger business_cost_categories_touch_updated_at
before update on public.business_cost_categories
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_cost_centres_touch_updated_at
  on public.business_cost_centres;
create trigger business_cost_centres_touch_updated_at
before update on public.business_cost_centres
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_cost_budgets_touch_updated_at
  on public.business_cost_budgets;
create trigger business_cost_budgets_touch_updated_at
before update on public.business_cost_budgets
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_recurring_costs_touch_updated_at
  on public.business_recurring_costs;
create trigger business_recurring_costs_touch_updated_at
before update on public.business_recurring_costs
for each row execute function public.business_touch_updated_at();

-- ==========================================================================
-- Default categories and cost centres
-- ==========================================================================

create or replace function public.seed_business_cost_control_defaults(
  p_business_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_cost_categories
    (business_id, name, default_nature)
  values
    (p_business_id, 'Materials', 'variable'),
    (p_business_id, 'Inventory purchases', 'variable'),
    (p_business_id, 'Rent', 'fixed'),
    (p_business_id, 'Utilities', 'fixed'),
    (p_business_id, 'Payroll', 'fixed'),
    (p_business_id, 'Contractors', 'variable'),
    (p_business_id, 'Marketing', 'variable'),
    (p_business_id, 'Software', 'fixed'),
    (p_business_id, 'Insurance', 'fixed'),
    (p_business_id, 'Transport', 'variable'),
    (p_business_id, 'Shipping', 'variable'),
    (p_business_id, 'Equipment', 'variable'),
    (p_business_id, 'Professional services', 'variable'),
    (p_business_id, 'Taxes and fees', 'variable'),
    (p_business_id, 'Bank fees', 'variable'),
    (p_business_id, 'Travel', 'variable'),
    (p_business_id, 'Other expense', 'variable')
  on conflict do nothing;

  insert into public.business_cost_centres
    (business_id, name, description)
  values
    (p_business_id, 'General Operations', 'General day-to-day business activity'),
    (p_business_id, 'Administration', 'Administrative and back-office activity'),
    (p_business_id, 'Sales & Marketing', 'Sales, promotion and customer acquisition'),
    (p_business_id, 'Production / Delivery', 'Production, fulfilment and service delivery')
  on conflict do nothing;
end;
$$;

revoke all on function public.seed_business_cost_control_defaults(uuid)
  from public, anon, authenticated;

create or replace function public.business_seed_cost_control_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_business_cost_control_defaults(new.id);
  return new;
end;
$$;

drop trigger if exists business_seed_cost_control_after_insert
  on public.businesses;
create trigger business_seed_cost_control_after_insert
after insert on public.businesses
for each row execute function public.business_seed_cost_control_after_insert();

do $$
declare
  v_business_id uuid;
begin
  for v_business_id in select id from public.businesses loop
    perform public.seed_business_cost_control_defaults(v_business_id);
  end loop;
end;
$$;

create or replace function public.business_cost_category_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.business_transactions
    set category = new.name
    where cost_category_id = new.id;

    update public.business_recurring_costs
    set category_name = new.name
    where category_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists business_cost_category_after_update
  on public.business_cost_categories;
create trigger business_cost_category_after_update
after update on public.business_cost_categories
for each row execute function public.business_cost_category_after_update();

-- Backfill existing B2 expenses into their matching managed categories and
-- the default General Operations cost centre.
update public.business_transactions transaction
set cost_category_id = category.id
from public.business_cost_categories category
where transaction.business_id = category.business_id
  and transaction.type = 'expense'
  and transaction.cost_category_id is null
  and lower(trim(transaction.category)) = lower(trim(category.name));

update public.business_transactions transaction
set cost_centre_id = centre.id
from public.business_cost_centres centre
where transaction.business_id = centre.business_id
  and transaction.type = 'expense'
  and transaction.cost_centre_id is null
  and centre.name = 'General Operations';

-- Keep each budget linked to a category from the same business.
create or replace function public.business_cost_budget_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.business_cost_categories category
    where category.id = new.category_id
      and category.business_id = new.business_id
  ) then
    raise exception 'The selected budget category does not belong to this business.';
  end if;

  new.budget_month := date_trunc('month', new.budget_month)::date;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_cost_budget_before_write
  on public.business_cost_budgets;
create trigger business_cost_budget_before_write
before insert or update on public.business_cost_budgets
for each row execute function public.business_cost_budget_before_write();

-- ==========================================================================
-- Recurring schedule helpers
-- ==========================================================================

create or replace function public.business_scheduled_timestamp(
  p_month date,
  p_due_day integer,
  p_record_time time without time zone,
  p_timezone text
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_day integer;
  v_date date;
begin
  if p_due_day not between 1 and 31 then
    raise exception 'Due day must be between 1 and 31.';
  end if;

  v_day := least(p_due_day, extract(day from v_month_end)::integer);
  v_date := make_date(
    extract(year from v_month_start)::integer,
    extract(month from v_month_start)::integer,
    v_day
  );

  return (v_date + p_record_time) at time zone p_timezone;
exception
  when invalid_parameter_value then
    raise exception 'Invalid time zone: %', p_timezone;
end;
$$;

create or replace function public.business_next_recurring_timestamp(
  p_start_date date,
  p_due_day integer,
  p_record_time time without time zone,
  p_timezone text,
  p_after timestamptz
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_after_local timestamp without time zone;
  v_month date;
  v_candidate timestamptz;
  v_candidate_local_date date;
begin
  v_after_local := p_after at time zone p_timezone;
  v_month := date_trunc(
    'month',
    greatest(v_after_local::date, p_start_date)
  )::date;

  for v_attempt in 1..36 loop
    v_candidate := public.business_scheduled_timestamp(
      v_month,
      p_due_day,
      p_record_time,
      p_timezone
    );
    v_candidate_local_date := (v_candidate at time zone p_timezone)::date;

    if v_candidate >= p_after
       and v_candidate_local_date >= p_start_date then
      return v_candidate;
    end if;

    v_month := (v_month + interval '1 month')::date;
  end loop;

  raise exception 'The next recurring cost date could not be calculated.';
end;
$$;

create or replace function public.business_recurring_cost_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_category_name text;
  v_default_nature text;
  v_recalculate boolean := false;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is null then
      raise exception 'A creator is required.';
    end if;
    v_recalculate := true;
  else
    v_recalculate :=
      new.status is distinct from old.status
      or new.due_day is distinct from old.due_day
      or new.record_time is distinct from old.record_time
      or new.timezone is distinct from old.timezone
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
      or new.next_run_at is null;
  end if;

  new.name := trim(new.name);
  new.currency := upper(new.currency);
  new.category_name := trim(new.category_name);
  new.timezone := coalesce(nullif(trim(new.timezone), ''), 'UTC');

  if new.category_id is not null then
    select category.name, category.default_nature
      into v_category_name, v_default_nature
    from public.business_cost_categories category
    where category.id = new.category_id
      and category.business_id = new.business_id;

    if v_category_name is null then
      raise exception 'The selected cost category does not belong to this business.';
    end if;

    new.category_name := v_category_name;
    if new.cost_nature is null then
      new.cost_nature := v_default_nature;
    end if;
  end if;

  if new.cost_centre_id is not null and not exists (
    select 1
    from public.business_cost_centres centre
    where centre.id = new.cost_centre_id
      and centre.business_id = new.business_id
  ) then
    raise exception 'The selected cost centre does not belong to this business.';
  end if;

  if new.status = 'active' then
    if v_recalculate then
      new.next_run_at := public.business_next_recurring_timestamp(
        new.start_date,
        new.due_day,
        new.record_time,
        new.timezone,
        now()
      );
    end if;

    if new.end_date is not null
       and (new.next_run_at at time zone new.timezone)::date > new.end_date then
      new.status := 'ended';
      new.next_run_at := null;
    end if;
  else
    new.next_run_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_recurring_cost_before_write
  on public.business_recurring_costs;
create trigger business_recurring_cost_before_write
before insert or update on public.business_recurring_costs
for each row execute function public.business_recurring_cost_before_write();

-- Keep the transaction category snapshot synchronized with a managed category,
-- while preserving custom categories when no managed category is selected.
create or replace function public.business_transaction_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_category_name text;
  v_default_nature text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is null then
      raise exception 'A creator is required.';
    end if;
  end if;

  new.currency := upper(new.currency);

  if new.type = 'income' then
    new.cost_nature := null;
    new.cost_category_id := null;
    new.cost_centre_id := null;
  else
    if new.cost_category_id is not null then
      select category.name, category.default_nature
        into v_category_name, v_default_nature
      from public.business_cost_categories category
      where category.id = new.cost_category_id
        and category.business_id = new.business_id;

      if v_category_name is null then
        raise exception 'The selected cost category does not belong to this business.';
      end if;

      new.category := v_category_name;
      new.cost_nature := coalesce(new.cost_nature, v_default_nature);
    end if;

    if new.cost_centre_id is not null and not exists (
      select 1
      from public.business_cost_centres centre
      where centre.id = new.cost_centre_id
        and centre.business_id = new.business_id
    ) then
      raise exception 'The selected cost centre does not belong to this business.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_transaction_before_write
  on public.business_transactions;
create trigger business_transaction_before_write
before insert or update on public.business_transactions
for each row execute function public.business_transaction_before_write();

-- ==========================================================================
-- Automatic monthly recurring-cost processor
-- ==========================================================================

create or replace function public.process_business_recurring_costs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost public.business_recurring_costs%rowtype;
  v_due timestamptz;
  v_due_local_date date;
  v_cycle_key text;
  v_next timestamptz;
  v_recorded integer := 0;
  v_failures integer := 0;
begin
  for v_cost in
    select *
    from public.business_recurring_costs
    where status = 'active'
      and next_run_at is not null
      and next_run_at <= now()
    order by next_run_at
    for update skip locked
  loop
    begin
      v_due := v_cost.next_run_at;
      v_due_local_date := (v_due at time zone v_cost.timezone)::date;
      v_cycle_key := to_char(v_due at time zone v_cost.timezone, 'YYYY-MM');

      insert into public.business_transactions (
        business_id,
        created_by,
        description,
        counterparty,
        type,
        category,
        cost_nature,
        cost_category_id,
        cost_centre_id,
        source_recurring_cost_id,
        recurrence_key,
        amount,
        currency,
        amount_base,
        exchange_rate_to_base,
        exchange_rate_date,
        exchange_rate_source,
        transaction_date,
        occurred_at,
        payment_method,
        reference,
        notes
      ) values (
        v_cost.business_id,
        v_cost.created_by,
        v_cost.name,
        v_cost.supplier,
        'expense',
        v_cost.category_name,
        v_cost.cost_nature,
        v_cost.category_id,
        v_cost.cost_centre_id,
        v_cost.id,
        v_cycle_key,
        v_cost.amount,
        v_cost.currency,
        v_cost.amount_base,
        v_cost.exchange_rate_to_base,
        v_cost.exchange_rate_date,
        'Automatic business recurring cost',
        v_due_local_date,
        v_due,
        v_cost.payment_method,
        v_cost.reference,
        coalesce(v_cost.notes, 'Automatic monthly business cost')
      )
      on conflict do nothing;

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
        set
          last_recorded_at = v_due,
          next_run_at = null,
          last_error = null,
          status = 'ended',
          updated_at = now()
        where id = v_cost.id;
      else
        update public.business_recurring_costs
        set
          last_recorded_at = v_due,
          next_run_at = v_next,
          last_error = null,
          updated_at = now()
        where id = v_cost.id;
      end if;

      v_recorded := v_recorded + 1;
    exception
      when others then
        v_failures := v_failures + 1;
        update public.business_recurring_costs
        set last_error = sqlerrm, updated_at = now()
        where id = v_cost.id;
    end;
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'recorded', v_recorded,
    'failures', v_failures,
    'processed_at', now()
  );
end;
$$;

revoke all on function public.process_business_recurring_costs()
  from public, anon, authenticated;

-- ==========================================================================
-- Row-Level Security
-- ==========================================================================

alter table public.business_cost_categories enable row level security;
alter table public.business_cost_centres enable row level security;
alter table public.business_cost_budgets enable row level security;
alter table public.business_recurring_costs enable row level security;

drop policy if exists business_cost_categories_select
  on public.business_cost_categories;
create policy business_cost_categories_select
on public.business_cost_categories for select
to authenticated
using (public.business_member_has_access(business_id));

drop policy if exists business_cost_categories_manage
  on public.business_cost_categories;
create policy business_cost_categories_manage
on public.business_cost_categories for all
to authenticated
using (public.business_member_can_manage(business_id))
with check (public.business_member_can_manage(business_id));

drop policy if exists business_cost_centres_select
  on public.business_cost_centres;
create policy business_cost_centres_select
on public.business_cost_centres for select
to authenticated
using (public.business_member_has_access(business_id));

drop policy if exists business_cost_centres_manage
  on public.business_cost_centres;
create policy business_cost_centres_manage
on public.business_cost_centres for all
to authenticated
using (public.business_member_can_manage(business_id))
with check (public.business_member_can_manage(business_id));

drop policy if exists business_cost_budgets_select
  on public.business_cost_budgets;
create policy business_cost_budgets_select
on public.business_cost_budgets for select
to authenticated
using (public.business_member_has_access(business_id));

drop policy if exists business_cost_budgets_manage
  on public.business_cost_budgets;
create policy business_cost_budgets_manage
on public.business_cost_budgets for all
to authenticated
using (public.business_member_can_manage(business_id))
with check (public.business_member_can_manage(business_id));

drop policy if exists business_recurring_costs_select
  on public.business_recurring_costs;
create policy business_recurring_costs_select
on public.business_recurring_costs for select
to authenticated
using (public.business_member_has_access(business_id));

drop policy if exists business_recurring_costs_manage
  on public.business_recurring_costs;
create policy business_recurring_costs_manage
on public.business_recurring_costs for all
to authenticated
using (public.business_member_can_manage(business_id))
with check (public.business_member_can_manage(business_id));

revoke all on public.business_cost_categories from anon;
revoke all on public.business_cost_centres from anon;
revoke all on public.business_cost_budgets from anon;
revoke all on public.business_recurring_costs from anon;

grant select, insert, update, delete
  on public.business_cost_categories to authenticated;
grant select, insert, update, delete
  on public.business_cost_centres to authenticated;
grant select, insert, update, delete
  on public.business_cost_budgets to authenticated;
grant select, insert, update, delete
  on public.business_recurring_costs to authenticated;

-- Add B3 tables to Supabase Realtime when they are not already present.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'business_cost_categories',
    'business_cost_centres',
    'business_cost_budgets',
    'business_recurring_costs'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end;
$$;

-- Run the recurring-cost processor every minute. The function is idempotent:
-- one recurring cost can create only one transaction per YYYY-MM cycle.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'ficonter-business-recurring-costs'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'ficonter-business-recurring-costs',
  '* * * * *',
  $cron$
    select public.process_business_recurring_costs();
  $cron$
);

comment on function public.process_business_recurring_costs()
is 'Records due FICONTER Business recurring costs without moving external funds.';

notify pgrst, 'reload schema';

commit;

-- Verification examples (run separately while logged into FICONTER):
-- select * from cron.job where jobname = 'ficonter-business-recurring-costs';
-- select public.process_business_recurring_costs();
