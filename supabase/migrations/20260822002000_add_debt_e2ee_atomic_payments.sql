begin;

alter table public.debts
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.debt_payments
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_eur drop not null,
  alter column exchange_rate_to_eur drop not null;

create or replace function public.record_debt_payment_e2ee_atomic(
  p_debt_id uuid,
  p_expected_revision bigint,
  p_new_debt_payload jsonb,
  p_new_status text,
  p_payment_id uuid,
  p_payment_payload jsonb,
  p_transaction_id uuid,
  p_transaction_payload text,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_new_debt_payload is null
     or p_payment_payload is null
     or nullif(btrim(p_transaction_payload), '') is null then
    raise exception 'Encrypted payment payloads are required.' using errcode = '22023';
  end if;

  if p_new_status not in ('active','paused','paid_off') then
    raise exception 'Invalid Debt status.' using errcode = '22023';
  end if;

  select d.*
  into v_debt
  from public.debts d
  where d.id = p_debt_id
    and d.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.' using errcode = 'P0002';
  end if;

  if v_debt.encryption_version <> 1 or v_debt.encrypted_payload is null then
    raise exception 'Debt must be encrypted before recording an E2EE payment.' using errcode = 'P0001';
  end if;

  if v_debt.e2ee_revision <> p_expected_revision then
    raise exception 'Debt changed before payment could be committed. Refresh and try again.' using errcode = '40001';
  end if;

  insert into public.transactions (
    id,
    user_id,
    encrypted_payload,
    encryption_version
  ) values (
    p_transaction_id,
    v_user_id,
    p_transaction_payload,
    1
  );

  insert into public.debt_payments (
    id,
    debt_id,
    user_id,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    paid_at,
    notes,
    transaction_id,
    encrypted_payload,
    encryption_version
  ) values (
    p_payment_id,
    p_debt_id,
    v_user_id,
    null,
    null,
    null,
    null,
    p_paid_at,
    null,
    p_transaction_id,
    p_payment_payload,
    1
  );

  update public.debts
  set
    encrypted_payload = p_new_debt_payload,
    encryption_version = 1,
    status = p_new_status,
    e2ee_revision = e2ee_revision + 1,
    updated_at = now()
  where id = p_debt_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'debt_id', p_debt_id,
    'payment_id', p_payment_id,
    'transaction_id', p_transaction_id,
    'revision', p_expected_revision + 1
  );
end;
$$;

create or replace function public.reverse_debt_payment_e2ee_atomic(
  p_payment_id uuid,
  p_expected_revision bigint,
  p_restored_debt_payload jsonb,
  p_restored_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.debt_payments%rowtype;
  v_debt public.debts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_restored_debt_payload is null then
    raise exception 'Encrypted restored Debt payload is required.' using errcode = '22023';
  end if;

  if p_restored_status not in ('active','paused','paid_off') then
    raise exception 'Invalid Debt status.' using errcode = '22023';
  end if;

  select p.*
  into v_payment
  from public.debt_payments p
  where p.id = p_payment_id
    and p.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;

  select d.*
  into v_debt
  from public.debts d
  where d.id = v_payment.debt_id
    and d.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.' using errcode = 'P0002';
  end if;

  if v_debt.e2ee_revision <> p_expected_revision then
    raise exception 'Debt changed before payment reversal could be committed. Refresh and try again.' using errcode = '40001';
  end if;

  if v_payment.transaction_id is not null then
    delete from public.transactions
    where id = v_payment.transaction_id
      and user_id = v_user_id;
  end if;

  delete from public.debt_payments
  where id = p_payment_id
    and user_id = v_user_id;

  update public.debts
  set
    encrypted_payload = p_restored_debt_payload,
    encryption_version = 1,
    status = p_restored_status,
    e2ee_revision = e2ee_revision + 1,
    updated_at = now()
  where id = v_payment.debt_id
    and user_id = v_user_id;

  return jsonb_build_object(
    'debt_id', v_payment.debt_id,
    'payment_id', p_payment_id,
    'transaction_id', v_payment.transaction_id,
    'revision', p_expected_revision + 1
  );
end;
$$;

revoke all on function public.record_debt_payment_e2ee_atomic(uuid,bigint,jsonb,text,uuid,jsonb,uuid,text,timestamptz) from public, anon;
grant execute on function public.record_debt_payment_e2ee_atomic(uuid,bigint,jsonb,text,uuid,jsonb,uuid,text,timestamptz) to authenticated;

revoke all on function public.reverse_debt_payment_e2ee_atomic(uuid,bigint,jsonb,text) from public, anon;
grant execute on function public.reverse_debt_payment_e2ee_atomic(uuid,bigint,jsonb,text) to authenticated;

notify pgrst, 'reload schema';

commit;
