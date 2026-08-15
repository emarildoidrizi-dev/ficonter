-- FICONTER · Automatic recurring payment recording
-- This records expected payments inside FICONTER.
-- It does not contact a bank, transfer money, or verify a bank payment.
--
-- Run this entire file once in Supabase SQL Editor.

begin;

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ============================================================================
-- Automation settings
-- ============================================================================

alter table public.bills
  add column if not exists autopay_record_time time without time zone not null default '09:00',
  add column if not exists autopay_timezone text not null default 'UTC',
  add column if not exists autopay_enabled_at timestamptz,
  add column if not exists recurrence_anchor_day smallint,
  add column if not exists recurrence_anchor_month_end boolean not null default false;

update public.bills
set
  recurrence_anchor_day = extract(day from due_date)::smallint,
  recurrence_anchor_month_end = (
    due_date = (date_trunc('month', due_date) + interval '1 month - 1 day')::date
  )
where recurrence_anchor_day is null;

alter table public.bills
  drop constraint if exists bills_recurrence_anchor_day_check;

alter table public.bills
  add constraint bills_recurrence_anchor_day_check
  check (
    recurrence_anchor_day is null
    or recurrence_anchor_day between 1 and 31
  );

alter table public.debts
  add column if not exists autopay boolean not null default false,
  add column if not exists autopay_record_time time without time zone not null default '09:00',
  add column if not exists autopay_timezone text not null default 'UTC',
  add column if not exists autopay_enabled_at timestamptz;

create index if not exists bills_automatic_schedule_idx
on public.bills (autopay, status, due_date)
where autopay = true and autopay_enabled_at is not null;

create index if not exists debts_automatic_schedule_idx
on public.debts (autopay, status, payment_due_day)
where autopay = true and autopay_enabled_at is not null;

-- Existing rows remain deliberately unarmed because autopay_enabled_at is NULL.
-- Each customer must edit and save a schedule once to activate it.

-- ============================================================================
-- Idempotent audit history
-- ============================================================================

create table if not exists public.automatic_payment_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('bill', 'debt')),
  source_id uuid not null,
  occurrence_key text not null,
  scheduled_for timestamptz not null,
  amount numeric(16,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_eur numeric(16,2) not null check (amount_eur > 0),
  transaction_id uuid references public.transactions(id) on delete set null,
  debt_payment_id uuid references public.debt_payments(id) on delete set null,
  trigger_mode text not null check (trigger_mode in ('automatic', 'manual')),
  status text not null check (status in ('completed', 'failed')),
  error_message text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_type, source_id, occurrence_key)
);

alter table public.automatic_payment_runs enable row level security;

drop policy if exists "Users can view own automatic payment runs"
on public.automatic_payment_runs;

create policy "Users can view own automatic payment runs"
on public.automatic_payment_runs
for select
using (auth.uid() = user_id);

grant select on public.automatic_payment_runs to authenticated;
revoke insert, update, delete on public.automatic_payment_runs
from authenticated, anon;

create index if not exists automatic_payment_runs_user_processed_idx
on public.automatic_payment_runs (user_id, processed_at desc);

do $$
begin
  alter publication supabase_realtime
  add table public.automatic_payment_runs;
exception
  when duplicate_object then null;
end
$$;

alter table public.automatic_payment_runs replica identity full;

-- ============================================================================
-- Date, time and recurrence helpers
-- ============================================================================

create or replace function public.ficonter_safe_timezone(p_timezone text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if p_timezone is null or btrim(p_timezone) = '' then
    return 'UTC';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    return p_timezone;
  end if;

  return 'UTC';
end;
$$;

create or replace function public.ficonter_scheduled_timestamp(
  p_date date,
  p_time time without time zone,
  p_timezone text
)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    (p_date + coalesce(p_time, time '09:00'))
    at time zone public.ficonter_safe_timezone(p_timezone);
$$;

create or replace function public.ficonter_next_bill_due_date(
  p_due_date date,
  p_recurrence text,
  p_anchor_day integer,
  p_anchor_month_end boolean
)
returns date
language plpgsql
immutable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_months integer;
  v_month_start date;
  v_month_end date;
  v_day integer;
begin
  case p_recurrence
    when 'weekly' then return p_due_date + 7;
    when 'biweekly' then return p_due_date + 14;
    when 'monthly' then v_months := 1;
    when 'quarterly' then v_months := 3;
    when 'semiannual' then v_months := 6;
    when 'yearly' then v_months := 12;
    else return null;
  end case;

  v_month_start :=
    (date_trunc('month', p_due_date)::date + make_interval(months => v_months))::date;
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  if coalesce(p_anchor_month_end, false) then
    return v_month_end;
  end if;

  v_day := least(
    greatest(coalesce(p_anchor_day, extract(day from p_due_date)::integer), 1),
    extract(day from v_month_end)::integer
  );

  return make_date(
    extract(year from v_month_start)::integer,
    extract(month from v_month_start)::integer,
    v_day
  );
end;
$$;

create or replace function public.ficonter_debt_due_date(
  p_reference_date date,
  p_due_day integer
)
returns date
language sql
immutable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with month_values as (
    select
      date_trunc('month', p_reference_date)::date as month_start,
      (date_trunc('month', p_reference_date) + interval '1 month - 1 day')::date
        as month_end
  )
  select make_date(
    extract(year from month_start)::integer,
    extract(month from month_start)::integer,
    least(
      greatest(coalesce(p_due_day, 1), 1),
      extract(day from month_end)::integer
    )
  )
  from month_values;
$$;

-- ============================================================================
-- Bill recording
-- ============================================================================

create or replace function public.ficonter_record_bill_occurrence(
  p_bill_id uuid,
  p_user_id uuid,
  p_occurrence_date date,
  p_transaction_date date,
  p_occurred_at timestamptz,
  p_trigger_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_bill public.bills%rowtype;
  v_transaction public.transactions%rowtype;
  v_run public.automatic_payment_runs%rowtype;
  v_next_due_date date;
  v_occurrence_key text := to_char(p_occurrence_date, 'YYYY-MM-DD');
begin
  if p_user_id is null then
    raise exception 'A user is required.' using errcode = '42501';
  end if;

  if p_trigger_mode not in ('automatic', 'manual') then
    raise exception 'Invalid trigger mode.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ficonter:bill:' || p_bill_id::text || ':' || v_occurrence_key,
      0
    )
  );

  select run_record.*
  into v_run
  from public.automatic_payment_runs as run_record
  where run_record.source_type = 'bill'
    and run_record.source_id = p_bill_id
    and run_record.occurrence_key = v_occurrence_key
    and run_record.status = 'completed';

  if found then
    select bill_record.*
    into v_bill
    from public.bills as bill_record
    where bill_record.id = p_bill_id
      and bill_record.user_id = p_user_id;

    if v_run.transaction_id is not null then
      select transaction_record.*
      into v_transaction
      from public.transactions as transaction_record
      where transaction_record.id = v_run.transaction_id
        and transaction_record.user_id = p_user_id;
    end if;

    return jsonb_build_object(
      'bill', to_jsonb(v_bill),
      'transaction', to_jsonb(v_transaction),
      'run', to_jsonb(v_run),
      'already_recorded', true,
      'recurring', coalesce(v_bill.recurrence, 'none') <> 'none',
      'next_due_date', v_bill.due_date
    );
  end if;

  select bill_record.*
  into v_bill
  from public.bills as bill_record
  where bill_record.id = p_bill_id
    and bill_record.user_id = p_user_id
  for update;

  if not found then
    raise exception 'The bill was not found.' using errcode = 'P0002';
  end if;

  if v_bill.status = 'cancelled' then
    raise exception 'A cancelled bill cannot be recorded.' using errcode = '22023';
  end if;

  if v_bill.recurrence = 'none' and v_bill.status = 'paid' then
    raise exception 'This one-time bill is already paid.' using errcode = '22023';
  end if;

  if v_bill.due_date <> p_occurrence_date then
    raise exception 'The bill schedule changed before it was recorded.'
      using errcode = '40001';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  )
  values (
    v_bill.user_id,
    case
      when nullif(btrim(coalesce(v_bill.company, '')), '') is null then v_bill.name
      else v_bill.name || ' · ' || v_bill.company
    end,
    v_bill.amount,
    v_bill.currency,
    v_bill.amount_eur,
    v_bill.exchange_rate_to_eur,
    p_transaction_date,
    case
      when p_trigger_mode = 'automatic' then 'Automatic bill schedule'
      else 'Bill conversion'
    end,
    'expense',
    v_bill.category,
    p_transaction_date,
    p_occurred_at
  )
  returning * into v_transaction;

  if v_bill.recurrence = 'none' then
    update public.bills
    set
      status = 'paid',
      paid_at = p_occurred_at,
      transaction_id = v_transaction.id,
      updated_at = now()
    where id = v_bill.id
      and user_id = v_bill.user_id
    returning * into v_bill;

    v_next_due_date := null;
  else
    v_next_due_date := public.ficonter_next_bill_due_date(
      v_bill.due_date,
      v_bill.recurrence,
      v_bill.recurrence_anchor_day,
      v_bill.recurrence_anchor_month_end
    );

    if v_next_due_date is null or v_next_due_date <= v_bill.due_date then
      raise exception 'The next recurring due date could not be calculated.';
    end if;

    update public.bills
    set
      status = 'pending',
      paid_at = p_occurred_at,
      transaction_id = null,
      due_date = v_next_due_date,
      updated_at = now()
    where id = v_bill.id
      and user_id = v_bill.user_id
    returning * into v_bill;
  end if;

  insert into public.automatic_payment_runs (
    user_id,
    source_type,
    source_id,
    occurrence_key,
    scheduled_for,
    amount,
    currency,
    amount_eur,
    transaction_id,
    debt_payment_id,
    trigger_mode,
    status,
    error_message,
    processed_at
  )
  values (
    v_bill.user_id,
    'bill',
    v_bill.id,
    v_occurrence_key,
    p_occurred_at,
    v_transaction.amount,
    v_transaction.currency,
    v_transaction.amount_eur,
    v_transaction.id,
    null,
    p_trigger_mode,
    'completed',
    null,
    now()
  )
  on conflict (source_type, source_id, occurrence_key)
  do update set
    user_id = excluded.user_id,
    scheduled_for = excluded.scheduled_for,
    amount = excluded.amount,
    currency = excluded.currency,
    amount_eur = excluded.amount_eur,
    transaction_id = excluded.transaction_id,
    debt_payment_id = null,
    trigger_mode = excluded.trigger_mode,
    status = 'completed',
    error_message = null,
    processed_at = now()
  returning * into v_run;

  return jsonb_build_object(
    'bill', to_jsonb(v_bill),
    'transaction', to_jsonb(v_transaction),
    'run', to_jsonb(v_run),
    'already_recorded', false,
    'recurring', v_bill.recurrence <> 'none',
    'next_due_date', v_next_due_date
  );
end;
$$;

create or replace function public.record_bill_payment_and_advance(
  p_bill_id uuid,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills%rowtype;
  v_transaction_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select bill_record.*
  into v_bill
  from public.bills as bill_record
  where bill_record.id = p_bill_id
    and bill_record.user_id = v_user_id;

  if not found then
    raise exception 'The bill was not found.' using errcode = 'P0002';
  end if;

  v_transaction_date :=
    (p_paid_at at time zone public.ficonter_safe_timezone(v_bill.autopay_timezone))::date;

  return public.ficonter_record_bill_occurrence(
    v_bill.id,
    v_user_id,
    v_bill.due_date,
    v_transaction_date,
    p_paid_at,
    'manual'
  );
end;
$$;

revoke all on function public.ficonter_record_bill_occurrence(
  uuid, uuid, date, date, timestamptz, text
) from public, anon, authenticated;

revoke all on function public.record_bill_payment_and_advance(
  uuid, timestamptz
) from public, anon;

grant execute on function public.record_bill_payment_and_advance(
  uuid, timestamptz
) to authenticated;

-- ============================================================================
-- Debt recording
-- ============================================================================

create or replace function public.ficonter_record_debt_occurrence(
  p_debt_id uuid,
  p_user_id uuid,
  p_occurrence_key text,
  p_transaction_date date,
  p_occurred_at timestamptz,
  p_trigger_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_debt public.debts%rowtype;
  v_transaction public.transactions%rowtype;
  v_payment public.debt_payments%rowtype;
  v_run public.automatic_payment_runs%rowtype;
  v_amount numeric(16,2);
  v_amount_eur numeric(16,2);
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if p_user_id is null then
    raise exception 'A user is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ficonter:debt:' || p_debt_id::text || ':' || p_occurrence_key,
      0
    )
  );

  select run_record.*
  into v_run
  from public.automatic_payment_runs as run_record
  where run_record.source_type = 'debt'
    and run_record.source_id = p_debt_id
    and run_record.occurrence_key = p_occurrence_key
    and run_record.status = 'completed';

  if found then
    select debt_record.*
    into v_debt
    from public.debts as debt_record
    where debt_record.id = p_debt_id
      and debt_record.user_id = p_user_id;

    return jsonb_build_object(
      'debt', to_jsonb(v_debt),
      'run', to_jsonb(v_run),
      'already_recorded', true
    );
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = p_user_id
  for update;

  if not found then
    raise exception 'The debt was not found.' using errcode = 'P0002';
  end if;

  if v_debt.status <> 'active' or v_debt.current_balance <= 0 then
    raise exception 'The debt is not active.' using errcode = '22023';
  end if;

  if v_debt.minimum_payment <= 0 or v_debt.payment_due_day is null then
    raise exception 'The debt has no valid monthly minimum schedule.'
      using errcode = '22023';
  end if;

  v_amount := least(v_debt.minimum_payment, v_debt.current_balance);
  v_amount_eur := least(
    v_debt.current_balance_eur,
    round(v_amount * v_debt.exchange_rate_to_eur, 2)
  );

  if v_amount <= 0 or v_amount_eur <= 0 then
    raise exception 'The scheduled debt amount is invalid.';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  )
  values (
    v_debt.user_id,
    'Debt payment · ' || v_debt.name,
    v_amount,
    v_debt.currency,
    v_amount_eur,
    v_debt.exchange_rate_to_eur,
    p_transaction_date,
    case
      when p_trigger_mode = 'automatic' then 'Automatic debt schedule'
      else 'Debt payment conversion'
    end,
    'expense',
    'Debt repayment',
    p_transaction_date,
    p_occurred_at
  )
  returning * into v_transaction;

  v_new_balance := greatest(0, v_debt.current_balance - v_amount);
  v_new_balance_eur := greatest(0, v_debt.current_balance_eur - v_amount_eur);

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    status = case when v_new_balance = 0 then 'paid_off' else status end,
    autopay = case when v_new_balance = 0 then false else autopay end,
    autopay_enabled_at =
      case when v_new_balance = 0 then null else autopay_enabled_at end,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_debt.user_id
  returning * into v_debt;

  insert into public.debt_payments (
    debt_id,
    user_id,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    paid_at,
    notes,
    transaction_id
  )
  values (
    v_debt.id,
    v_debt.user_id,
    v_amount,
    v_debt.currency,
    v_amount_eur,
    v_debt.exchange_rate_to_eur,
    p_occurred_at,
    'Automatically recorded monthly minimum',
    v_transaction.id
  )
  returning * into v_payment;

  insert into public.automatic_payment_runs (
    user_id,
    source_type,
    source_id,
    occurrence_key,
    scheduled_for,
    amount,
    currency,
    amount_eur,
    transaction_id,
    debt_payment_id,
    trigger_mode,
    status,
    error_message,
    processed_at
  )
  values (
    v_debt.user_id,
    'debt',
    v_debt.id,
    p_occurrence_key,
    p_occurred_at,
    v_amount,
    v_debt.currency,
    v_amount_eur,
    v_transaction.id,
    v_payment.id,
    p_trigger_mode,
    'completed',
    null,
    now()
  )
  on conflict (source_type, source_id, occurrence_key)
  do update set
    user_id = excluded.user_id,
    scheduled_for = excluded.scheduled_for,
    amount = excluded.amount,
    currency = excluded.currency,
    amount_eur = excluded.amount_eur,
    transaction_id = excluded.transaction_id,
    debt_payment_id = excluded.debt_payment_id,
    trigger_mode = excluded.trigger_mode,
    status = 'completed',
    error_message = null,
    processed_at = now()
  returning * into v_run;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'transaction', to_jsonb(v_transaction),
    'run', to_jsonb(v_run),
    'already_recorded', false
  );
end;
$$;

revoke all on function public.ficonter_record_debt_occurrence(
  uuid, uuid, text, date, timestamptz, text
) from public, anon, authenticated;

-- ============================================================================
-- Processor and Cron
-- ============================================================================

create or replace function public.process_automatic_payments()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, cron, pg_catalog, pg_temp
as $$
declare
  v_bill public.bills%rowtype;
  v_debt public.debts%rowtype;
  v_scheduled timestamptz;
  v_local_date date;
  v_due_date date;
  v_occurrence_key text;
  v_bill_count integer := 0;
  v_debt_count integer := 0;
  v_failure_count integer := 0;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('ficonter:automatic-payments:processor', 0)
  ) then
    return jsonb_build_object(
      'status', 'already_running',
      'bills_recorded', 0,
      'debts_recorded', 0,
      'failures', 0
    );
  end if;

  for v_bill in
    select bill_record.*
    from public.bills as bill_record
    where bill_record.autopay = true
      and bill_record.autopay_enabled_at is not null
      and bill_record.status = 'pending'
      and bill_record.amount > 0
      and bill_record.amount_eur > 0
    order by bill_record.due_date, bill_record.id
  loop
    v_scheduled := public.ficonter_scheduled_timestamp(
      v_bill.due_date,
      v_bill.autopay_record_time,
      v_bill.autopay_timezone
    );

    if v_scheduled <= now()
       and v_scheduled >= v_bill.autopay_enabled_at then
      begin
        perform public.ficonter_record_bill_occurrence(
          v_bill.id,
          v_bill.user_id,
          v_bill.due_date,
          v_bill.due_date,
          v_scheduled,
          'automatic'
        );
        v_bill_count := v_bill_count + 1;
      exception
        when others then
          v_failure_count := v_failure_count + 1;
          insert into public.automatic_payment_runs (
            user_id,
            source_type,
            source_id,
            occurrence_key,
            scheduled_for,
            amount,
            currency,
            amount_eur,
            trigger_mode,
            status,
            error_message,
            processed_at
          )
          values (
            v_bill.user_id,
            'bill',
            v_bill.id,
            to_char(v_bill.due_date, 'YYYY-MM-DD'),
            v_scheduled,
            v_bill.amount,
            v_bill.currency,
            v_bill.amount_eur,
            'automatic',
            'failed',
            left(sqlerrm, 500),
            now()
          )
          on conflict (source_type, source_id, occurrence_key)
          do update set
            scheduled_for = excluded.scheduled_for,
            amount = excluded.amount,
            currency = excluded.currency,
            amount_eur = excluded.amount_eur,
            trigger_mode = 'automatic',
            status = 'failed',
            error_message = excluded.error_message,
            processed_at = now();
      end;
    end if;
  end loop;

  for v_debt in
    select debt_record.*
    from public.debts as debt_record
    where debt_record.autopay = true
      and debt_record.autopay_enabled_at is not null
      and debt_record.status = 'active'
      and debt_record.current_balance > 0
      and debt_record.minimum_payment > 0
      and debt_record.payment_due_day is not null
    order by debt_record.id
  loop
    v_local_date :=
      (now() at time zone public.ficonter_safe_timezone(v_debt.autopay_timezone))::date;
    v_due_date := public.ficonter_debt_due_date(
      v_local_date,
      v_debt.payment_due_day
    );
    v_scheduled := public.ficonter_scheduled_timestamp(
      v_due_date,
      v_debt.autopay_record_time,
      v_debt.autopay_timezone
    );
    v_occurrence_key := to_char(v_due_date, 'YYYY-MM');

    if v_scheduled <= now()
       and v_scheduled >= v_debt.autopay_enabled_at
       and (v_debt.start_date is null or v_due_date >= v_debt.start_date)
       and (v_debt.maturity_date is null or v_due_date <= v_debt.maturity_date)
       and not exists (
         select 1
         from public.automatic_payment_runs as run_record
         where run_record.source_type = 'debt'
           and run_record.source_id = v_debt.id
           and run_record.occurrence_key = v_occurrence_key
           and run_record.status = 'completed'
       ) then
      begin
        perform public.ficonter_record_debt_occurrence(
          v_debt.id,
          v_debt.user_id,
          v_occurrence_key,
          v_due_date,
          v_scheduled,
          'automatic'
        );
        v_debt_count := v_debt_count + 1;
      exception
        when others then
          v_failure_count := v_failure_count + 1;
          insert into public.automatic_payment_runs (
            user_id,
            source_type,
            source_id,
            occurrence_key,
            scheduled_for,
            amount,
            currency,
            amount_eur,
            trigger_mode,
            status,
            error_message,
            processed_at
          )
          values (
            v_debt.user_id,
            'debt',
            v_debt.id,
            v_occurrence_key,
            v_scheduled,
            least(v_debt.minimum_payment, v_debt.current_balance),
            v_debt.currency,
            least(v_debt.minimum_payment_eur, v_debt.current_balance_eur),
            'automatic',
            'failed',
            left(sqlerrm, 500),
            now()
          )
          on conflict (source_type, source_id, occurrence_key)
          do update set
            scheduled_for = excluded.scheduled_for,
            amount = excluded.amount,
            currency = excluded.currency,
            amount_eur = excluded.amount_eur,
            trigger_mode = 'automatic',
            status = 'failed',
            error_message = excluded.error_message,
            processed_at = now();
      end;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'bills_recorded', v_bill_count,
    'debts_recorded', v_debt_count,
    'failures', v_failure_count,
    'processed_at', now()
  );
end;
$$;

revoke all on function public.process_automatic_payments()
from public, anon, authenticated;

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
  '*/15 * * * *',
  $cron$
    select public.process_automatic_payments();
  $cron$
);

comment on function public.process_automatic_payments()
is 'Records armed FICONTER Bill and Debt schedules without moving bank funds.';

notify pgrst, 'reload schema';

commit;

-- Verification:
-- select * from cron.job where jobname = 'ficonter-automatic-payments';
-- select public.process_automatic_payments();
