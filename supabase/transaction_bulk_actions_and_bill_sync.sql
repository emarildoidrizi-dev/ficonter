-- FICONTER transaction bulk actions and Bills synchronization
-- Run once in Supabase SQL Editor before deploying the matching frontend.

begin;

create or replace function public.delete_transactions_with_linked_bills(
  p_transaction_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_ids uuid[] := '{}'::uuid[];
  v_deleted_transaction_count integer := 0;
  v_deleted_bill_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_transaction_ids is null or cardinality(p_transaction_ids) = 0 then
    raise exception 'Choose at least one transaction.' using errcode = '22023';
  end if;

  -- Resolve only transaction records owned by the signed-in customer.
  -- Locking them keeps the transaction + linked bill deletion atomic.
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

  -- A paid Bill is the source record for its generated transaction. Deleting
  -- either side removes the linked counterpart so both modules remain aligned.
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
    'deleted_transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;

revoke all on function public.delete_transactions_with_linked_bills(uuid[])
  from public, anon;
grant execute on function public.delete_transactions_with_linked_bills(uuid[])
  to authenticated;

comment on function public.delete_transactions_with_linked_bills(uuid[])
is 'Atomically deletes a customer-owned transaction selection and any Bills linked to those transactions.';

commit;
