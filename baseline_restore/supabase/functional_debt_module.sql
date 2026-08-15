create extension if not exists "pgcrypto";

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  lender text,
  description text,
  category text not null,
  original_balance numeric(16,2) not null check (original_balance > 0),
  current_balance numeric(16,2) not null check (current_balance >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  original_balance_eur numeric(16,2) not null check (original_balance_eur >= 0),
  current_balance_eur numeric(16,2) not null check (current_balance_eur >= 0),
  exchange_rate_to_eur numeric(20,10) not null default 1 check (exchange_rate_to_eur > 0),
  annual_interest_rate numeric(8,4) not null default 0 check (annual_interest_rate >= 0),
  minimum_payment numeric(16,2) not null default 0 check (minimum_payment >= 0),
  minimum_payment_eur numeric(16,2) not null default 0 check (minimum_payment_eur >= 0),
  payment_due_day integer check (payment_due_day between 1 and 31),
  start_date date,
  maturity_date date,
  status text not null default 'active'
    check (status in ('active','paid_off','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(16,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_eur numeric(16,2) not null check (amount_eur > 0),
  exchange_rate_to_eur numeric(20,10) not null check (exchange_rate_to_eur > 0),
  paid_at timestamptz not null,
  notes text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

drop policy if exists "Users can view own debts" on public.debts;
create policy "Users can view own debts"
on public.debts for select using (auth.uid() = user_id);

drop policy if exists "Users can create own debts" on public.debts;
create policy "Users can create own debts"
on public.debts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own debts" on public.debts;
create policy "Users can update own debts"
on public.debts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own debts" on public.debts;
create policy "Users can delete own debts"
on public.debts for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own debt payments" on public.debt_payments;
create policy "Users can view own debt payments"
on public.debt_payments for select using (auth.uid() = user_id);

drop policy if exists "Users can create own debt payments" on public.debt_payments;
create policy "Users can create own debt payments"
on public.debt_payments for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own debt payments" on public.debt_payments;
create policy "Users can update own debt payments"
on public.debt_payments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own debt payments" on public.debt_payments;
create policy "Users can delete own debt payments"
on public.debt_payments for delete using (auth.uid() = user_id);

create index if not exists debts_user_status_idx on public.debts(user_id,status);
create index if not exists debt_payments_user_paid_idx
on public.debt_payments(user_id,paid_at desc);
create index if not exists debt_payments_debt_idx
on public.debt_payments(debt_id,paid_at desc);

create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_amount_eur numeric,
  p_exchange_rate numeric,
  p_paid_at timestamptz,
  p_notes text,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_debt public.debts;
  v_payment public.debt_payments;
  v_new_balance numeric;
  v_new_balance_eur numeric;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Debt not found.';
  end if;

  if p_amount <= 0 or p_amount > v_debt.current_balance then
    raise exception 'Invalid payment amount.';
  end if;

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
    debt_id,user_id,amount,currency,amount_eur,exchange_rate_to_eur,
    paid_at,notes,transaction_id
  )
  values (
    v_debt.id,auth.uid(),p_amount,v_debt.currency,p_amount_eur,p_exchange_rate,
    p_paid_at,p_notes,p_transaction_id
  )
  returning * into v_payment;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment)
  );
end;
$$;

create or replace function public.reverse_debt_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.debt_payments;
  v_debt public.debts;
begin
  select * into v_payment
  from public.debt_payments
  where id = p_payment_id and user_id = auth.uid()
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
    status = case
      when status = 'paid_off' then 'active'
      else status
    end,
    updated_at = now()
  where id = v_payment.debt_id and user_id = auth.uid()
  returning * into v_debt;

  delete from public.debt_payments
  where id = v_payment.id and user_id = auth.uid();

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment)
  );
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.debts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.debt_payments;
exception when duplicate_object then null;
end $$;

alter table public.debts replica identity full;
alter table public.debt_payments replica identity full;

notify pgrst, 'reload schema';
