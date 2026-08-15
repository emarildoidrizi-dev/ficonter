-- FICONTER BUSINESS — PHASE B1 + B2
-- Business workspace foundation and isolated Business Transactions.
-- Safe to run once on the FICONTER Supabase project.

begin;

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  legal_name text,
  business_type text not null default 'Sole trader',
  country_code text not null default 'DE' check (char_length(country_code) = 2),
  base_currency text not null default 'EUR' check (char_length(base_currency) = 3),
  fiscal_year_start_month smallint not null default 1
    check (fiscal_year_start_month between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  default_timezone text not null default 'UTC',
  date_format text not null default 'DD/MM/YYYY',
  number_format text not null default 'de-DE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  description text not null check (char_length(trim(description)) between 1 and 180),
  counterparty text,
  type text not null check (type in ('income', 'expense')),
  category text not null check (char_length(trim(category)) between 1 and 100),
  cost_nature text check (cost_nature is null or cost_nature in ('fixed', 'variable')),
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  amount_base numeric(18, 2) not null check (amount_base > 0),
  exchange_rate_to_base numeric(20, 8) not null default 1
    check (exchange_rate_to_base > 0),
  exchange_rate_date date,
  exchange_rate_source text,
  transaction_date date not null,
  occurred_at timestamptz not null,
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists businesses_owner_id_idx
  on public.businesses(owner_id);
create index if not exists business_members_user_id_idx
  on public.business_members(user_id, status);
create index if not exists business_members_business_id_idx
  on public.business_members(business_id, status);
create index if not exists business_transactions_business_date_idx
  on public.business_transactions(business_id, transaction_date desc);
create index if not exists business_transactions_business_occurred_idx
  on public.business_transactions(business_id, occurred_at desc);
create index if not exists business_transactions_business_type_idx
  on public.business_transactions(business_id, type, transaction_date desc);

create or replace function public.business_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists businesses_touch_updated_at on public.businesses;
create trigger businesses_touch_updated_at
before update on public.businesses
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_members_touch_updated_at on public.business_members;
create trigger business_members_touch_updated_at
before update on public.business_members
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_settings_touch_updated_at on public.business_settings;
create trigger business_settings_touch_updated_at
before update on public.business_settings
for each row execute function public.business_touch_updated_at();

drop trigger if exists business_transactions_touch_updated_at on public.business_transactions;
create trigger business_transactions_touch_updated_at
before update on public.business_transactions
for each row execute function public.business_touch_updated_at();

create or replace function public.business_member_has_access(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function public.business_member_can_write(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.business_member_can_manage(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  );
$$;

revoke all on function public.business_member_has_access(uuid) from public;
revoke all on function public.business_member_can_write(uuid) from public;
revoke all on function public.business_member_can_manage(uuid) from public;
grant execute on function public.business_member_has_access(uuid) to authenticated;
grant execute on function public.business_member_can_write(uuid) to authenticated;
grant execute on function public.business_member_can_manage(uuid) to authenticated;

create or replace function public.create_business_workspace(
  p_name text,
  p_legal_name text default null,
  p_business_type text default 'Sole trader',
  p_country_code text default 'DE',
  p_base_currency text default 'EUR',
  p_fiscal_year_start_month integer default 1,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter a valid business name.';
  end if;

  if p_fiscal_year_start_month not between 1 and 12 then
    raise exception 'Fiscal year start month must be between 1 and 12.';
  end if;

  insert into public.businesses (
    owner_id,
    name,
    legal_name,
    business_type,
    country_code,
    base_currency,
    fiscal_year_start_month
  ) values (
    v_user_id,
    trim(p_name),
    nullif(trim(coalesce(p_legal_name, '')), ''),
    coalesce(nullif(trim(p_business_type), ''), 'Sole trader'),
    upper(coalesce(nullif(trim(p_country_code), ''), 'DE')),
    upper(coalesce(nullif(trim(p_base_currency), ''), 'EUR')),
    p_fiscal_year_start_month
  ) returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role, status)
  values (v_business_id, v_user_id, 'owner', 'active');

  insert into public.business_settings (business_id, default_timezone)
  values (v_business_id, coalesce(nullif(trim(p_timezone), ''), 'UTC'));

  return v_business_id;
end;
$$;

revoke all on function public.create_business_workspace(
  text, text, text, text, text, integer, text
) from public, anon;
grant execute on function public.create_business_workspace(
  text, text, text, text, text, integer, text
) to authenticated;

create or replace function public.business_transaction_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  new.currency := upper(new.currency);
  new.transaction_date := (new.occurred_at at time zone 'UTC')::date;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_transaction_before_write
  on public.business_transactions;
create trigger business_transaction_before_write
before insert or update on public.business_transactions
for each row execute function public.business_transaction_before_write();

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_transactions enable row level security;

drop policy if exists businesses_select_members on public.businesses;
create policy businesses_select_members
on public.businesses for select
to authenticated
using (
  owner_id = auth.uid()
  or public.business_member_has_access(id)
);

drop policy if exists businesses_update_managers on public.businesses;
create policy businesses_update_managers
on public.businesses for update
to authenticated
using (public.business_member_can_manage(id))
with check (public.business_member_can_manage(id));

drop policy if exists businesses_delete_owner on public.businesses;
create policy businesses_delete_owner
on public.businesses for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists business_members_select on public.business_members;
create policy business_members_select
on public.business_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.business_member_can_manage(business_id)
);

drop policy if exists business_settings_select on public.business_settings;
create policy business_settings_select
on public.business_settings for select
to authenticated
using (public.business_member_has_access(business_id));

drop policy if exists business_settings_update on public.business_settings;
create policy business_settings_update
on public.business_settings for update
to authenticated
using (public.business_member_can_manage(business_id))
with check (public.business_member_can_manage(business_id));

drop policy if exists business_transactions_select on public.business_transactions;
create policy business_transactions_select
on public.business_transactions for select
to authenticated
using (public.business_member_has_access(business_id));

drop policy if exists business_transactions_insert on public.business_transactions;
create policy business_transactions_insert
on public.business_transactions for insert
to authenticated
with check (public.business_member_can_write(business_id));

drop policy if exists business_transactions_update on public.business_transactions;
create policy business_transactions_update
on public.business_transactions for update
to authenticated
using (public.business_member_can_write(business_id))
with check (public.business_member_can_write(business_id));

drop policy if exists business_transactions_delete on public.business_transactions;
create policy business_transactions_delete
on public.business_transactions for delete
to authenticated
using (public.business_member_can_write(business_id));

revoke all on public.businesses from anon;
revoke all on public.business_members from anon;
revoke all on public.business_settings from anon;
revoke all on public.business_transactions from anon;

grant select, update, delete on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, update on public.business_settings to authenticated;
grant select, insert, update, delete on public.business_transactions to authenticated;

create or replace function public.get_business_overview(
  p_business_id uuid,
  p_month date default current_date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_lifetime_balance numeric := 0;
  v_transaction_count integer := 0;
  v_recent jsonb := '[]'::jsonb;
begin
  if not public.business_member_has_access(p_business_id) then
    raise exception 'Business access is required.';
  end if;

  select
    coalesce(sum(amount_base) filter (where type = 'income'), 0),
    coalesce(sum(amount_base) filter (where type = 'expense'), 0),
    count(*)::integer
  into v_revenue, v_expenses, v_transaction_count
  from public.business_transactions
  where business_id = p_business_id
    and transaction_date >= v_month_start
    and transaction_date < v_month_end;

  select coalesce(sum(
    case when type = 'income' then amount_base else -amount_base end
  ), 0)
  into v_lifetime_balance
  from public.business_transactions
  where business_id = p_business_id;

  select coalesce(jsonb_agg(to_jsonb(recent_row)), '[]'::jsonb)
  into v_recent
  from (
    select
      id,
      description,
      counterparty,
      type,
      category,
      amount,
      currency,
      amount_base,
      transaction_date,
      occurred_at
    from public.business_transactions
    where business_id = p_business_id
    order by occurred_at desc
    limit 8
  ) recent_row;

  return jsonb_build_object(
    'month', to_char(v_month_start, 'YYYY-MM'),
    'revenue', v_revenue,
    'expenses', v_expenses,
    'operatingResult', v_revenue - v_expenses,
    'lifetimeBalance', v_lifetime_balance,
    'transactionCount', v_transaction_count,
    'recentTransactions', v_recent
  );
end;
$$;

revoke all on function public.get_business_overview(uuid, date)
  from public, anon;
grant execute on function public.get_business_overview(uuid, date)
  to authenticated;

-- Realtime support. Each statement is guarded so the migration is repeat-safe.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'business_transactions'
    ) then
      alter publication supabase_realtime add table public.business_transactions;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'businesses'
    ) then
      alter publication supabase_realtime add table public.businesses;
    end if;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
