-- FICONTER paid-to-unpaid Bill reversal
-- Run once in Supabase SQL Editor before deploying the matching frontend.

begin;

create or replace function public.mark_bill_unpaid(
  p_bill_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills%rowtype;
  v_transaction_id uuid;
  v_deleted_transaction_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select bill_record.*
  into v_bill
  from public.bills as bill_record
  where bill_record.id = p_bill_id
    and bill_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'The bill was not found.' using errcode = 'P0002';
  end if;

  if v_bill.status <> 'paid' then
    raise exception 'Only a paid bill can be marked unpaid.' using errcode = '22023';
  end if;

  v_transaction_id := v_bill.transaction_id;

  -- Remove the link first so this works with restrictive foreign keys and so
  -- the Bill never points at a transaction that no longer exists.
  update public.bills
  set status = 'pending',
      paid_at = null,
      transaction_id = null,
      updated_at = now()
  where id = p_bill_id
    and user_id = v_user_id;

  if v_transaction_id is not null then
    delete from public.transactions
    where id = v_transaction_id
      and user_id = v_user_id;
    get diagnostics v_deleted_transaction_count = row_count;
  end if;

  select bill_record.*
  into v_bill
  from public.bills as bill_record
  where bill_record.id = p_bill_id
    and bill_record.user_id = v_user_id;

  return jsonb_build_object(
    'bill', to_jsonb(v_bill),
    'deleted_transaction_id', v_transaction_id,
    'deleted_transaction_count', v_deleted_transaction_count
  );
end;
$$;

revoke all on function public.mark_bill_unpaid(uuid)
  from public, anon;
grant execute on function public.mark_bill_unpaid(uuid)
  to authenticated;

comment on function public.mark_bill_unpaid(uuid)
is 'Atomically reopens a customer-owned paid Bill and removes only its linked generated transaction.';

-- Make the RPC visible immediately to PostgREST/Supabase after deployment.
notify pgrst, 'reload schema';

commit;
