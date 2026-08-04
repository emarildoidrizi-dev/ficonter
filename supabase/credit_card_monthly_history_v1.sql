-- FICONTER · Credit-Card Monthly History v1
--
-- Adds permanent month-by-month statement records for the dedicated
-- Credit Cards module. The current liability remains public.debts.
--
-- Monthly records are snapshots only. Payments remain in public.debt_payments,
-- card activity remains in public.credit_card_activities, and confirmed card
-- payments remain connected to public.transactions.

begin;

create table if not exists public.credit_card_monthly_records (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  statement_balance numeric(16,2) not null check (statement_balance >= 0),
  statement_balance_eur numeric(16,2) not null check (statement_balance_eur >= 0),
  minimum_payment numeric(16,2) not null check (minimum_payment >= 0),
  minimum_payment_eur numeric(16,2) not null check (minimum_payment_eur >= 0),
  interest_charged numeric(16,2) not null default 0 check (interest_charged >= 0),
  interest_charged_eur numeric(16,2) not null default 0 check (interest_charged_eur >= 0),
  statement_date date not null,
  payment_due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_card_monthly_records_month_start_check
    check (month_start = date_trunc('month', month_start)::date),
  constraint credit_card_monthly_records_due_date_check
    check (payment_due_date >= statement_date),
  constraint credit_card_monthly_records_minimum_check
    check (minimum_payment <= statement_balance),
  constraint credit_card_monthly_records_minimum_eur_check
    check (minimum_payment_eur <= statement_balance_eur),
  constraint credit_card_monthly_records_debt_month_key
    unique (debt_id, month_start)
);

create index if not exists credit_card_monthly_records_user_month_idx
on public.credit_card_monthly_records(user_id, month_start desc);

create index if not exists credit_card_monthly_records_debt_month_idx
on public.credit_card_monthly_records(debt_id, month_start desc);

alter table public.credit_card_monthly_records enable row level security;

drop policy if exists "Users can view own credit card monthly records"
on public.credit_card_monthly_records;

create policy "Users can view own credit card monthly records"
on public.credit_card_monthly_records
for select
using (auth.uid() = user_id);

revoke insert, update, delete on public.credit_card_monthly_records
from anon, authenticated;

grant select on public.credit_card_monthly_records to authenticated;

create or replace function public.sync_credit_card_monthly_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.category, '')) <> 'credit card'
    or new.statement_date is null
    or new.payment_due_date is null
    or new.statement_balance is null
    or new.statement_balance_eur is null then
    return new;
  end if;

  insert into public.credit_card_monthly_records (
    debt_id,
    user_id,
    month_start,
    currency,
    statement_balance,
    statement_balance_eur,
    minimum_payment,
    minimum_payment_eur,
    interest_charged,
    interest_charged_eur,
    statement_date,
    payment_due_date,
    updated_at
  ) values (
    new.id,
    new.user_id,
    date_trunc('month', new.statement_date)::date,
    new.currency,
    round(new.statement_balance, 2),
    round(new.statement_balance_eur, 2),
    round(coalesce(new.minimum_payment, 0), 2),
    round(coalesce(new.minimum_payment_eur, 0), 2),
    round(coalesce(new.interest_charged, 0), 2),
    round(coalesce(new.interest_charged_eur, 0), 2),
    new.statement_date,
    new.payment_due_date,
    now()
  )
  on conflict (debt_id, month_start)
  do update set
    user_id = excluded.user_id,
    currency = excluded.currency,
    statement_balance = excluded.statement_balance,
    statement_balance_eur = excluded.statement_balance_eur,
    minimum_payment = excluded.minimum_payment,
    minimum_payment_eur = excluded.minimum_payment_eur,
    interest_charged = excluded.interest_charged,
    interest_charged_eur = excluded.interest_charged_eur,
    statement_date = excluded.statement_date,
    payment_due_date = excluded.payment_due_date,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists debts_sync_credit_card_monthly_record
on public.debts;

create trigger debts_sync_credit_card_monthly_record
after insert or update of
  category,
  currency,
  statement_balance,
  statement_balance_eur,
  minimum_payment,
  minimum_payment_eur,
  interest_charged,
  interest_charged_eur,
  statement_date,
  payment_due_date
on public.debts
for each row
execute function public.sync_credit_card_monthly_record();

insert into public.credit_card_monthly_records (
  debt_id,
  user_id,
  month_start,
  currency,
  statement_balance,
  statement_balance_eur,
  minimum_payment,
  minimum_payment_eur,
  interest_charged,
  interest_charged_eur,
  statement_date,
  payment_due_date,
  updated_at
)
select
  debt.id,
  debt.user_id,
  date_trunc('month', debt.statement_date)::date,
  debt.currency,
  round(debt.statement_balance, 2),
  round(debt.statement_balance_eur, 2),
  round(coalesce(debt.minimum_payment, 0), 2),
  round(coalesce(debt.minimum_payment_eur, 0), 2),
  round(coalesce(debt.interest_charged, 0), 2),
  round(coalesce(debt.interest_charged_eur, 0), 2),
  debt.statement_date,
  debt.payment_due_date,
  now()
from public.debts as debt
where lower(debt.category) = 'credit card'
  and debt.statement_date is not null
  and debt.payment_due_date is not null
  and debt.statement_balance is not null
  and debt.statement_balance_eur is not null
on conflict (debt_id, month_start)
do update set
  user_id = excluded.user_id,
  currency = excluded.currency,
  statement_balance = excluded.statement_balance,
  statement_balance_eur = excluded.statement_balance_eur,
  minimum_payment = excluded.minimum_payment,
  minimum_payment_eur = excluded.minimum_payment_eur,
  interest_charged = excluded.interest_charged,
  interest_charged_eur = excluded.interest_charged_eur,
  statement_date = excluded.statement_date,
  payment_due_date = excluded.payment_due_date,
  updated_at = now();

create or replace function public.save_credit_card_monthly_record(
  p_debt_id uuid,
  p_statement_balance numeric,
  p_statement_balance_eur numeric,
  p_exchange_rate numeric,
  p_statement_date date,
  p_payment_due_date date,
  p_minimum_payment numeric,
  p_minimum_payment_eur numeric,
  p_apr numeric,
  p_interest_charged numeric,
  p_interest_charged_eur numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_record public.credit_card_monthly_records%rowtype;
  v_minimum numeric(16,2);
  v_minimum_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_statement_balance is null or p_statement_balance < 0
    or p_statement_balance_eur is null or p_statement_balance_eur < 0
    or p_exchange_rate is null or p_exchange_rate <= 0
    or p_statement_date is null
    or p_payment_due_date is null
    or p_payment_due_date < p_statement_date
    or p_interest_charged is null or p_interest_charged < 0
    or p_interest_charged_eur is null or p_interest_charged_eur < 0 then
    raise exception 'Enter valid historical statement values.'
      using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card';

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  if v_debt.statement_date is null
    or p_statement_date >= v_debt.statement_date then
    raise exception 'Current or newer statements must update the live card balance.'
      using errcode = '22023';
  end if;

  v_minimum := least(
    round(p_statement_balance, 2),
    round(p_statement_balance * 0.03, 2)
  );
  v_minimum_eur := least(
    round(p_statement_balance_eur, 2),
    round(p_statement_balance_eur * 0.03, 2)
  );

  insert into public.credit_card_monthly_records (
    debt_id,
    user_id,
    month_start,
    currency,
    statement_balance,
    statement_balance_eur,
    minimum_payment,
    minimum_payment_eur,
    interest_charged,
    interest_charged_eur,
    statement_date,
    payment_due_date,
    updated_at
  ) values (
    v_debt.id,
    v_user_id,
    date_trunc('month', p_statement_date)::date,
    v_debt.currency,
    round(p_statement_balance, 2),
    round(p_statement_balance_eur, 2),
    v_minimum,
    v_minimum_eur,
    round(p_interest_charged, 2),
    round(p_interest_charged_eur, 2),
    p_statement_date,
    p_payment_due_date,
    now()
  )
  on conflict (debt_id, month_start)
  do update set
    user_id = excluded.user_id,
    currency = excluded.currency,
    statement_balance = excluded.statement_balance,
    statement_balance_eur = excluded.statement_balance_eur,
    minimum_payment = excluded.minimum_payment,
    minimum_payment_eur = excluded.minimum_payment_eur,
    interest_charged = excluded.interest_charged,
    interest_charged_eur = excluded.interest_charged_eur,
    statement_date = excluded.statement_date,
    payment_due_date = excluded.payment_due_date,
    updated_at = now()
  returning * into v_record;

  return to_jsonb(v_record);
end;
$$;

revoke all on function public.save_credit_card_monthly_record(
  uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric
)
from public, anon;

grant execute on function public.save_credit_card_monthly_record(
  uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric
)
to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'credit_card_monthly_records'
  ) then
    alter publication supabase_realtime
      add table public.credit_card_monthly_records;
  end if;
end;
$$;

commit;
