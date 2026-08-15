-- FICONTER Statement Import v1
-- Run once in Supabase SQL Editor before deploying the frontend files.

create extension if not exists "pgcrypto";

create table if not exists public.statement_import_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  delimiter text not null default ',',
  mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.transaction_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_text text not null check (char_length(trim(match_text)) between 2 and 80),
  category text not null check (char_length(trim(category)) between 1 and 120),
  transaction_type text not null default 'any'
    check (transaction_type in ('any','income','expense','saving')),
  priority integer not null default 0 check (priority between -1000 and 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_text, transaction_type)
);

create table if not exists public.statement_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mapping jsonb not null default '{}'::jsonb,
  requested_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_duplicate_count integer not null default 0,
  skipped_invalid_count integer not null default 0,
  status text not null default 'processing'
    check (status in ('processing','completed','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.statement_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.statement_import_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  fingerprint text not null,
  source_row_number integer not null check (source_row_number > 0),
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index if not exists statement_import_profiles_user_idx
  on public.statement_import_profiles(user_id, updated_at desc);
create index if not exists transaction_category_rules_user_idx
  on public.transaction_category_rules(user_id, priority desc, updated_at desc);
create index if not exists statement_import_batches_user_idx
  on public.statement_import_batches(user_id, created_at desc);
create index if not exists statement_import_items_batch_idx
  on public.statement_import_items(batch_id, source_row_number);
create index if not exists statement_import_items_transaction_idx
  on public.statement_import_items(transaction_id)
  where transaction_id is not null;

alter table public.statement_import_profiles enable row level security;
alter table public.transaction_category_rules enable row level security;
alter table public.statement_import_batches enable row level security;
alter table public.statement_import_items enable row level security;

drop policy if exists "Customers manage own statement import profiles" on public.statement_import_profiles;
create policy "Customers manage own statement import profiles"
on public.statement_import_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers manage own transaction category rules" on public.transaction_category_rules;
create policy "Customers manage own transaction category rules"
on public.transaction_category_rules
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers view own statement import batches" on public.statement_import_batches;
create policy "Customers view own statement import batches"
on public.statement_import_batches
for select
using (auth.uid() = user_id);

drop policy if exists "Customers view own statement import items" on public.statement_import_items;
create policy "Customers view own statement import items"
on public.statement_import_items
for select
using (auth.uid() = user_id);

create or replace function public.touch_statement_import_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists statement_import_profiles_touch_updated_at on public.statement_import_profiles;
create trigger statement_import_profiles_touch_updated_at
before update on public.statement_import_profiles
for each row execute function public.touch_statement_import_updated_at();

drop trigger if exists transaction_category_rules_touch_updated_at on public.transaction_category_rules;
create trigger transaction_category_rules_touch_updated_at
before update on public.transaction_category_rules
for each row execute function public.touch_statement_import_updated_at();

create or replace function public.import_statement_transactions(
  p_file_name text,
  p_rows jsonb,
  p_mapping jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_row jsonb;
  v_transaction_id uuid;
  v_fingerprint text;
  v_description text;
  v_type text;
  v_category text;
  v_currency text;
  v_transaction_date date;
  v_occurred_at timestamptz;
  v_amount numeric;
  v_amount_eur numeric;
  v_rate numeric;
  v_rate_date date;
  v_rate_source text;
  v_source_row_number integer;
  v_force_import boolean;
  v_requested integer := 0;
  v_imported integer := 0;
  v_skipped_duplicate integer := 0;
  v_skipped_invalid integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_file_name is null or char_length(trim(p_file_name)) < 1 then
    raise exception 'A statement file name is required.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Statement rows must be supplied as an array.' using errcode = '22023';
  end if;

  v_requested := jsonb_array_length(p_rows);
  if v_requested < 1 or v_requested > 2000 then
    raise exception 'Import between 1 and 2,000 statement rows at a time.' using errcode = '22023';
  end if;

  insert into public.statement_import_batches (
    user_id,
    file_name,
    mapping,
    requested_count,
    status
  ) values (
    v_user_id,
    left(trim(p_file_name), 255),
    coalesce(p_mapping, '{}'::jsonb),
    v_requested,
    'processing'
  )
  returning id into v_batch_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_description := left(trim(coalesce(v_row ->> 'description', '')), 120);
      v_type := lower(trim(coalesce(v_row ->> 'type', '')));
      v_category := left(trim(coalesce(v_row ->> 'category', '')), 120);
      v_currency := upper(trim(coalesce(v_row ->> 'currency', 'EUR')));
      v_transaction_date := (v_row ->> 'transactionDate')::date;
      v_occurred_at := (v_row ->> 'occurredAt')::timestamptz;
      v_amount := (v_row ->> 'amount')::numeric;
      v_amount_eur := (v_row ->> 'amountEur')::numeric;
      v_rate := (v_row ->> 'exchangeRateToEur')::numeric;
      v_rate_date := (v_row ->> 'exchangeRateDate')::date;
      v_rate_source := left(trim(coalesce(v_row ->> 'exchangeRateSource', 'statement import')), 120);
      v_source_row_number := greatest(coalesce((v_row ->> 'sourceRowNumber')::integer, 1), 1);
      v_force_import := coalesce((v_row ->> 'forceImport')::boolean, false);

      if v_description = ''
         or v_category = ''
         or v_type not in ('income','expense','saving')
         or v_currency !~ '^[A-Z]{3}$'
         or v_amount <= 0
         or v_amount_eur <= 0
         or v_rate <= 0 then
        v_skipped_invalid := v_skipped_invalid + 1;
        continue;
      end if;

      v_fingerprint := encode(
        digest(
          concat_ws(
            '|',
            v_user_id::text,
            coalesce(v_row ->> 'fingerprintSeed', '')
          ),
          'sha256'
        ),
        'hex'
      );

      if exists (
        select 1
        from public.statement_import_items item
        where item.user_id = v_user_id
          and item.fingerprint = v_fingerprint
      ) then
        v_skipped_duplicate := v_skipped_duplicate + 1;
        continue;
      end if;

      if not v_force_import and exists (
        select 1
        from public.transactions transaction_record
        where transaction_record.user_id = v_user_id
          and transaction_record.transaction_date = v_transaction_date
          and transaction_record.type = v_type
          and coalesce(transaction_record.currency, 'EUR') = v_currency
          and round(transaction_record.amount::numeric, 2) = round(v_amount, 2)
          and regexp_replace(lower(trim(transaction_record.description)), '\s+', ' ', 'g') =
              regexp_replace(lower(trim(v_description)), '\s+', ' ', 'g')
      ) then
        v_skipped_duplicate := v_skipped_duplicate + 1;
        continue;
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
        v_description,
        v_amount,
        v_currency,
        v_amount_eur,
        v_rate,
        v_rate_date,
        v_rate_source,
        v_type,
        v_category,
        v_transaction_date,
        v_occurred_at
      )
      returning id into v_transaction_id;

      insert into public.statement_import_items (
        batch_id,
        user_id,
        transaction_id,
        fingerprint,
        source_row_number,
        source_data
      ) values (
        v_batch_id,
        v_user_id,
        v_transaction_id,
        v_fingerprint,
        v_source_row_number,
        v_row
      );

      v_imported := v_imported + 1;
    exception
      when unique_violation then
        v_skipped_duplicate := v_skipped_duplicate + 1;
      when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
        v_skipped_invalid := v_skipped_invalid + 1;
    end;
  end loop;

  update public.statement_import_batches
  set
    imported_count = v_imported,
    skipped_duplicate_count = v_skipped_duplicate,
    skipped_invalid_count = v_skipped_invalid,
    status = 'completed',
    completed_at = now()
  where id = v_batch_id;

  return jsonb_build_object(
    'batchId', v_batch_id,
    'requestedCount', v_requested,
    'importedCount', v_imported,
    'skippedDuplicateCount', v_skipped_duplicate,
    'skippedInvalidCount', v_skipped_invalid
  );
end;
$$;

revoke all on function public.import_statement_transactions(text, jsonb, jsonb) from public;
grant execute on function public.import_statement_transactions(text, jsonb, jsonb) to authenticated;

comment on function public.import_statement_transactions(text, jsonb, jsonb)
is 'Imports customer-approved statement rows atomically with ownership validation and duplicate protection.';

notify pgrst, 'reload schema';
