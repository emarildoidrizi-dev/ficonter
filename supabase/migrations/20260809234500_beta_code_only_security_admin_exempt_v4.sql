-- FICONTER V3 — Beta can ONLY be granted by a validated invitation code.
-- Safe to run after the earlier Free/Beta migration.
-- Existing Beta / Personal Pro / Business Pro rows are preserved.
-- Every normal new signup is Free.
-- URL/path/query changes have ZERO authority over plan assignment.

begin;

-- 1) Fail-safe default: any subscription created without an explicit plan is Free.
alter table public.subscriptions
  alter column plan_code set default 'free';

-- 2) Private invitation registry. Only service_role can access these tables.
create table if not exists public.beta_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text null,
  active boolean not null default true,
  max_uses integer null check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beta_invite_codes enable row level security;
revoke all on table public.beta_invite_codes from anon;
revoke all on table public.beta_invite_codes from authenticated;
grant all on table public.beta_invite_codes to service_role;

create table if not exists public.beta_signup_tokens (
  token text primary key,
  invite_code_id uuid not null references public.beta_invite_codes(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists beta_signup_tokens_expires_at_idx
  on public.beta_signup_tokens (expires_at);

alter table public.beta_signup_tokens enable row level security;
revoke all on table public.beta_signup_tokens from anon;
revoke all on table public.beta_signup_tokens from authenticated;
grant all on table public.beta_signup_tokens to service_role;

-- 3) Keep the existing private invitation hash.
-- The plaintext invitation code is deliberately NOT stored in GitHub/Supabase.
insert into public.beta_invite_codes (
  code_hash,
  label,
  active,
  max_uses,
  expires_at
)
values (
  '4dd1eca9c601f9e998dcc52f452c692481af03dbe4819ae25af03b8203042a72',
  'Private Beta — initial invitation',
  true,
  50,
  null
)
on conflict (code_hash) do update
set active = true,
    label = excluded.label,
    max_uses = excluded.max_uses,
    updated_at = now();

-- 4) HARD GUARD ON THE SUBSCRIPTIONS TABLE.
-- If ANY code path tries to create/change an account to Beta without the
-- transaction-local authorization flag produced by the validated invitation flow,
-- PostgreSQL silently forces the plan back to Free.
--
-- This protects against:
--   * changing a URL to contain "beta"
--   * beta=true / plan=beta / invite=... query manipulation
--   * old frontend logic
--   * direct authenticated-client writes
--   * forged signup metadata
--
-- Existing Beta accounts remain Beta when their row is updated without changing
-- away from Beta and back again.
create or replace function public.enforce_ficonter_beta_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_code = 'beta'
     and (
       tg_op = 'INSERT'
       or old.plan_code is distinct from 'beta'
     )
     and coalesce(current_setting('ficonter.beta_grant', true), '') <> 'allowed'
  then
    new.plan_code := 'free';
    new.provider := coalesce(new.provider, 'internal');
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_ficonter_beta_assignment on public.subscriptions;
create trigger enforce_ficonter_beta_assignment
before insert or update of plan_code on public.subscriptions
for each row
execute function public.enforce_ficonter_beta_assignment();

-- 5) NEW-ACCOUNT SUBSCRIPTION TRIGGER.
-- The only recognized Beta signal is a single-use server-generated token stored
-- in auth metadata after the user manually entered a valid invitation code.
create or replace function public.create_default_ficonter_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  beta_token text;
  beta_invite_id uuid;
  beta_allowed boolean := false;
begin
  beta_token := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'ficonter_beta_token', '')),
    ''
  );

  if beta_token is not null then
    -- Consume the one-time token atomically. Fake/replayed tokens cannot work.
    update public.beta_signup_tokens
    set consumed_at = now()
    where token = beta_token
      and consumed_at is null
      and expires_at > now()
    returning invite_code_id into beta_invite_id;

    if beta_invite_id is not null then
      -- The invitation must still be active, unexpired and under its usage limit.
      update public.beta_invite_codes
      set use_count = use_count + 1,
          updated_at = now()
      where id = beta_invite_id
        and active = true
        and (expires_at is null or expires_at > now())
        and (max_uses is null or use_count < max_uses)
      returning true into beta_allowed;
    end if;
  end if;

  if coalesce(beta_allowed, false) then
    -- This transaction-local flag is the ONLY condition that the table guard
    -- accepts for a new Beta assignment.
    perform set_config('ficonter.beta_grant', 'allowed', true);
  end if;

  insert into public.subscriptions (
    user_id,
    plan_code,
    status,
    provider
  )
  values (
    new.id,
    case when coalesce(beta_allowed, false) then 'beta' else 'free' end,
    'active',
    'internal'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Replace the original signup trigger under its established name.
drop trigger if exists on_auth_user_created_ficonter_subscription on auth.users;
create trigger on_auth_user_created_ficonter_subscription
after insert on auth.users
for each row
execute function public.create_default_ficonter_subscription();

comment on function public.create_default_ficonter_subscription() is
  'Creates Free for every normal FICONTER signup. Beta is granted only after a validated, single-use private invitation token.';

comment on function public.enforce_ficonter_beta_assignment() is
  'Fail-safe guard: unauthorized Beta assignments are forced to Free. URLs and client input cannot select Beta.';

commit;

-- Verification output. These SELECTs make no changes.
select column_default as subscriptions_plan_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'subscriptions'
  and column_name = 'plan_code';

select tgname as active_ficonter_trigger
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and not tgisinternal
order by tgname;
