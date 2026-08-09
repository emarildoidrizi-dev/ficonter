-- FICONTER V8 — HARD Beta LOGIN + URL gate for NEW + EXISTING customer accounts.
-- Owner / Super Admin / Admin remain subscription-exempt in application authorization.
--
-- SECURITY RULE:
--   * Every normal new signup defaults to Free.
--   * A URL/domain/query containing "beta" has ZERO authority.
--   * New accounts can become Beta only after a valid invitation code is entered.
--   * Existing customer accounts can become Beta only after a valid invitation code is entered.
--   * Direct/old/client attempts to set plan_code='beta' without validated authorization
--     are forced back to Free.
--   * A normal customer is treated as verified Beta only after a valid invitation
--     has been recorded for that user. Legacy Beta rows without proof are not trusted.
--   * On the Beta environment, every normal login/session additionally requires a
--     fresh server-verified Beta login session created only after code validation.
--   * The Beta-domain dashboard has NO "continue as Free" bypass. Normal customers
--     without verified invitation proof are blocked from entering that Beta platform.
--   * Unverified legacy Beta values are treated as Free and application authorization
--     persists normal customers back to Free when encountered.
--   * Active PayPal subscriptions are not silently converted to Beta, preventing
--     accidental continued billing. They must finish/cancel paid access first.

begin;

-- 1) Fail-safe default: no explicit trusted entitlement means Free.
alter table public.subscriptions
  alter column plan_code set default 'free';

-- 2) Private invitation registry. Client roles cannot read or mutate it.
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

-- Short-lived one-time tokens are used only during NEW account creation.
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

-- Permanent proof that this normal customer actually presented a valid Beta code.
-- plan_code='beta' alone is NOT sufficient because older builds could create Beta
-- rows without invitation validation.
create table if not exists public.beta_user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invite_code_id uuid not null references public.beta_invite_codes(id) on delete restrict,
  verified_at timestamptz not null default now()
);

alter table public.beta_user_entitlements enable row level security;
revoke all on table public.beta_user_entitlements from anon;
revoke all on table public.beta_user_entitlements from authenticated;
grant all on table public.beta_user_entitlements to service_role;

-- Per-login proof for the Beta environment. A normal customer must provide the
-- invitation code for the CURRENT Beta login/session before dashboard rendering.
-- The browser receives only a random opaque token; the trusted hash remains here.
create table if not exists public.beta_login_sessions (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists beta_login_sessions_user_id_idx
  on public.beta_login_sessions (user_id);
create index if not exists beta_login_sessions_expires_at_idx
  on public.beta_login_sessions (expires_at);

alter table public.beta_login_sessions enable row level security;
revoke all on table public.beta_login_sessions from anon;
revoke all on table public.beta_login_sessions from authenticated;
grant all on table public.beta_login_sessions to service_role;

-- 3) Keep the private invitation by HASH ONLY.
-- The plaintext code must never be committed to GitHub or stored in frontend code.
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

-- 4) HARD TABLE GUARD.
-- The ONLY way to enter Beta from a non-Beta state is for trusted server/database
-- code to set the transaction-local ficonter.beta_grant flag after invitation
-- validation. URLs, query params, old frontend code and client writes cannot do it.
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

-- 5) NEW ACCOUNT FLOW.
-- A new account gets Beta only if Auth metadata contains a valid, unconsumed,
-- short-lived token that the server created after the invitation code was entered.
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
    update public.beta_signup_tokens
    set consumed_at = now()
    where token = beta_token
      and consumed_at is null
      and expires_at > now()
    returning invite_code_id into beta_invite_id;

    if beta_invite_id is not null then
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

  if coalesce(beta_allowed, false) and beta_invite_id is not null then
    insert into public.beta_user_entitlements (
      user_id,
      invite_code_id,
      verified_at
    )
    values (new.id, beta_invite_id, now())
    on conflict (user_id) do update
    set invite_code_id = excluded.invite_code_id,
        verified_at = excluded.verified_at;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ficonter_subscription on auth.users;
create trigger on_auth_user_created_ficonter_subscription
after insert on auth.users
for each row
execute function public.create_default_ficonter_subscription();

-- 6) EXISTING ACCOUNT FLOW.
-- This RPC is deliberately callable ONLY by service_role. The API authenticates the
-- logged-in customer, hashes the manually entered invitation code server-side, and
-- passes the authenticated user id + hash here.
--
-- The invite is consumed and the subscription update happen in ONE DB transaction.
create or replace function public.activate_ficonter_beta_for_existing_user(
  p_user_id uuid,
  p_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  beta_invite_id uuid;
  current_plan text;
  current_status text;
  current_provider text;
  paid_period_end timestamptz;
begin
  if p_user_id is null or nullif(trim(coalesce(p_code_hash, '')), '') is null then
    return false;
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    return false;
  end if;

  select plan_code, status, provider, subscriptions.current_period_end
    into current_plan, current_status, current_provider, paid_period_end
  from public.subscriptions
  where user_id = p_user_id;

  -- A legacy Beta plan value is NOT trusted by itself. Only an entitlement row
  -- proves that this normal customer previously supplied a valid invitation code.
  if current_plan = 'beta' and exists (
    select 1
    from public.beta_user_entitlements
    where user_id = p_user_id
  ) then
    return true;
  end if;

  -- Do not sever a live PayPal entitlement without stopping its billing lifecycle.
  -- This avoids converting the UI to Beta while PayPal could continue charging.
  if current_provider = 'paypal'
     and (
       current_status in ('active', 'trialing')
       or (paid_period_end is not null and paid_period_end > now())
     )
  then
    raise exception 'ACTIVE_PAID_SUBSCRIPTION'
      using errcode = 'P0001';
  end if;

  -- Atomically consume one invitation use only if it is currently valid.
  update public.beta_invite_codes
  set use_count = use_count + 1,
      updated_at = now()
  where code_hash = lower(trim(p_code_hash))
    and active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or use_count < max_uses)
  returning id into beta_invite_id;

  if beta_invite_id is null then
    return false;
  end if;

  -- The table guard accepts Beta only inside this validated transaction.
  perform set_config('ficonter.beta_grant', 'allowed', true);

  insert into public.subscriptions (
    user_id,
    plan_code,
    status,
    billing_interval,
    provider,
    current_period_start,
    current_period_end,
    cancel_at_period_end
  )
  values (
    p_user_id,
    'beta',
    'active',
    null,
    'internal',
    null,
    null,
    false
  )
  on conflict (user_id) do update
  set plan_code = 'beta',
      status = 'active',
      billing_interval = null,
      provider = 'internal',
      current_period_start = null,
      current_period_end = null,
      cancel_at_period_end = false,
      updated_at = now();

  insert into public.beta_user_entitlements (
    user_id,
    invite_code_id,
    verified_at
  )
  values (p_user_id, beta_invite_id, now())
  on conflict (user_id) do update
  set invite_code_id = excluded.invite_code_id,
      verified_at = excluded.verified_at;

  return true;
end;
$$;

revoke all on function public.activate_ficonter_beta_for_existing_user(uuid, text) from public;
revoke all on function public.activate_ficonter_beta_for_existing_user(uuid, text) from anon;
revoke all on function public.activate_ficonter_beta_for_existing_user(uuid, text) from authenticated;
grant execute on function public.activate_ficonter_beta_for_existing_user(uuid, text) to service_role;

comment on function public.create_default_ficonter_subscription() is
  'Creates Free for normal signups. New-account Beta requires a validated single-use private invitation token.';

comment on function public.activate_ficonter_beta_for_existing_user(uuid, text) is
  'Existing customer Beta activation. Service-only RPC validates a private invitation and records permanent code-verification proof before Beta is trusted.';

comment on function public.enforce_ficonter_beta_assignment() is
  'Fail-safe guard: entering Beta without validated transaction authorization is forced to Free. URLs and client input cannot select Beta.';

commit;

-- Verification output only. These SELECTs make no changes.
select column_default as subscriptions_plan_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'subscriptions'
  and column_name = 'plan_code';

select proname as beta_security_function
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname in (
    'create_default_ficonter_subscription',
    'activate_ficonter_beta_for_existing_user',
    'enforce_ficonter_beta_assignment'
  )
order by proname;


select table_name as beta_security_table
from information_schema.tables
where table_schema = 'public'
  and table_name in ('beta_invite_codes', 'beta_signup_tokens', 'beta_user_entitlements', 'beta_login_sessions')
order by table_name;
