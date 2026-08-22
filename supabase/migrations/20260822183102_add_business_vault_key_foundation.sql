begin;

create table if not exists public.user_business_keypairs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key_jwk jsonb not null,
  encrypted_private_key jsonb not null,
  encryption_version smallint not null default 1 check (encryption_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_vaults (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  vault_version smallint not null default 1 check (vault_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_vault_member_keys (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wrapped_business_key jsonb not null,
  wrap_version smallint not null default 1 check (wrap_version = 1),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

alter table public.user_business_keypairs enable row level security;
alter table public.business_vaults enable row level security;
alter table public.business_vault_member_keys enable row level security;

drop policy if exists user_business_keypairs_select_own on public.user_business_keypairs;
create policy user_business_keypairs_select_own on public.user_business_keypairs
for select using (user_id = auth.uid());

drop policy if exists user_business_keypairs_insert_own on public.user_business_keypairs;
create policy user_business_keypairs_insert_own on public.user_business_keypairs
for insert with check (user_id = auth.uid());

drop policy if exists user_business_keypairs_update_own on public.user_business_keypairs;
create policy user_business_keypairs_update_own on public.user_business_keypairs
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists business_vaults_select_member on public.business_vaults;
create policy business_vaults_select_member on public.business_vaults
for select using (public.business_member_has_access(business_id));

drop policy if exists business_vaults_insert_manager on public.business_vaults;
create policy business_vaults_insert_manager on public.business_vaults
for insert with check (public.business_member_can_manage(business_id));

drop policy if exists business_vaults_update_manager on public.business_vaults;
create policy business_vaults_update_manager on public.business_vaults
for update using (public.business_member_can_manage(business_id))
with check (public.business_member_can_manage(business_id));

drop policy if exists business_vault_member_keys_select_own on public.business_vault_member_keys;
create policy business_vault_member_keys_select_own on public.business_vault_member_keys
for select using (user_id = auth.uid() and public.business_member_has_access(business_id));

drop policy if exists business_vault_member_keys_select_manager on public.business_vault_member_keys;
create policy business_vault_member_keys_select_manager on public.business_vault_member_keys
for select using (public.business_member_can_manage(business_id));

drop policy if exists business_vault_member_keys_insert_manager on public.business_vault_member_keys;
create policy business_vault_member_keys_insert_manager on public.business_vault_member_keys
for insert with check (public.business_member_can_manage(business_id));

drop policy if exists business_vault_member_keys_update_manager on public.business_vault_member_keys;
create policy business_vault_member_keys_update_manager on public.business_vault_member_keys
for update using (public.business_member_can_manage(business_id))
with check (public.business_member_can_manage(business_id));

drop policy if exists business_vault_member_keys_delete_manager on public.business_vault_member_keys;
create policy business_vault_member_keys_delete_manager on public.business_vault_member_keys
for delete using (public.business_member_can_manage(business_id));

create or replace function public.ensure_business_vault_record(p_business_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not public.business_member_can_manage(p_business_id) then
    raise exception 'Business management access is required.' using errcode = '42501';
  end if;
  insert into public.business_vaults (business_id)
  values (p_business_id)
  on conflict (business_id) do nothing;
  return p_business_id;
end;
$$;

revoke all on function public.ensure_business_vault_record(uuid) from public, anon;
grant execute on function public.ensure_business_vault_record(uuid) to authenticated, service_role;

commit;
