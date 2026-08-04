-- FICONTER · Credit Card Management v1
--
-- Adds a dedicated Credit Cards interface while retaining public.debts as the
-- single liability source used by Debt, Net Worth, Wealth Score and reporting.
-- Credit-card payments continue through public.debt_payments and public.transactions.
-- Purchases, interest, fees, refunds and statement reconciliations are stored as
-- non-cash card activity so cash flow is not counted twice.

begin;

-- Credit-card-specific fields live on the existing debt row. This avoids
-- duplicating the same liability in a second account table.
alter table public.debts
  add column if not exists card_last_four text,
  add column if not exists credit_limit numeric(16,2),
  add column if not exists credit_limit_eur numeric(16,2),
  add column if not exists statement_balance numeric(16,2),
  add column if not exists statement_balance_eur numeric(16,2),
  add column if not exists statement_date date,
  add column if not exists payment_due_date date,
  add column if not exists interest_charged numeric(16,2) not null default 0,
  add column if not exists interest_charged_eur numeric(16,2) not null default 0;

alter table public.debts
  drop constraint if exists debts_original_balance_check;
alter table public.debts
  add constraint debts_original_balance_check
  check (original_balance >= 0) not valid;
alter table public.debts
  validate constraint debts_original_balance_check;

alter table public.debts
  drop constraint if exists debts_card_last_four_check;
alter table public.debts
  add constraint debts_card_last_four_check
  check (card_last_four is null or card_last_four ~ '^[0-9]{4}$');

alter table public.debts
  drop constraint if exists debts_credit_limit_check;
alter table public.debts
  add constraint debts_credit_limit_check
  check (credit_limit is null or credit_limit >= 0);

alter table public.debts
  drop constraint if exists debts_credit_limit_eur_check;
alter table public.debts
  add constraint debts_credit_limit_eur_check
  check (credit_limit_eur is null or credit_limit_eur >= 0);

alter table public.debts
  drop constraint if exists debts_statement_balance_check;
alter table public.debts
  add constraint debts_statement_balance_check
  check (statement_balance is null or statement_balance >= 0);

alter table public.debts
  drop constraint if exists debts_statement_balance_eur_check;
alter table public.debts
  add constraint debts_statement_balance_eur_check
  check (statement_balance_eur is null or statement_balance_eur >= 0);

alter table public.debts
  drop constraint if exists debts_interest_charged_check;
alter table public.debts
  add constraint debts_interest_charged_check
  check (interest_charged >= 0 and interest_charged_eur >= 0);

-- A credit card must be confirmed from its real statement. Disable the generic
-- debt auto-recorder so FICONTER never assumes a payment occurred.
update public.debts
set
  autopay = false,
  autopay_enabled_at = null,
  updated_at = now()
where lower(category) = 'credit card'
  and (autopay is true or autopay_enabled_at is not null);

create table if not exists public.credit_card_activities (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (
    activity_type in (
      'purchase',
      'interest',
      'fee',
      'refund',
      'adjustment_increase',
      'adjustment_decrease',
      'statement_adjustment'
    )
  ),
  description text not null check (char_length(btrim(description)) between 1 and 140),
  amount numeric(16,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_eur numeric(16,2) not null check (amount_eur > 0),
  exchange_rate_to_eur numeric(20,10) not null check (exchange_rate_to_eur > 0),
  balance_effect numeric(16,2) not null check (balance_effect <> 0),
  balance_effect_eur numeric(16,2) not null check (balance_effect_eur <> 0),
  occurred_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.credit_card_activities enable row level security;

create index if not exists credit_card_activities_user_date_idx
on public.credit_card_activities(user_id, occurred_at desc);

create index if not exists credit_card_activities_debt_date_idx
on public.credit_card_activities(debt_id, occurred_at desc);

create index if not exists debts_user_credit_cards_idx
on public.debts(user_id, current_balance_eur desc)
where lower(category) = 'credit card';

drop policy if exists "Users can view own credit card activities"
on public.credit_card_activities;
create policy "Users can view own credit card activities"
on public.credit_card_activities
for select
using (auth.uid() = user_id);

-- Mutations are intentionally RPC-only so balance and history remain atomic.
revoke insert, update, delete on public.credit_card_activities
from anon, authenticated;
grant select on public.credit_card_activities to authenticated;

create or replace function public.record_credit_card_activity(
  p_debt_id uuid,
  p_activity_type text,
  p_description text,
  p_amount numeric,
  p_amount_eur numeric,
  p_exchange_rate numeric,
  p_occurred_at timestamptz,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_activity public.credit_card_activities%rowtype;
  v_direction integer;
  v_effect numeric(16,2);
  v_effect_eur numeric(16,2);
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_activity_type not in (
    'purchase', 'interest', 'fee', 'refund',
    'adjustment_increase', 'adjustment_decrease'
  ) then
    raise exception 'Choose a valid credit-card activity.' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0
    or p_amount_eur is null or p_amount_eur <= 0
    or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Enter a valid amount and EUR conversion.' using errcode = '22023';
  end if;

  if nullif(btrim(p_description), '') is null then
    raise exception 'Enter an activity description.' using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card'
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  v_direction := case
    when p_activity_type in ('refund', 'adjustment_decrease') then -1
    else 1
  end;

  v_effect := round(p_amount * v_direction, 2);
  v_effect_eur := round(p_amount_eur * v_direction, 2);
  v_new_balance := round(v_debt.current_balance + v_effect, 2);
  v_new_balance_eur := round(v_debt.current_balance_eur + v_effect_eur, 2);

  if v_new_balance < 0 or v_new_balance_eur < 0 then
    raise exception 'This refund or adjustment is greater than the current balance.'
      using errcode = '22023';
  end if;

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    exchange_rate_to_eur = p_exchange_rate,
    interest_charged = case
      when p_activity_type = 'interest'
        then round(interest_charged + p_amount, 2)
      else interest_charged
    end,
    interest_charged_eur = case
      when p_activity_type = 'interest'
        then round(interest_charged_eur + p_amount_eur, 2)
      else interest_charged_eur
    end,
    status = 'active',
    autopay = false,
    autopay_enabled_at = null,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  insert into public.credit_card_activities (
    debt_id,
    user_id,
    activity_type,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    balance_effect,
    balance_effect_eur,
    occurred_at,
    notes
  ) values (
    v_debt.id,
    v_user_id,
    p_activity_type,
    btrim(p_description),
    round(p_amount, 2),
    v_debt.currency,
    round(p_amount_eur, 2),
    p_exchange_rate,
    v_effect,
    v_effect_eur,
    coalesce(p_occurred_at, now()),
    nullif(btrim(p_notes), '')
  )
  returning * into v_activity;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'activity', to_jsonb(v_activity)
  );
end;
$$;

create or replace function public.update_credit_card_statement(
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
  v_activity public.credit_card_activities%rowtype;
  v_post_statement_activity numeric(16,2) := 0;
  v_post_statement_activity_eur numeric(16,2) := 0;
  v_post_statement_payments numeric(16,2) := 0;
  v_post_statement_payments_eur numeric(16,2) := 0;
  v_reconciled_balance numeric(16,2);
  v_reconciled_balance_eur numeric(16,2);
  v_effect numeric(16,2);
  v_effect_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_statement_balance is null or p_statement_balance < 0
    or p_statement_balance_eur is null or p_statement_balance_eur < 0
    or p_exchange_rate is null or p_exchange_rate <= 0
    or p_minimum_payment is null or p_minimum_payment < 0
    or p_minimum_payment_eur is null or p_minimum_payment_eur < 0
    or p_apr is null or p_apr < 0
    or p_interest_charged is null or p_interest_charged < 0
    or p_interest_charged_eur is null or p_interest_charged_eur < 0 then
    raise exception 'Enter valid statement values.' using errcode = '22023';
  end if;

  if p_statement_date is null or p_payment_due_date is null then
    raise exception 'Statement date and payment due date are required.' using errcode = '22023';
  end if;

  if p_payment_due_date < p_statement_date then
    raise exception 'The payment due date cannot be before the statement date.'
      using errcode = '22023';
  end if;

  if p_minimum_payment > p_statement_balance then
    raise exception 'Minimum payment cannot exceed the statement balance.'
      using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card'
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  if v_debt.statement_date is not null
    and p_statement_date < v_debt.statement_date then
    raise exception 'The new statement date cannot be earlier than the confirmed statement date.'
      using errcode = '22023';
  end if;

  select
    coalesce(sum(activity_record.balance_effect), 0),
    coalesce(sum(activity_record.balance_effect_eur), 0)
  into v_post_statement_activity, v_post_statement_activity_eur
  from public.credit_card_activities as activity_record
  where activity_record.debt_id = v_debt.id
    and activity_record.user_id = v_user_id
    and activity_record.occurred_at::date > p_statement_date;

  select
    coalesce(sum(payment_record.amount), 0),
    coalesce(sum(payment_record.amount_eur), 0)
  into v_post_statement_payments, v_post_statement_payments_eur
  from public.debt_payments as payment_record
  where payment_record.debt_id = v_debt.id
    and payment_record.user_id = v_user_id
    and payment_record.paid_at::date > p_statement_date;

  v_reconciled_balance := greatest(
    0,
    round(
      p_statement_balance
        + v_post_statement_activity
        - v_post_statement_payments,
      2
    )
  );
  v_reconciled_balance_eur := greatest(
    0,
    round(
      p_statement_balance_eur
        + v_post_statement_activity_eur
        - v_post_statement_payments_eur,
      2
    )
  );

  v_effect := round(v_reconciled_balance - v_debt.current_balance, 2);
  v_effect_eur := round(v_reconciled_balance_eur - v_debt.current_balance_eur, 2);

  update public.debts
  set
    current_balance = v_reconciled_balance,
    current_balance_eur = v_reconciled_balance_eur,
    exchange_rate_to_eur = p_exchange_rate,
    statement_balance = round(p_statement_balance, 2),
    statement_balance_eur = round(p_statement_balance_eur, 2),
    statement_date = p_statement_date,
    payment_due_date = p_payment_due_date,
    payment_due_day = extract(day from p_payment_due_date)::integer,
    minimum_payment = round(p_minimum_payment, 2),
    minimum_payment_eur = round(p_minimum_payment_eur, 2),
    annual_interest_rate = p_apr,
    interest_charged = round(p_interest_charged, 2),
    interest_charged_eur = round(p_interest_charged_eur, 2),
    status = 'active',
    autopay = false,
    autopay_enabled_at = null,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  if v_effect <> 0 and v_effect_eur <> 0 then
    insert into public.credit_card_activities (
      debt_id,
      user_id,
      activity_type,
      description,
      amount,
      currency,
      amount_eur,
      exchange_rate_to_eur,
      balance_effect,
      balance_effect_eur,
      occurred_at,
      notes
    ) values (
      v_debt.id,
      v_user_id,
      'statement_adjustment',
      'Statement reconciliation',
      abs(v_effect),
      v_debt.currency,
      abs(v_effect_eur),
      p_exchange_rate,
      v_effect,
      v_effect_eur,
      (p_statement_date::timestamp + time '12:00') at time zone 'UTC',
      'Balance reconciled to the confirmed card statement.'
    )
    returning * into v_activity;
  end if;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'activity', case when v_activity.id is null then null else to_jsonb(v_activity) end
  );
end;
$$;

create or replace function public.record_credit_card_payment(
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
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_payment public.debt_payments%rowtype;
  v_transaction public.transactions%rowtype;
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card'
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > v_debt.current_balance
    or p_amount_eur is null or p_amount_eur <= 0
    or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Enter a valid payment not greater than the current balance.'
      using errcode = '22023';
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
    'Credit card payment · ' || v_debt.name,
    round(p_amount, 2),
    v_debt.currency,
    round(p_amount_eur, 2),
    p_exchange_rate,
    p_exchange_rate_date,
    'Credit card payment conversion',
    'expense',
    'Credit-card payment',
    p_exchange_rate_date,
    coalesce(p_paid_at, now())
  )
  returning * into v_transaction;

  v_new_balance := greatest(0, round(v_debt.current_balance - p_amount, 2));
  v_new_balance_eur := greatest(0, round(v_debt.current_balance_eur - p_amount_eur, 2));

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    exchange_rate_to_eur = p_exchange_rate,
    status = 'active',
    autopay = false,
    autopay_enabled_at = null,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
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
    round(p_amount, 2),
    v_debt.currency,
    round(p_amount_eur, 2),
    p_exchange_rate,
    coalesce(p_paid_at, now()),
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

create or replace function public.reverse_credit_card_activity(
  p_activity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.credit_card_activities%rowtype;
  v_debt public.debts%rowtype;
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select activity_record.*
  into v_activity
  from public.credit_card_activities as activity_record
  where activity_record.id = p_activity_id
    and activity_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Credit-card activity not found.' using errcode = 'P0002';
  end if;

  if v_activity.activity_type = 'statement_adjustment' then
    raise exception 'Confirmed statement reconciliation cannot be reversed directly. Update the statement again instead.'
      using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = v_activity.debt_id
    and debt_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  v_new_balance := round(v_debt.current_balance - v_activity.balance_effect, 2);
  v_new_balance_eur := round(v_debt.current_balance_eur - v_activity.balance_effect_eur, 2);

  if v_new_balance < 0 or v_new_balance_eur < 0 then
    raise exception 'This activity cannot be reversed after later payments reduced the balance.'
      using errcode = '22023';
  end if;

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    interest_charged = case
      when v_activity.activity_type = 'interest'
        then greatest(0, round(interest_charged - v_activity.amount, 2))
      else interest_charged
    end,
    interest_charged_eur = case
      when v_activity.activity_type = 'interest'
        then greatest(0, round(interest_charged_eur - v_activity.amount_eur, 2))
      else interest_charged_eur
    end,
    status = 'active',
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  delete from public.credit_card_activities
  where id = v_activity.id
    and user_id = v_user_id;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'activity', to_jsonb(v_activity)
  );
end;
$$;

-- Credit-card balances may increase above the opening balance. Restoring a
-- deleted payment must therefore not cap a card at original_balance.
create or replace function public.restore_debt_before_transaction_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.debt_payments%rowtype;
begin
  select payment_record.*
  into v_payment
  from public.debt_payments as payment_record
  where payment_record.transaction_id = old.id
    and payment_record.user_id = old.user_id
  for update;

  if found then
    update public.debts
    set
      current_balance = case
        when lower(category) = 'credit card'
          then current_balance + v_payment.amount
        else least(original_balance, current_balance + v_payment.amount)
      end,
      current_balance_eur = case
        when lower(category) = 'credit card'
          then current_balance_eur + v_payment.amount_eur
        else least(original_balance_eur, current_balance_eur + v_payment.amount_eur)
      end,
      status = case when status = 'paid_off' then 'active' else status end,
      updated_at = now()
    where id = v_payment.debt_id
      and user_id = old.user_id;

    delete from public.debt_payments
    where id = v_payment.id
      and user_id = old.user_id;
  end if;

  return old;
end;
$$;

revoke all on function public.restore_debt_before_transaction_delete()
from public, anon, authenticated;

create or replace function public.reverse_debt_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.debt_payments%rowtype;
  v_debt public.debts%rowtype;
  v_deleted_transaction_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select payment_record.*
  into v_payment
  from public.debt_payments as payment_record
  where payment_record.id = p_payment_id
    and payment_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;

  if v_payment.transaction_id is not null then
    delete from public.transactions
    where id = v_payment.transaction_id
      and user_id = v_user_id;
    get diagnostics v_deleted_transaction_count = row_count;
  end if;

  if v_deleted_transaction_count = 0 then
    update public.debts
    set
      current_balance = case
        when lower(category) = 'credit card'
          then current_balance + v_payment.amount
        else least(original_balance, current_balance + v_payment.amount)
      end,
      current_balance_eur = case
        when lower(category) = 'credit card'
          then current_balance_eur + v_payment.amount_eur
        else least(original_balance_eur, current_balance_eur + v_payment.amount_eur)
      end,
      status = case when status = 'paid_off' then 'active' else status end,
      updated_at = now()
    where id = v_payment.debt_id
      and user_id = v_user_id
    returning * into v_debt;

    delete from public.debt_payments
    where id = v_payment.id
      and user_id = v_user_id;
  else
    select debt_record.*
    into v_debt
    from public.debts as debt_record
    where debt_record.id = v_payment.debt_id
      and debt_record.user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'deleted_transaction_count', v_deleted_transaction_count,
    'deleted_transaction_id', v_payment.transaction_id
  );
end;
$$;

revoke all on function public.record_credit_card_activity(uuid,text,text,numeric,numeric,numeric,timestamptz,text)
from public, anon;
revoke all on function public.update_credit_card_statement(uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric)
from public, anon;
revoke all on function public.record_credit_card_payment(uuid,numeric,numeric,numeric,timestamptz,text,date)
from public, anon;
revoke all on function public.reverse_credit_card_activity(uuid)
from public, anon;
revoke all on function public.reverse_debt_payment(uuid)
from public, anon;

grant execute on function public.record_credit_card_activity(uuid,text,text,numeric,numeric,numeric,timestamptz,text)
to authenticated;
grant execute on function public.update_credit_card_statement(uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric)
to authenticated;
grant execute on function public.record_credit_card_payment(uuid,numeric,numeric,numeric,timestamptz,text,date)
to authenticated;
grant execute on function public.reverse_credit_card_activity(uuid)
to authenticated;
grant execute on function public.reverse_debt_payment(uuid)
to authenticated;

alter table public.debts replica identity full;
alter table public.debt_payments replica identity full;
alter table public.credit_card_activities replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.credit_card_activities;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

commit;
