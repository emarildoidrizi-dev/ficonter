-- FICONTER Phase 1 — Production User Management
-- Run once in Supabase SQL Editor before deploying the matching application files.
-- This migration is idempotent and does not expose customer financial values.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users
  add column if not exists role text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

delete from public.admin_users
where role is null or role not in ('admin', 'super_admin');

alter table public.admin_users
  alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'admin_users_role_check'
  ) then
    alter table public.admin_users
      add constraint admin_users_role_check
      check (role in ('admin', 'super_admin'));
  end if;
end;
$$;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs
  add column if not exists admin_user_id uuid,
  add column if not exists action text,
  add column if not exists target_user_id uuid,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

update public.admin_audit_logs
set
  action = coalesce(nullif(btrim(action), ''), 'legacy_action'),
  details = coalesce(details, '{}'::jsonb),
  created_at = coalesce(created_at, now())
where action is null
   or btrim(action) = ''
   or details is null
   or created_at is null;

alter table public.admin_audit_logs
  alter column admin_user_id drop not null,
  alter column target_user_id drop not null,
  alter column action set not null,
  alter column details set default '{}'::jsonb,
  alter column details set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

-- Normalize the audit foreign keys so deleted accounts do not erase the audit trail.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.admin_audit_logs'::regclass
      and contype = 'f'
  loop
    execute format(
      'alter table public.admin_audit_logs drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_audit_logs'::regclass
      and conname = 'admin_audit_logs_action_check'
  ) then
    alter table public.admin_audit_logs
      add constraint admin_audit_logs_action_check
      check (char_length(action) between 1 and 80);
  end if;
end;
$$;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_admin_user_id_fkey
    foreign key (admin_user_id) references auth.users(id) on delete set null,
  add constraint admin_audit_logs_target_user_id_fkey
    foreign key (target_user_id) references auth.users(id) on delete set null;

create index if not exists admin_users_role_idx
  on public.admin_users(role, created_at);
create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_admin_user_idx
  on public.admin_audit_logs(admin_user_id, created_at desc);
create index if not exists admin_audit_logs_target_user_idx
  on public.admin_audit_logs(target_user_id, created_at desc);

create or replace function public.set_admin_user_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_admin_user_updated_at on public.admin_users;
create trigger set_admin_user_updated_at
before update on public.admin_users
for each row execute function public.set_admin_user_updated_at();

-- The founder account is also recognized by verified JWT email as a recovery path.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.role in ('admin', 'super_admin')
    )
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'wixlyydo@gmail.com';
$$;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.role = 'super_admin'
    )
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'wixlyydo@gmail.com';
$$;

-- Internal helper. It only counts rows in explicitly supplied relations.
create or replace function public.admin_safe_relation_count(
  relation_name text
)
returns bigint
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  relation regclass;
  result bigint := 0;
begin
  relation := to_regclass(relation_name);
  if relation is null then
    return 0;
  end if;

  execute format('select count(*)::bigint from %s', relation) into result;
  return coalesce(result, 0);
end;
$$;

create or replace function public.admin_account_directory()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  display_name text,
  role text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  return query
  select
    users.id,
    coalesce(users.email, '')::text,
    users.created_at,
    users.last_sign_in_at,
    users.banned_until,
    coalesce(
      nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(profiles.full_name), ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      'Unnamed user'
    )::text,
    admins.role::text
  from auth.users as users
  left join public.profiles as profiles on profiles.id = users.id
  left join public.admin_users as admins on admins.user_id = users.id
  order by
    case admins.role
      when 'super_admin' then 0
      when 'admin' then 1
      else 2
    end,
    lower(coalesce(users.email, '')),
    users.created_at;
end;
$$;

create or replace function public.admin_platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, storage
as $$
declare
  registered_users bigint := 0;
  active_7_days bigint := 0;
  active_30_days bigint := 0;
  new_7_days bigint := 0;
  new_30_days bigint := 0;
  transaction_count bigint := 0;
  bill_count bigint := 0;
  goal_count bigint := 0;
  debt_count bigint := 0;
  planner_count bigint := 0;
  storage_count bigint := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  select
    count(*)::bigint,
    count(*) filter (
      where last_sign_in_at >= now() - interval '7 days'
        and (banned_until is null or banned_until <= now())
    )::bigint,
    count(*) filter (
      where last_sign_in_at >= now() - interval '30 days'
        and (banned_until is null or banned_until <= now())
    )::bigint,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint,
    count(*) filter (where created_at >= now() - interval '30 days')::bigint
  into
    registered_users,
    active_7_days,
    active_30_days,
    new_7_days,
    new_30_days
  from auth.users;

  transaction_count := public.admin_safe_relation_count('public.transactions');
  bill_count := public.admin_safe_relation_count('public.bills');
  goal_count := public.admin_safe_relation_count('public.goals');
  debt_count := public.admin_safe_relation_count('public.debts');
  planner_count :=
    public.admin_safe_relation_count('public.monthly_budget_plans') +
    public.admin_safe_relation_count('public.monthly_budget_items');
  storage_count := public.admin_safe_relation_count('storage.objects');

  return jsonb_build_object(
    'users', registered_users,
    'active_7_days', active_7_days,
    'active_30_days', active_30_days,
    'new_7_days', new_7_days,
    'new_30_days', new_30_days,
    'transactions', transaction_count,
    'bills', bill_count,
    'goals', goal_count,
    'debts', debt_count,
    'planner_records', planner_count,
    'storage_objects', storage_count
  );
end;
$$;

alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_audit_logs force row level security;

drop policy if exists "Admins can read own role" on public.admin_users;
create policy "Admins can read own role"
on public.admin_users
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_super_admin()
);

drop policy if exists "Admins can view audit log" on public.admin_audit_logs;
create policy "Admins can view audit log"
on public.admin_audit_logs
for select
to authenticated
using (public.is_platform_admin());

-- No browser client receives INSERT, UPDATE or DELETE policies on either table.
-- All mutations must pass through the server-only service-role API.
revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.admin_audit_logs from anon, authenticated;
grant select on table public.admin_users to authenticated;
grant select on table public.admin_audit_logs to authenticated;

revoke all on function public.set_admin_user_updated_at() from public, anon, authenticated;
revoke all on function public.admin_safe_relation_count(text) from public, anon, authenticated;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_platform_super_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_platform_super_admin() to authenticated;

revoke all on function public.admin_account_directory() from public, anon;
revoke all on function public.admin_platform_overview() from public, anon;
grant execute on function public.admin_account_directory() to authenticated;
grant execute on function public.admin_platform_overview() to authenticated;

-- Seed and lock the current founder account into the role table when present.
insert into public.admin_users (user_id, role)
select id, 'super_admin'
from auth.users
where lower(email) = 'wixlyydo@gmail.com'
order by created_at asc
limit 1
on conflict (user_id) do update
set role = 'super_admin', updated_at = now();

alter table public.admin_audit_logs replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_audit_logs'
  ) then
    alter publication supabase_realtime add table public.admin_audit_logs;
  end if;
end;
$$;

commit;
