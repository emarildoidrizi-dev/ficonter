-- FICONTER E2EE final transaction write boundary.
--
-- Rules:
--   * Client/browser writes must arrive already encrypted (encryption_version = 1).
--   * Readable transaction columns are never retained for encrypted/pending rows.
--   * Existing legacy plaintext rows are tolerated only so an unlocked client can
--     migrate them in place. New direct plaintext writes are rejected.
--   * Existing SECURITY DEFINER automation functions may still construct a
--     transaction from Bills/Debt/Goals/etc. Their transaction row is scrubbed
--     immediately to a pending skeleton (encryption_version = 0). The unlocked
--     client reconstructs that row from its linked source record and encrypts it.

alter table public.transactions
  alter column currency drop default,
  alter column description drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_eur drop not null,
  alter column exchange_rate_to_eur drop not null,
  alter column exchange_rate_date drop not null,
  alter column exchange_rate_source drop not null,
  alter column type drop not null,
  alter column category drop not null,
  alter column transaction_date drop not null,
  alter column occurred_at drop not null;

-- Earlier staging builds briefly stored ciphertext alongside readable columns.
-- Those rows already contain a valid client ciphertext, so remove the duplicate
-- readable copy before enforcing the final storage invariant.
update public.transactions
set
  description = null,
  amount = null,
  currency = null,
  amount_eur = null,
  exchange_rate_to_eur = null,
  exchange_rate_date = null,
  exchange_rate_source = null,
  type = null,
  category = null,
  transaction_date = null,
  occurred_at = null
where encryption_version = 1
  and encrypted_payload is not null;

-- Treat an incomplete version marker as legacy data so the unlocked browser can
-- migrate it safely instead of making the constraint deployment fail.
update public.transactions
set encryption_version = null
where encryption_version = 1
  and encrypted_payload is null;

alter table public.transactions
  drop constraint if exists transactions_e2ee_ciphertext_only_check;

alter table public.transactions
  add constraint transactions_e2ee_ciphertext_only_check
  check (
    encryption_version is null
    or (
      encryption_version = 0
      and encrypted_payload is null
      and description is null
      and amount is null
      and currency is null
      and amount_eur is null
      and exchange_rate_to_eur is null
      and exchange_rate_date is null
      and exchange_rate_source is null
      and type is null
      and category is null
      and transaction_date is null
      and occurred_at is null
    )
    or (
      encryption_version = 1
      and encrypted_payload is not null
      and description is null
      and amount is null
      and currency is null
      and amount_eur is null
      and exchange_rate_to_eur is null
      and exchange_rate_date is null
      and exchange_rate_source is null
      and type is null
      and category is null
      and transaction_date is null
      and occurred_at is null
    )
  ) not valid;

-- Existing legacy rows are allowed by the `encryption_version is null` branch.
-- Validate the structural rule now; this does not require legacy rows to be
-- encrypted until the user unlocks their vault.
alter table public.transactions
  validate constraint transactions_e2ee_ciphertext_only_check;

create or replace function public.ficonter_transactions_e2ee_write_guard()
returns trigger
language plpgsql
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  v_is_privileged boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
  v_plaintext_present boolean :=
    new.description is not null
    or new.amount is not null
    or new.currency is not null
    or new.amount_eur is not null
    or new.exchange_rate_to_eur is not null
    or new.exchange_rate_date is not null
    or new.exchange_rate_source is not null
    or new.type is not null
    or new.category is not null
    or new.transaction_date is not null
    or new.occurred_at is not null;
begin
  -- Existing SECURITY DEFINER automation currently creates plaintext rows on
  -- INSERT. Permit that insert only so the deferred scrub trigger can convert it
  -- to a pending skeleton before commit. Privileged callers do not receive a
  -- general plaintext UPDATE bypass.
  if tg_op = 'INSERT' and v_is_privileged then
    return new;
  end if;

  if new.encryption_version = 1
     and new.encrypted_payload is not null
     and not v_plaintext_present then
    return new;
  end if;

  -- The SECURITY DEFINER scrub function updates a just-inserted server row to
  -- the version-0 pending skeleton. This is the only privileged UPDATE escape.
  if tg_op = 'UPDATE'
     and v_is_privileged
     and new.encryption_version = 0
     and new.encrypted_payload is null
     and not v_plaintext_present then
    return new;
  end if;

  raise exception
    'FICONTER E2EE requires ciphertext-only transaction writes. Unlock the Financial Vault and try again.'
    using errcode = '22023';
end;
$$;

create or replace function public.ficonter_transactions_scrub_server_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
begin
  if new.encrypted_payload is not null or new.encryption_version = 1 then
    return new;
  end if;

  if new.description is null
     and new.amount is null
     and new.currency is null
     and new.amount_eur is null
     and new.exchange_rate_to_eur is null
     and new.exchange_rate_date is null
     and new.exchange_rate_source is null
     and new.type is null
     and new.category is null
     and new.transaction_date is null
     and new.occurred_at is null then
    return new;
  end if;

  update public.transactions
  set
    encrypted_payload = null,
    encryption_version = 0,
    description = null,
    amount = null,
    currency = null,
    amount_eur = null,
    exchange_rate_to_eur = null,
    exchange_rate_date = null,
    exchange_rate_source = null,
    type = null,
    category = null,
    transaction_date = null,
    occurred_at = null
  where id = new.id;

  return new;
end;
$$;

revoke all on function public.ficonter_transactions_e2ee_write_guard() from public;
revoke all on function public.ficonter_transactions_scrub_server_insert() from public;

drop trigger if exists transactions_e2ee_write_guard on public.transactions;
create trigger transactions_e2ee_write_guard
before insert or update on public.transactions
for each row execute function public.ficonter_transactions_e2ee_write_guard();

drop trigger if exists transactions_scrub_server_insert on public.transactions;
create constraint trigger transactions_scrub_server_insert
after insert on public.transactions
deferrable initially deferred
for each row execute function public.ficonter_transactions_scrub_server_insert();

comment on constraint transactions_e2ee_ciphertext_only_check on public.transactions is
  'E2EE rows are ciphertext-only. Version 0 is a server-created pending skeleton; version 1 is client-encrypted. Null version is legacy data awaiting one-time vault migration.';

comment on function public.ficonter_transactions_e2ee_write_guard() is
  'Rejects new client-side plaintext transaction writes. Only ciphertext-only writes are accepted from authenticated clients.';

comment on function public.ficonter_transactions_scrub_server_insert() is
  'Converts SECURITY DEFINER transaction inserts into zero-plaintext pending skeletons at transaction end for client-side vault encryption.';

notify pgrst, 'reload schema';

-- Preserve the original-currency inputs for future Goal-generated transaction
-- skeletons. These fields are part of the Goal source record, not the
-- transaction row, so the unlocked client can reproduce the exact transaction
-- payload before encrypting it.
alter table public.goal_investments
  add column if not exists original_amount numeric(14,2),
  add column if not exists currency text,
  add column if not exists exchange_rate_to_eur numeric(20,10),
  add column if not exists exchange_rate_date date;

create or replace function public.record_goal_investment(
  p_goal_id uuid,
  p_amount_eur numeric,
  p_original_amount numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_invested_at timestamptz,
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
  v_goal public.goals;
  v_investment public.goal_investments;
  v_transaction public.transactions;
  v_next_amount numeric;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_amount_eur is null or p_amount_eur <= 0 then
    raise exception 'Enter a valid investment amount.';
  end if;

  if p_original_amount is null or p_original_amount <= 0 then
    raise exception 'Enter a valid original investment amount.';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Use a valid three-letter currency code.';
  end if;

  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required.';
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

  if p_amount_eur > greatest(0, v_goal.target_amount - v_goal.current_amount) then
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
    p_original_amount,
    v_currency,
    p_amount_eur,
    p_exchange_rate,
    coalesce(p_exchange_rate_date, p_invested_at::date),
    'Goal investment',
    'saving',
    'General savings',
    p_invested_at::date,
    p_invested_at
  )
  returning * into v_transaction;

  v_next_amount := least(v_goal.target_amount, v_goal.current_amount + p_amount_eur);

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
    original_amount,
    currency,
    exchange_rate_to_eur,
    exchange_rate_date,
    invested_at,
    notes,
    transaction_id
  ) values (
    v_goal.id,
    v_user_id,
    p_amount_eur,
    p_original_amount,
    v_currency,
    p_exchange_rate,
    coalesce(p_exchange_rate_date, p_invested_at::date),
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

revoke all on function public.record_goal_investment(
  uuid, numeric, numeric, text, numeric, timestamptz, text, date
) from public, anon;

grant execute on function public.record_goal_investment(
  uuid, numeric, numeric, text, numeric, timestamptz, text, date
) to authenticated;

notify pgrst, 'reload schema';
