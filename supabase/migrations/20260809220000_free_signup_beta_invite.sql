-- FICONTER — Free customer signup + private Beta invitation separation
-- Existing subscription rows are intentionally preserved.
-- Normal future sign-ups become Free. Only a valid short-lived Beta token can
-- create a Beta subscription.

begin;

-- 1) Fail-safe database default: missing plan selection means Free, never Beta.
alter table public.subscriptions
  alter column plan_code set default 'free';

-- 2) Private Beta invitation-code registry.
-- Only trusted server-side code/service_role can read or mutate this table.
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

-- 3) One-time, short-lived signup tokens. The real Beta code never goes into
-- auth.users metadata; only this random, single-use token does.
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

-- 4) Seed the private Beta invitation using only its SHA-256 hash.
-- Plaintext Beta code is deliberately NOT stored in GitHub/Supabase.
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

-- 5) Replace the original all-Beta signup trigger.
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
    -- Consume the one-time token atomically first. A token cannot be reused.
    update public.beta_signup_tokens
    set consumed_at = now()
    where token = beta_token
      and consumed_at is null
      and expires_at > now()
    returning invite_code_id into beta_invite_id;

    if beta_invite_id is not null then
      -- Count the Beta invitation only if it is still active and within limit.
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

-- Preserve the same trigger name so existing deployments switch behavior
-- without creating a second signup trigger.
drop trigger if exists on_auth_user_created_ficonter_subscription on auth.users;
create trigger on_auth_user_created_ficonter_subscription
after insert on auth.users
for each row
execute function public.create_default_ficonter_subscription();

comment on function public.create_default_ficonter_subscription() is
  'Creates Free subscriptions for normal FICONTER signups and Beta only after a validated one-time private invitation token.';

commit;
