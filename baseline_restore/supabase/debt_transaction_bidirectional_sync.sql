-- FICONTER Debt <-> Transactions bidirectional synchronization
-- Run once in the Supabase SQL Editor before deploying the matching frontend files.
--
-- Guarantees:
-- 1. Deleting a debt-payment transaction restores the related debt balance.
-- 2. Deleting a debt removes its payment records and linked transactions without
--    restoring a debt that is being deleted.
-- 3. Deleting a payment from Debt removes the linked transaction atomically.
-- 4. Existing Bills <-> Transactions linked-delete behavior remains intact.

begin;

create index if not exists debt_payments_transaction_id_idx
on public.debt_payments(transaction_id)
where transaction_id is not null;

-- Any deletion path for a debt-payment transaction (single, bulk or direct)
-- restores the source debt before the transaction disappears.
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
      current_balance = least(
        original_balance,
        current_balance + v_payment.amount
      ),
      current_balance_eur = least(
        original_balance_eur,
        current_balance_eur + v_payment.amount_eur
      ),
      status = case
        when status = 'paid_off' then 'active'
        else status
      end,
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

drop trigger if exists restore_debt_before_transaction_delete_trigger
on public.transactions;

create trigger restore_debt_before_transaction_delete_trigger
before delete on public.transactions
for each row
execute function public.restore_debt_before_transaction_delete();

-- Deleting a payment from the Debt module now removes the linked transaction
-- inside the same database transaction. The trigger above restores the debt.
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

  -- Legacy or partially linked payment rows may not have a transaction. In that
  -- case restore and delete the payment directly.
  if v_deleted_transaction_count = 0 then
    update public.debts
    set
      current_balance = least(
        original_balance,
        current_balance + v_payment.amount
      ),
      current_balance_eur = least(
        original_balance_eur,
        current_balance_eur + v_payment.amount_eur
      ),
      status = case
        when status = 'paid_off' then 'active'
        else status
      end,
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

revoke all on function public.reverse_debt_payment(uuid)
from public, anon;
grant execute on function public.reverse_debt_payment(uuid)
to authenticated;

-- Debt deletion deliberately removes the source debt first. Its payment rows
-- cascade away, then linked transactions are deleted; therefore the transaction
-- trigger does not restore a debt that no longer exists.
create or replace function public.delete_debt_with_linked_transactions(
  p_debt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_transaction_ids uuid[] := '{}'::uuid[];
  v_payment_count integer := 0;
  v_deleted_debt_count integer := 0;
  v_deleted_transaction_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.' using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    coalesce(
      array_agg(payment_record.transaction_id)
        filter (where payment_record.transaction_id is not null),
      '{}'::uuid[]
    )
  into v_payment_count, v_transaction_ids
  from public.debt_payments as payment_record
  where payment_record.debt_id = p_debt_id
    and payment_record.user_id = v_user_id;

  delete from public.debts
  where id = p_debt_id
    and user_id = v_user_id;
  get diagnostics v_deleted_debt_count = row_count;

  if cardinality(v_transaction_ids) > 0 then
    delete from public.transactions
    where user_id = v_user_id
      and id = any(v_transaction_ids);
    get diagnostics v_deleted_transaction_count = row_count;
  end if;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'deleted_debt_count', v_deleted_debt_count,
    'deleted_payment_count', v_payment_count,
    'deleted_transaction_count', v_deleted_transaction_count,
    'deleted_transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;

revoke all on function public.delete_debt_with_linked_transactions(uuid)
from public, anon;
grant execute on function public.delete_debt_with_linked_transactions(uuid)
to authenticated;

-- Preserve the existing RPC name used by TransactionLedger, but extend it so
-- deleting a transaction also reverses linked debt payments through the trigger.
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

  delete from public.bills
  where user_id = v_user_id
    and transaction_id = any(v_transaction_ids);
  get diagnostics v_deleted_bill_count = row_count;

  -- The BEFORE DELETE trigger restores and removes linked debt payments here.
  delete from public.transactions
  where user_id = v_user_id
    and id = any(v_transaction_ids);
  get diagnostics v_deleted_transaction_count = row_count;

  return jsonb_build_object(
    'deleted_transaction_count', v_deleted_transaction_count,
    'deleted_bill_count', v_deleted_bill_count,
    'reversed_debt_payment_count', v_reversed_debt_payment_count,
    'deleted_transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;

revoke all on function public.delete_transactions_with_linked_bills(uuid[])
from public, anon;
grant execute on function public.delete_transactions_with_linked_bills(uuid[])
to authenticated;

comment on function public.restore_debt_before_transaction_delete()
is 'Restores a linked debt balance and deletes its debt-payment row before a transaction is deleted.';

comment on function public.reverse_debt_payment(uuid)
is 'Atomically reverses a customer-owned debt payment and deletes its linked transaction.';

comment on function public.delete_debt_with_linked_transactions(uuid)
is 'Atomically deletes a customer-owned debt, its payment history and linked transactions.';

comment on function public.delete_transactions_with_linked_bills(uuid[])
is 'Atomically deletes customer-owned transactions, linked Bills, and reverses linked debt payments.';

alter table public.transactions replica identity full;
alter table public.debts replica identity full;
alter table public.debt_payments replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null;
end $$;

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

notify pgrst, 'reload schema';

commit;
