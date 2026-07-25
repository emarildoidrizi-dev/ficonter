-- FICONTER Phase 1 — QA Finalization
-- Run once in Supabase SQL Editor before deploying the matching application files.
-- Idempotent: safe to run again after a partial deployment.

begin;

-- Replace existing RPC definitions safely. PostgreSQL does not allow
-- CREATE OR REPLACE FUNCTION to remove parameter defaults, so drop the
-- existing signatures inside this transaction before recreating them.
drop function if exists public.record_goal_investment(uuid, numeric, timestamptz, text);
drop function if exists public.reverse_goal_investment(uuid);
drop function if exists public.delete_goal_with_investments(uuid);
drop function if exists public.mark_bill_paid(uuid, timestamptz, date);
drop function if exists public.delete_bill_with_transaction(uuid);
drop function if exists public.record_debt_payment_atomic(uuid, numeric, numeric, numeric, timestamptz, text, date);
drop function if exists public.reverse_debt_payment_atomic(uuid);
drop function if exists public.delete_debt_with_payments(uuid);
drop function if exists public.delete_all_financial_records();

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Transaction compatibility
-- ---------------------------------------------------------------------------

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income', 'expense', 'saving'));

-- ---------------------------------------------------------------------------
-- Goals and atomic goal investments
-- ---------------------------------------------------------------------------

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  target_amount numeric(16,2) not null check (target_amount > 0),
  current_amount numeric(16,2) not null default 0 check (current_amount >= 0),
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_investments (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(16,2) not null check (amount > 0),
  invested_at timestamptz not null,
  notes text,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists goals_user_status_idx
  on public.goals(user_id, status, created_at);
create index if not exists goal_investments_user_date_idx
  on public.goal_investments(user_id, invested_at desc);
create index if not exists goal_investments_goal_date_idx
  on public.goal_investments(goal_id, invested_at desc);
create unique index if not exists goal_investments_transaction_uidx
  on public.goal_investments(transaction_id);

alter table public.goals enable row level security;
alter table public.goal_investments enable row level security;

revoke all on public.goals from anon;
grant select, insert, update, delete on public.goals to authenticated;
revoke all on public.goal_investments from anon;

drop policy if exists "Users can view own goals" on public.goals;
create policy "Users can view own goals"
on public.goals for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own goals" on public.goals;
create policy "Users can create own goals"
on public.goals for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals"
on public.goals for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals"
on public.goals for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view own goal investments" on public.goal_investments;
create policy "Users can view own goal investments"
on public.goal_investments for select to authenticated
using (auth.uid() = user_id);

-- No direct goal-investment mutations: database functions keep progress and
-- linked cash-flow transactions synchronized atomically.
revoke insert, update, delete on public.goal_investments from anon, authenticated;
grant select on public.goal_investments to authenticated;

create or replace function public.record_goal_investment(
  p_goal_id uuid,
  p_amount numeric,
  p_invested_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals;
  v_investment public.goal_investments;
  v_transaction public.transactions;
  v_next_amount numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid investment amount.';
  end if;

  select * into v_goal
  from public.goals
  where id = p_goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found.';
  end if;

  if v_goal.status = 'paused' then
    raise exception 'Resume this goal before recording an investment.';
  end if;

  if p_amount > greatest(0, v_goal.target_amount - v_goal.current_amount) then
    raise exception 'Investment cannot exceed the remaining goal amount.';
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
  ) values (
    v_user_id,
    'Goal investment · ' || v_goal.name,
    p_amount,
    'EUR',
    p_amount,
    1,
    p_invested_at::date,
    'Goal investment',
    'saving',
    'General savings',
    p_invested_at::date,
    p_invested_at
  )
  returning * into v_transaction;

  v_next_amount := least(v_goal.target_amount, v_goal.current_amount + p_amount);

  update public.goals
  set
    current_amount = v_next_amount,
    status = case
      when v_next_amount >= target_amount then 'completed'
      when status = 'completed' then 'active'
      else status
    end,
    updated_at = now()
  where id = v_goal.id
  returning * into v_goal;

  insert into public.goal_investments (
    goal_id,
    user_id,
    amount,
    invested_at,
    notes,
    transaction_id
  ) values (
    v_goal.id,
    v_user_id,
    p_amount,
    p_invested_at,
    nullif(btrim(p_notes), ''),
    v_transaction.id
  )
  returning * into v_investment;

  return jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'investment', to_jsonb(v_investment),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

create or replace function public.reverse_goal_investment(
  p_investment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_investment public.goal_investments;
  v_goal public.goals;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_investment
  from public.goal_investments
  where id = p_investment_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Investment not found.';
  end if;

  select * into v_goal
  from public.goals
  where id = v_investment.goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found.';
  end if;

  update public.goals
  set
    current_amount = greatest(0, current_amount - v_investment.amount),
    status = case when status = 'completed' then 'active' else status end,
    updated_at = now()
  where id = v_goal.id
  returning * into v_goal;

  delete from public.transactions
  where id = v_investment.transaction_id and user_id = v_user_id;

  -- transaction_id uses ON DELETE CASCADE, so the investment row is removed
  -- with the linked transaction. This explicit delete is harmless if already gone.
  delete from public.goal_investments
  where id = v_investment.id and user_id = v_user_id;

  return jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'investment', to_jsonb(v_investment)
  );
end;
$$;

create or replace function public.delete_goal_with_investments(
  p_goal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals;
  v_transaction_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_goal
  from public.goals
  where id = p_goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found.';
  end if;

  select coalesce(array_agg(transaction_id), '{}'::uuid[])
  into v_transaction_ids
  from public.goal_investments
  where goal_id = p_goal_id and user_id = v_user_id;

  delete from public.goals
  where id = p_goal_id and user_id = v_user_id;

  if cardinality(v_transaction_ids) > 0 then
    delete from public.transactions
    where user_id = v_user_id and id = any(v_transaction_ids);
  end if;

  return jsonb_build_object('goal', to_jsonb(v_goal));
end;
$$;

revoke all on function public.record_goal_investment(uuid, numeric, timestamptz, text)
  from public, anon;
revoke all on function public.reverse_goal_investment(uuid)
  from public, anon;
revoke all on function public.delete_goal_with_investments(uuid)
  from public, anon;
grant execute on function public.record_goal_investment(uuid, numeric, timestamptz, text)
  to authenticated;
grant execute on function public.reverse_goal_investment(uuid)
  to authenticated;
grant execute on function public.delete_goal_with_investments(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic bill settlement and deletion
-- ---------------------------------------------------------------------------

create or replace function public.mark_bill_paid(
  p_bill_id uuid,
  p_paid_at timestamptz,
  p_transaction_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills;
  v_transaction public.transactions;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_bill
  from public.bills
  where id = p_bill_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Bill not found.';
  end if;

  if v_bill.status = 'cancelled' then
    raise exception 'A cancelled bill cannot be marked paid.';
  end if;

  if v_bill.status = 'paid' and v_bill.transaction_id is not null then
    return jsonb_build_object('bill', to_jsonb(v_bill));
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
  ) values (
    v_user_id,
    'Bill payment · ' || v_bill.name,
    v_bill.amount,
    v_bill.currency,
    v_bill.amount_eur,
    v_bill.exchange_rate_to_eur,
    p_transaction_date,
    'Bill payment conversion',
    'expense',
    v_bill.category,
    p_transaction_date,
    p_paid_at
  )
  returning * into v_transaction;

  update public.bills
  set
    status = 'paid',
    paid_at = p_paid_at,
    transaction_id = v_transaction.id,
    updated_at = now()
  where id = v_bill.id
  returning * into v_bill;

  return jsonb_build_object(
    'bill', to_jsonb(v_bill),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

create or replace function public.delete_bill_with_transaction(
  p_bill_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_bill
  from public.bills
  where id = p_bill_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Bill not found.';
  end if;

  delete from public.bills
  where id = v_bill.id and user_id = v_user_id;

  if v_bill.transaction_id is not null then
    delete from public.transactions
    where id = v_bill.transaction_id and user_id = v_user_id;
  end if;

  return jsonb_build_object('bill', to_jsonb(v_bill));
end;
$$;

revoke all on function public.mark_bill_paid(uuid, timestamptz, date)
  from public, anon;
revoke all on function public.delete_bill_with_transaction(uuid)
  from public, anon;
grant execute on function public.mark_bill_paid(uuid, timestamptz, date)
  to authenticated;
grant execute on function public.delete_bill_with_transaction(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic debt payments, reversals and deletion
-- ---------------------------------------------------------------------------

create or replace function public.record_debt_payment_atomic(
  p_debt_id uuid,
  p_amount numeric,
  p_amount_eur numeric,
  p_exchange_rate numeric,
  p_paid_at timestamptz,
  p_notes text,
  p_exchange_rate_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts;
  v_payment public.debt_payments;
  v_transaction public.transactions;
  v_new_balance numeric;
  v_new_balance_eur numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_debt
  from public.debts
  where id = p_debt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > v_debt.current_balance then
    raise exception 'Invalid payment amount.';
  end if;

  if p_amount_eur is null or p_amount_eur <= 0 or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Invalid EUR conversion.';
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
  ) values (
    v_user_id,
    'Debt payment · ' || v_debt.name,
    p_amount,
    v_debt.currency,
    p_amount_eur,
    p_exchange_rate,
    p_exchange_rate_date,
    'Debt payment conversion',
    'expense',
    'Debt repayment',
    p_exchange_rate_date,
    p_paid_at
  )
  returning * into v_transaction;

  v_new_balance := greatest(0, v_debt.current_balance - p_amount);
  v_new_balance_eur := greatest(0, v_debt.current_balance_eur - p_amount_eur);

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    status = case when v_new_balance = 0 then 'paid_off' else status end,
    updated_at = now()
  where id = v_debt.id
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
  ) values (
    v_debt.id,
    v_user_id,
    p_amount,
    v_debt.currency,
    p_amount_eur,
    p_exchange_rate,
    p_paid_at,
    nullif(btrim(p_notes), ''),
    v_transaction.id
  )
  returning * into v_payment;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

create or replace function public.reverse_debt_payment_atomic(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.debt_payments;
  v_debt public.debts;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_payment
  from public.debt_payments
  where id = p_payment_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Payment not found.';
  end if;

  update public.debts
  set
    current_balance = least(original_balance, current_balance + v_payment.amount),
    current_balance_eur = least(
      original_balance_eur,
      current_balance_eur + v_payment.amount_eur
    ),
    status = case when status = 'paid_off' then 'active' else status end,
    updated_at = now()
  where id = v_payment.debt_id and user_id = v_user_id
  returning * into v_debt;

  if v_payment.transaction_id is not null then
    delete from public.transactions
    where id = v_payment.transaction_id and user_id = v_user_id;
  end if;

  delete from public.debt_payments
  where id = v_payment.id and user_id = v_user_id;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment)
  );
end;
$$;

create or replace function public.delete_debt_with_payments(
  p_debt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts;
  v_transaction_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_debt
  from public.debts
  where id = p_debt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.';
  end if;

  select coalesce(array_agg(transaction_id) filter (where transaction_id is not null), '{}'::uuid[])
  into v_transaction_ids
  from public.debt_payments
  where debt_id = p_debt_id and user_id = v_user_id;

  delete from public.debts
  where id = p_debt_id and user_id = v_user_id;

  if cardinality(v_transaction_ids) > 0 then
    delete from public.transactions
    where user_id = v_user_id and id = any(v_transaction_ids);
  end if;

  return jsonb_build_object('debt', to_jsonb(v_debt));
end;
$$;

revoke all on function public.record_debt_payment_atomic(uuid, numeric, numeric, numeric, timestamptz, text, date)
  from public, anon;
revoke all on function public.reverse_debt_payment_atomic(uuid)
  from public, anon;
revoke all on function public.delete_debt_with_payments(uuid)
  from public, anon;
grant execute on function public.record_debt_payment_atomic(uuid, numeric, numeric, numeric, timestamptz, text, date)
  to authenticated;
grant execute on function public.reverse_debt_payment_atomic(uuid)
  to authenticated;
grant execute on function public.delete_debt_with_payments(uuid)
  to authenticated;

-- Retire direct debt-payment mutations and the older non-atomic functions.
drop policy if exists "Users can create own debt payments" on public.debt_payments;
drop policy if exists "Users can update own debt payments" on public.debt_payments;
drop policy if exists "Users can delete own debt payments" on public.debt_payments;
revoke insert, update, delete on public.debt_payments from anon, authenticated;
grant select on public.debt_payments to authenticated;
do $$
begin
  if to_regprocedure(
    'public.record_debt_payment(uuid,numeric,numeric,numeric,timestamptz,text,uuid)'
  ) is not null then
    execute 'revoke all on function public.record_debt_payment(uuid, numeric, numeric, numeric, timestamptz, text, uuid) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.reverse_debt_payment(uuid)') is not null then
    execute 'revoke all on function public.reverse_debt_payment(uuid) from public, anon, authenticated';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic self-service financial-record deletion
-- ---------------------------------------------------------------------------

create or replace function public.delete_all_financial_records()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_goals bigint := 0;
  v_debts bigint := 0;
  v_bills bigint := 0;
  v_plans bigint := 0;
  v_items bigint := 0;
  v_transactions bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.goals where user_id = v_user_id;
  get diagnostics v_goals = row_count;

  delete from public.debts where user_id = v_user_id;
  get diagnostics v_debts = row_count;

  delete from public.bills where user_id = v_user_id;
  get diagnostics v_bills = row_count;

  delete from public.monthly_budget_items where user_id = v_user_id;
  get diagnostics v_items = row_count;

  delete from public.monthly_budget_plans where user_id = v_user_id;
  get diagnostics v_plans = row_count;

  delete from public.transactions where user_id = v_user_id;
  get diagnostics v_transactions = row_count;

  return jsonb_build_object(
    'goals', v_goals,
    'debts', v_debts,
    'bills', v_bills,
    'planner_plans', v_plans,
    'planner_items', v_items,
    'transactions', v_transactions
  );
end;
$$;

revoke all on function public.delete_all_financial_records()
  from public, anon;
grant execute on function public.delete_all_financial_records()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Private profile-photo storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own profile photos" on storage.objects;
create policy "Users can read own profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own profile photos" on storage.objects;
create policy "Users can upload own profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own profile photos" on storage.objects;
create policy "Users can update own profile photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own profile photos" on storage.objects;
create policy "Users can delete own profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Realtime publication coverage
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'transactions',
    'bills',
    'goals',
    'goal_investments',
    'debts',
    'debt_payments',
    'monthly_budget_plans',
    'monthly_budget_items'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$$;

alter table public.transactions replica identity full;
alter table public.bills replica identity full;
alter table public.goals replica identity full;
alter table public.goal_investments replica identity full;
alter table public.debts replica identity full;
alter table public.debt_payments replica identity full;
alter table public.monthly_budget_plans replica identity full;
alter table public.monthly_budget_items replica identity full;

notify pgrst, 'reload schema';

commit;
