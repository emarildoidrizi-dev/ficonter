-- FICONTER — Effortless Entry v1
-- Run this entire file once in Supabase SQL Editor before deploying the UI files.

create extension if not exists "pgcrypto";

create table if not exists public.money_entry_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entry_mode text not null default 'guided'
    check (entry_mode in ('simple', 'guided', 'detailed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  amount_eur numeric(18,6),
  exchange_rate_to_eur numeric(20,10),
  exchange_rate_date date,
  exchange_rate_source text,
  type text not null check (type in ('income', 'expense', 'saving')),
  category text not null check (char_length(btrim(category)) between 1 and 100),
  is_favorite boolean not null default true,
  is_recurring boolean not null default false,
  day_of_month smallint check (day_of_month between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_recurring or day_of_month is not null)
);

create table if not exists public.transaction_template_postings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.transaction_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key date not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, period_key),
  check (period_key = date_trunc('month', period_key)::date)
);

create index if not exists transaction_templates_user_active_idx
  on public.transaction_templates(user_id, is_active, updated_at desc);

create index if not exists transaction_template_postings_user_period_idx
  on public.transaction_template_postings(user_id, period_key desc);

alter table public.money_entry_preferences enable row level security;
alter table public.transaction_templates enable row level security;
alter table public.transaction_template_postings enable row level security;

drop policy if exists "Users can view own money entry preferences" on public.money_entry_preferences;
create policy "Users can view own money entry preferences"
  on public.money_entry_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own money entry preferences" on public.money_entry_preferences;
create policy "Users can create own money entry preferences"
  on public.money_entry_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own money entry preferences" on public.money_entry_preferences;
create policy "Users can update own money entry preferences"
  on public.money_entry_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own money entry preferences" on public.money_entry_preferences;
create policy "Users can delete own money entry preferences"
  on public.money_entry_preferences for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view own transaction templates" on public.transaction_templates;
create policy "Users can view own transaction templates"
  on public.transaction_templates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own transaction templates" on public.transaction_templates;
create policy "Users can create own transaction templates"
  on public.transaction_templates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own transaction templates" on public.transaction_templates;
create policy "Users can update own transaction templates"
  on public.transaction_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own transaction templates" on public.transaction_templates;
create policy "Users can delete own transaction templates"
  on public.transaction_templates for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view own transaction template postings" on public.transaction_template_postings;
create policy "Users can view own transaction template postings"
  on public.transaction_template_postings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own transaction template postings" on public.transaction_template_postings;
create policy "Users can create own transaction template postings"
  on public.transaction_template_postings for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.transaction_templates template
      where template.id = template_id
        and template.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own transaction template postings" on public.transaction_template_postings;
create policy "Users can delete own transaction template postings"
  on public.transaction_template_postings for delete
  using (auth.uid() = user_id);

create or replace function public.touch_effortless_entry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists money_entry_preferences_touch_updated_at on public.money_entry_preferences;
create trigger money_entry_preferences_touch_updated_at
before update on public.money_entry_preferences
for each row execute function public.touch_effortless_entry_updated_at();

drop trigger if exists transaction_templates_touch_updated_at on public.transaction_templates;
create trigger transaction_templates_touch_updated_at
before update on public.transaction_templates
for each row execute function public.touch_effortless_entry_updated_at();

create or replace function public.post_monthly_transaction_template(
  p_template_id uuid,
  p_period_key date default date_trunc('month', current_date)::date
)
returns public.transactions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_template public.transaction_templates%rowtype;
  v_existing_transaction public.transactions%rowtype;
  v_saved_transaction public.transactions%rowtype;
  v_period date := date_trunc('month', p_period_key)::date;
  v_last_day integer;
  v_transaction_date date;
  v_posting_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into v_template
  from public.transaction_templates
  where id = p_template_id
    and user_id = auth.uid()
    and is_active = true
    and is_recurring = true
  for update;

  if not found then
    raise exception 'The recurring entry could not be found.';
  end if;

  select transaction.*
  into v_existing_transaction
  from public.transaction_template_postings posting
  join public.transactions transaction on transaction.id = posting.transaction_id
  where posting.template_id = v_template.id
    and posting.user_id = auth.uid()
    and posting.period_key = v_period;

  if found then
    return v_existing_transaction;
  end if;

  if v_template.currency <> 'EUR' then
    raise exception 'Review the latest exchange rate before posting this recurring entry.';
  end if;

  v_last_day := extract(day from (v_period + interval '1 month - 1 day'))::integer;
  v_transaction_date := v_period + (least(v_template.day_of_month, v_last_day) - 1);

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
    auth.uid(),
    v_template.description,
    v_template.amount,
    'EUR',
    v_template.amount,
    1,
    v_transaction_date,
    'recurring EUR template',
    v_template.type,
    v_template.category,
    v_transaction_date,
    (v_transaction_date::timestamp + time '12:00') at time zone 'UTC'
  )
  returning * into v_saved_transaction;

  insert into public.transaction_template_postings (
    template_id,
    user_id,
    period_key,
    transaction_id
  ) values (
    v_template.id,
    auth.uid(),
    v_period,
    v_saved_transaction.id
  )
  on conflict (template_id, period_key) do nothing
  returning id into v_posting_id;

  if v_posting_id is null then
    delete from public.transactions where id = v_saved_transaction.id;

    select transaction.*
    into v_existing_transaction
    from public.transaction_template_postings posting
    join public.transactions transaction on transaction.id = posting.transaction_id
    where posting.template_id = v_template.id
      and posting.user_id = auth.uid()
      and posting.period_key = v_period;

    if found then
      return v_existing_transaction;
    end if;

    raise exception 'The recurring entry was already processed.';
  end if;

  return v_saved_transaction;
end;
$$;

revoke all on function public.post_monthly_transaction_template(uuid, date) from public;
grant execute on function public.post_monthly_transaction_template(uuid, date) to authenticated;

notify pgrst, 'reload schema';
