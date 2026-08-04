-- FICONTER · Transaction-to-Credit-Card Expense Synchronization
--
-- Adds a Credit Card option to Transactions without duplicating financial data.
-- One save creates:
--   1. one expense transaction;
--   2. one linked credit-card purchase activity;
--   3. one atomic increase to the selected card balance.
--
-- Editing or deleting either linked record remains synchronized.

begin;

alter table public.transactions
  add column if not exists credit_card_debt_id uuid
    references public.debts(id) on delete set null;

alter table public.credit_card_activities
  add column if not exists transaction_id uuid
    references public.transactions(id) on delete cascade;

create index if not exists transactions_credit_card_debt_date_idx
  on public.transactions(credit_card_debt_id, occurred_at desc)
  where credit_card_debt_id is not null;

create unique index if not exists credit_card_activities_transaction_uidx
  on public.credit_card_activities(transaction_id)
  where transaction_id is not null;

create or replace function public.validate_credit_card_transaction_link()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_debt public.debts%rowtype;
begin
  if new.credit_card_debt_id is null then
    -- ON DELETE SET NULL preserves the historical expense when a card itself
    -- is removed. Normal application editing never exposes this link field.
    return new;
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = new.credit_card_debt_id
    and debt_record.user_id = new.user_id
    and lower(debt_record.category) = 'credit card';

  if not found then
    raise exception 'The selected credit card was not found.'
      using errcode = 'P0002';
  end if;

  if new.type <> 'expense' then
    raise exception 'A credit-card purchase must remain an expense.'
      using errcode = '22023';
  end if;

  if upper(coalesce(new.currency, '')) <> upper(v_debt.currency) then
    raise exception 'Enter the amount in the selected card currency: %.', v_debt.currency
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
    and old.credit_card_debt_id is distinct from new.credit_card_debt_id then
    raise exception 'Move the purchase by deleting it and recording it on the correct card.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_validate_credit_card_link
on public.transactions;

create trigger transactions_validate_credit_card_link
before insert or update of
  user_id,
  type,
  currency,
  credit_card_debt_id
on public.transactions
for each row
execute function public.validate_credit_card_transaction_link();

create or replace function public.create_credit_card_activity_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_debt public.debts%rowtype;
begin
  if new.credit_card_debt_id is null then
    return new;
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = new.credit_card_debt_id
    and debt_record.user_id = new.user_id
    and lower(debt_record.category) = 'credit card'
  for update;

  if not found then
    raise exception 'The selected credit card was not found.'
      using errcode = 'P0002';
  end if;

  update public.debts
  set
    current_balance = round(current_balance + new.amount, 2),
    current_balance_eur = round(current_balance_eur + new.amount_eur, 2),
    exchange_rate_to_eur = new.exchange_rate_to_eur,
    status = 'active',
    updated_at = now()
  where id = v_debt.id
    and user_id = new.user_id;

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
    notes,
    transaction_id
  ) values (
    v_debt.id,
    new.user_id,
    'purchase',
    new.description,
    round(new.amount, 2),
    v_debt.currency,
    round(new.amount_eur, 2),
    new.exchange_rate_to_eur,
    round(new.amount, 2),
    round(new.amount_eur, 2),
    coalesce(new.occurred_at, new.transaction_date::timestamp at time zone 'UTC'),
    'Transaction category: ' || new.category,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists transactions_create_credit_card_activity
on public.transactions;

create trigger transactions_create_credit_card_activity
after insert on public.transactions
for each row
when (new.credit_card_debt_id is not null)
execute function public.create_credit_card_activity_from_transaction();

create or replace function public.sync_credit_card_activity_from_transaction_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_activity public.credit_card_activities%rowtype;
  v_debt public.debts%rowtype;
  v_delta numeric(16,2);
  v_delta_eur numeric(16,2);
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if old.credit_card_debt_id is null or new.credit_card_debt_id is null then
    return new;
  end if;

  select activity_record.*
  into v_activity
  from public.credit_card_activities as activity_record
  where activity_record.transaction_id = old.id
    and activity_record.user_id = old.user_id
  for update;

  if not found then
    raise exception 'The linked credit-card activity is missing.'
      using errcode = 'P0002';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = old.credit_card_debt_id
    and debt_record.user_id = old.user_id
  for update;

  if not found then
    raise exception 'The linked credit card was not found.'
      using errcode = 'P0002';
  end if;

  v_delta := round(new.amount - v_activity.amount, 2);
  v_delta_eur := round(new.amount_eur - v_activity.amount_eur, 2);
  v_new_balance := round(v_debt.current_balance + v_delta, 2);
  v_new_balance_eur := round(v_debt.current_balance_eur + v_delta_eur, 2);

  if v_new_balance < 0 or v_new_balance_eur < 0 then
    raise exception 'This purchase cannot be reduced after later payments lowered the card balance.'
      using errcode = '22023';
  end if;

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    exchange_rate_to_eur = new.exchange_rate_to_eur,
    status = 'active',
    updated_at = now()
  where id = v_debt.id
    and user_id = old.user_id;

  update public.credit_card_activities
  set
    description = new.description,
    amount = round(new.amount, 2),
    currency = new.currency,
    amount_eur = round(new.amount_eur, 2),
    exchange_rate_to_eur = new.exchange_rate_to_eur,
    balance_effect = round(new.amount, 2),
    balance_effect_eur = round(new.amount_eur, 2),
    occurred_at = coalesce(
      new.occurred_at,
      new.transaction_date::timestamp at time zone 'UTC'
    ),
    notes = 'Transaction category: ' || new.category
  where id = v_activity.id
    and user_id = old.user_id;

  return new;
end;
$$;

drop trigger if exists transactions_sync_credit_card_activity_update
on public.transactions;

create trigger transactions_sync_credit_card_activity_update
after update of
  description,
  amount,
  currency,
  amount_eur,
  exchange_rate_to_eur,
  transaction_date,
  occurred_at,
  type,
  category,
  credit_card_debt_id
on public.transactions
for each row
when (old.credit_card_debt_id is not null)
execute function public.sync_credit_card_activity_from_transaction_update();

create or replace function public.reverse_credit_card_activity_before_transaction_delete()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_activity public.credit_card_activities%rowtype;
  v_debt public.debts%rowtype;
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if old.credit_card_debt_id is null then
    return old;
  end if;

  select activity_record.*
  into v_activity
  from public.credit_card_activities as activity_record
  where activity_record.transaction_id = old.id
    and activity_record.user_id = old.user_id
  for update;

  if not found then
    return old;
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = old.credit_card_debt_id
    and debt_record.user_id = old.user_id
  for update;

  if not found then
    delete from public.credit_card_activities
    where id = v_activity.id
      and user_id = old.user_id;
    return old;
  end if;

  v_new_balance := round(v_debt.current_balance - v_activity.balance_effect, 2);
  v_new_balance_eur := round(
    v_debt.current_balance_eur - v_activity.balance_effect_eur,
    2
  );

  if v_new_balance < 0 or v_new_balance_eur < 0 then
    raise exception 'This card expense cannot be deleted after later payments lowered the card balance.'
      using errcode = '22023';
  end if;

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    status = 'active',
    updated_at = now()
  where id = v_debt.id
    and user_id = old.user_id;

  delete from public.credit_card_activities
  where id = v_activity.id
    and user_id = old.user_id;

  return old;
end;
$$;

drop trigger if exists transactions_reverse_credit_card_activity_delete
on public.transactions;

create trigger transactions_reverse_credit_card_activity_delete
before delete on public.transactions
for each row
when (old.credit_card_debt_id is not null)
execute function public.reverse_credit_card_activity_before_transaction_delete();

create or replace function public.record_credit_card_transaction(
  p_debt_id uuid,
  p_description text,
  p_category text,
  p_amount numeric,
  p_amount_eur numeric,
  p_exchange_rate numeric,
  p_exchange_rate_date date,
  p_transaction_date date,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_transaction public.transactions%rowtype;
  v_activity public.credit_card_activities%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if nullif(btrim(p_description), '') is null then
    raise exception 'Enter a merchant or description.' using errcode = '22023';
  end if;

  if nullif(btrim(p_category), '') is null then
    raise exception 'Choose an expense category.' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0
    or p_amount_eur is null or p_amount_eur <= 0
    or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Enter a valid amount and EUR conversion.'
      using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card'
    and debt_record.status <> 'paid_off';

  if not found then
    raise exception 'The selected credit card was not found.'
      using errcode = 'P0002';
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
    occurred_at,
    credit_card_debt_id
  ) values (
    v_user_id,
    btrim(p_description),
    round(p_amount, 2),
    v_debt.currency,
    round(p_amount_eur, 2),
    p_exchange_rate,
    p_exchange_rate_date,
    'Credit card transaction conversion',
    'expense',
    btrim(p_category),
    coalesce(p_transaction_date, p_occurred_at::date, current_date),
    coalesce(p_occurred_at, now()),
    v_debt.id
  )
  returning * into v_transaction;

  select activity_record.*
  into v_activity
  from public.credit_card_activities as activity_record
  where activity_record.transaction_id = v_transaction.id
    and activity_record.user_id = v_user_id;

  return jsonb_build_object(
    'transaction', to_jsonb(v_transaction),
    'activity', to_jsonb(v_activity),
    'debt', (
      select to_jsonb(debt_record)
      from public.debts as debt_record
      where debt_record.id = v_debt.id
        and debt_record.user_id = v_user_id
    )
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
  v_deleted_transaction_count integer := 0;
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

  if v_activity.transaction_id is not null then
    delete from public.transactions
    where id = v_activity.transaction_id
      and user_id = v_user_id;
    get diagnostics v_deleted_transaction_count = row_count;

    if v_deleted_transaction_count = 0 then
      raise exception 'The linked transaction could not be deleted.'
        using errcode = 'P0002';
    end if;

    select debt_record.*
    into v_debt
    from public.debts as debt_record
    where debt_record.id = v_activity.debt_id
      and debt_record.user_id = v_user_id;

    return jsonb_build_object(
      'debt', to_jsonb(v_debt),
      'activity', to_jsonb(v_activity),
      'deleted_transaction_id', v_activity.transaction_id
    );
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
  v_new_balance_eur := round(
    v_debt.current_balance_eur - v_activity.balance_effect_eur,
    2
  );

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
    'activity', to_jsonb(v_activity),
    'deleted_transaction_id', null
  );
end;
$$;

create or replace function public.delete_transactions_with_linked_bills(
  p_transaction_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_ids uuid[] := '{}'::uuid[];
  v_deleted_transaction_count integer := 0;
  v_deleted_bill_count integer := 0;
  v_reversed_debt_payment_count integer := 0;
  v_reversed_credit_card_activity_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_transaction_ids is null or cardinality(p_transaction_ids) = 0 then
    raise exception 'Choose at least one transaction.' using errcode = '22023';
  end if;

  select coalesce(array_agg(transaction_row.id), '{}'::uuid[])
  into v_transaction_ids
  from (
    select transaction_record.id
    from public.transactions as transaction_record
    where transaction_record.user_id = v_user_id
      and transaction_record.id = any(p_transaction_ids)
    for update
  ) as transaction_row;

  if cardinality(v_transaction_ids) = 0 then
    raise exception 'No matching transactions were found.' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into v_reversed_debt_payment_count
  from public.debt_payments as payment_record
  where payment_record.user_id = v_user_id
    and payment_record.transaction_id = any(v_transaction_ids);

  select count(*)::integer
  into v_reversed_credit_card_activity_count
  from public.credit_card_activities as activity_record
  where activity_record.user_id = v_user_id
    and activity_record.transaction_id = any(v_transaction_ids);

  delete from public.bills
  where user_id = v_user_id
    and transaction_id = any(v_transaction_ids);
  get diagnostics v_deleted_bill_count = row_count;

  delete from public.transactions
  where user_id = v_user_id
    and id = any(v_transaction_ids);
  get diagnostics v_deleted_transaction_count = row_count;

  return jsonb_build_object(
    'deleted_transaction_count', v_deleted_transaction_count,
    'deleted_bill_count', v_deleted_bill_count,
    'reversed_debt_payment_count', v_reversed_debt_payment_count,
    'reversed_credit_card_activity_count',
      v_reversed_credit_card_activity_count,
    'deleted_transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;

revoke all on function public.record_credit_card_transaction(
  uuid,
  text,
  text,
  numeric,
  numeric,
  numeric,
  date,
  date,
  timestamptz
) from public, anon;

grant execute on function public.record_credit_card_transaction(
  uuid,
  text,
  text,
  numeric,
  numeric,
  numeric,
  date,
  date,
  timestamptz
) to authenticated;

revoke all on function public.validate_credit_card_transaction_link()
  from public, anon, authenticated;
revoke all on function public.create_credit_card_activity_from_transaction()
  from public, anon, authenticated;
revoke all on function public.sync_credit_card_activity_from_transaction_update()
  from public, anon, authenticated;
revoke all on function public.reverse_credit_card_activity_before_transaction_delete()
  from public, anon, authenticated;

revoke all on function public.reverse_credit_card_activity(uuid)
  from public, anon;
grant execute on function public.reverse_credit_card_activity(uuid)
  to authenticated;

revoke all on function public.delete_transactions_with_linked_bills(uuid[])
  from public, anon;
grant execute on function public.delete_transactions_with_linked_bills(uuid[])
  to authenticated;

comment on function public.record_credit_card_transaction(
  uuid,
  text,
  text,
  numeric,
  numeric,
  numeric,
  date,
  date,
  timestamptz
)
is 'Atomically records one transaction expense and one linked credit-card purchase activity.';

comment on column public.transactions.credit_card_debt_id
is 'The credit card charged for a transaction-created card purchase.';

comment on column public.credit_card_activities.transaction_id
is 'The single Transactions ledger row linked to this card activity.';

alter table public.transactions replica identity full;
alter table public.credit_card_activities replica identity full;
alter table public.debts replica identity full;

notify pgrst, 'reload schema';

commit;
