-- FICONTER Zero-Knowledge Financial Vault
-- Stores only wrapped vault keys and operational metadata.
-- The readable financial vault key must never be stored here.

create table if not exists public.user_financial_vaults (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  -- Client-generated encrypted/wrapped vault key envelope.
  -- Contains ciphertext, IV, salt and format information only.
  wrapped_vault_key jsonb not null,

  key_version smallint not null default 1
    check (key_version > 0),

  recovery_version smallint not null default 1
    check (recovery_version > 0),

  vault_status text not null default 'active'
    check (
      vault_status in (
        'active',
        'locked',
        'recovery_required',
        'disabled'
      )
    ),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  last_unlocked_at timestamptz,

  constraint user_financial_vaults_user_unique
    unique (user_id),

  constraint user_financial_vaults_wrapped_key_object
    check (
      jsonb_typeof(wrapped_vault_key) = 'object'
    )
);

create index if not exists
  user_financial_vaults_user_id_idx
on public.user_financial_vaults(user_id);

alter table public.user_financial_vaults
  enable row level security;

-- Logged-in users may read only their own vault record.
drop policy if exists
  "Users can read own financial vault"
on public.user_financial_vaults;

create policy
  "Users can read own financial vault"
on public.user_financial_vaults
for select
to authenticated
using (
  (select auth.uid()) is not null
  and
  (select auth.uid()) = user_id
);

-- Logged-in users may create only their own vault record.
drop policy if exists
  "Users can create own financial vault"
on public.user_financial_vaults;

create policy
  "Users can create own financial vault"
on public.user_financial_vaults
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and
  (select auth.uid()) = user_id
);

-- Logged-in users may update only their own vault record.
drop policy if exists
  "Users can update own financial vault"
on public.user_financial_vaults;

create policy
  "Users can update own financial vault"
on public.user_financial_vaults
for update
to authenticated
using (
  (select auth.uid()) is not null
  and
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and
  (select auth.uid()) = user_id
);

-- Intentionally no DELETE policy for normal users.
-- Deleting the wrapped key could permanently destroy access
-- to encrypted financial data.
-- Account deletion remains an administrative/server operation.

grant select, insert, update
on public.user_financial_vaults
to authenticated;

grant all
on public.user_financial_vaults
to service_role;

create or replace function
  public.touch_user_financial_vault_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists
  user_financial_vaults_touch_updated_at
on public.user_financial_vaults;

create trigger
  user_financial_vaults_touch_updated_at
before update
on public.user_financial_vaults
for each row
execute function
  public.touch_user_financial_vault_updated_at();

comment on table public.user_financial_vaults is
  'Zero-knowledge vault metadata. Stores wrapped client-side vault keys only; never readable financial vault keys.';

comment on column
  public.user_financial_vaults.wrapped_vault_key is
  'Client-generated encrypted vault-key envelope. Ciphertext only.';

comment on column
  public.user_financial_vaults.vault_status is
  'Operational vault state visible to FICONTER without exposing financial contents.';

notify pgrst, 'reload schema';