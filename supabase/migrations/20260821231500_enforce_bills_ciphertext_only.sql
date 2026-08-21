begin;

-- ============================================================================
-- Bills private fields become nullable because ciphertext is the source of truth.
-- Operational scheduling/linkage fields remain queryable by the server.
-- ============================================================================

alter table public.bills
  alter column name drop not null,
  alter column category drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_eur drop not null,
  alter column exchange_rate_to_eur drop not null;

-- Rows that already have valid ciphertext must not retain duplicate readable data.
update public.bills
set
  name = null,
  company = null,
  category = null,
  amount = null,
  currency = null,
  amount_eur = null,
  exchange_rate_to_eur = null,
  payment_method = null,
  notes = null
where encryption_version = 1
  and encrypted_payload is not null;

alter table public.bills
  drop constraint if exists bills_e2ee_ciphertext_only_check;

alter table public.bills
  add constraint bills_e2ee_ciphertext_only_check
  check (
    encryption_version is null
    or (
      encryption_version = 1
      and encrypted_payload is not null
      and name is null
      and company is null
      and category is null
      and amount is null
      and currency is null
      and amount_eur is null
      and exchange_rate_to_eur is null
      and payment_method is null
      and notes is null
    )
  ) not valid;

alter table public.bills
  validate constraint bills_e2ee_ciphertext_only_check;

create or replace function public.ficonter_bills_e2ee_write_guard()
returns trigger
language plpgsql
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_plaintext_present boolean :=
    new.name is not null
    or new.company is not null
    or new.category is not null
    or new.amount is not null
    or new.currency is not null
    or new.amount_eur is not null
    or new.exchange_rate_to_eur is not null
    or new.payment_method is not null
    or new.notes is not null;
begin
  if new.encryption_version = 1
     and new.encrypted_payload is not null
     and not v_plaintext_present then
    return new;
  end if;

  -- Existing legacy rows are readable only long enough for the unlocked browser
  -- to migrate them. Privileged background code may leave such a row untouched,
  -- but no authenticated client may create or rewrite plaintext Bill data.
  if tg_op = 'UPDATE'
     and old.encryption_version is null
     and new.encryption_version is null
     and current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  raise exception
    'FICONTER E2EE requires ciphertext-only Bill writes. Unlock the Financial Vault and try again.'
    using errcode = '22023';
end;
$$;

revoke all on function public.ficonter_bills_e2ee_write_guard() from public;

drop trigger if exists bills_e2ee_write_guard on public.bills;
create trigger bills_e2ee_write_guard
before insert or update on public.bills
for each row execute function public.ficonter_bills_e2ee_write_guard();

comment on constraint bills_e2ee_ciphertext_only_check on public.bills is
  'Encrypted Bills retain only vault ciphertext plus operational schedule/linkage metadata. Null version is legacy data awaiting one-time client migration.';

comment on function public.ficonter_bills_e2ee_write_guard() is
  'Rejects new readable Bill writes. Version 1 Bills must be ciphertext-only before reaching persistent storage.';

-- ============================================================================
-- Automatic-payment history must not leak Bill amounts/currency indirectly.
-- Debt automation is intentionally left unchanged until the Debt E2EE phase.
-- ============================================================================

alter table public.automatic_payment_runs
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_eur drop not null;

update public.automatic_payment_runs
set
  amount = null,
  currency = null,
  amount_eur = null
where source_type = 'bill';

alter table public.automatic_payment_runs
  drop constraint if exists automatic_payment_runs_bill_ciphertext_privacy_check;

alter table public.automatic_payment_runs
  add constraint automatic_payment_runs_bill_ciphertext_privacy_check
  check (
    source_type <> 'bill'
    or (
      amount is null
      and currency is null
      and amount_eur is null
    )
  );

comment on constraint automatic_payment_runs_bill_ciphertext_privacy_check
on public.automatic_payment_runs is
  'Bill automation audit rows contain timing/linkage metadata only. Private financial values stay inside Bill/Transaction ciphertext.';

-- ============================================================================
-- Bill occurrence recording: server advances schedule and creates only a
-- transaction skeleton. It never reads or writes private Bill financial data.
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

  if v_bill.encryption_version <> 1 or v_bill.encrypted_payload is null then
    raise exception 'Unlock FICONTER once to migrate this Bill before it can be recorded.'
      using errcode = '22023';
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

  -- A version-0 transaction is an intentionally content-free skeleton.
  -- The unlocked browser uses the encrypted Bill as source and seals this row.
  insert into public.transactions (
    user_id,
    encryption_version
  )
  values (
    v_bill.user_id,
    0
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
    null,
    null,
    null,
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
    amount = null,
    currency = null,
    amount_eur = null,
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

-- Legacy/manual one-time Bill RPC is also converted to a transaction skeleton.
create or replace function public.mark_bill_paid(
  p_bill_id uuid,
  p_paid_at timestamptz,
  p_transaction_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills%rowtype;
  v_transaction public.transactions%rowtype;
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
    raise exception 'Bill not found.';
  end if;

  if v_bill.encryption_version <> 1 or v_bill.encrypted_payload is null then
    raise exception 'Unlock FICONTER once to migrate this Bill before it can be recorded.'
      using errcode = '22023';
  end if;

  if v_bill.status = 'cancelled' then
    raise exception 'A cancelled bill cannot be marked paid.';
  end if;

  if v_bill.status = 'paid' and v_bill.transaction_id is not null then
    return jsonb_build_object('bill', to_jsonb(v_bill));
  end if;

  insert into public.transactions (user_id, encryption_version)
  values (v_user_id, 0)
  returning * into v_transaction;

  update public.bills
  set
    status = 'paid',
    paid_at = p_paid_at,
    transaction_id = v_transaction.id,
    updated_at = now()
  where id = v_bill.id
    and user_id = v_user_id
  returning * into v_bill;

  return jsonb_build_object(
    'bill', to_jsonb(v_bill),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

-- ============================================================================
-- Dedicated encrypted-Bills scheduler. The pre-E2EE shared scheduler keeps
-- Debt behaviour unchanged and naturally skips encrypted Bills because their
-- old amount columns are NULL.
-- ============================================================================

create or replace function public.process_automatic_encrypted_bills()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, cron, pg_catalog, pg_temp
as $$
declare
  v_bill public.bills%rowtype;
  v_scheduled timestamptz;
  v_bill_count integer := 0;
  v_failure_count integer := 0;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('ficonter:e2ee:automatic-bills:processor', 0)
  ) then
    return jsonb_build_object(
      'status', 'already_running',
      'bills_recorded', 0,
      'failures', 0
    );
  end if;

  for v_bill in
    select bill_record.*
    from public.bills as bill_record
    where bill_record.autopay = true
      and bill_record.autopay_enabled_at is not null
      and bill_record.status = 'pending'
      and bill_record.encryption_version = 1
      and bill_record.encrypted_payload is not null
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
            null,
            null,
            null,
            'automatic',
            'failed',
            left(sqlerrm, 500),
            now()
          )
          on conflict (source_type, source_id, occurrence_key)
          do update set
            scheduled_for = excluded.scheduled_for,
            amount = null,
            currency = null,
            amount_eur = null,
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
    'failures', v_failure_count,
    'processed_at', now()
  );
end;
$$;

revoke all on function public.process_automatic_encrypted_bills() from public, anon, authenticated;

-- Keep the same one-minute cadence as the existing automatic-payment processor.
do $$
begin
  perform cron.unschedule('ficonter-e2ee-bills');
exception
  when others then null;
end
$$;

select cron.schedule(
  'ficonter-e2ee-bills',
  '* * * * *',
  'select public.process_automatic_encrypted_bills();'
);

notify pgrst, 'reload schema';

commit;
