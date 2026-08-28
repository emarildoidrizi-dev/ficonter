-- FICONTER · Vault Assisted Recovery access control plane
-- Creates short-lived, one-time, user-bound Recovery Access grants.
-- This does NOT store or expose readable Financial Vault keys.

begin;

create table if not exists public.vault_recovery_access_grants (
  id uuid primary key default gen_random_uuid(),
  recovery_request_id uuid not null references public.vault_recovery_requests(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'issued' check (status in ('issued','claimed','completed','expired','revoked','failed')),
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  failure_reason text,
  customer_key_algorithm text,
  customer_ephemeral_public_key text,
  key_bound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vault_recovery_access_expiry_check check (expires_at > issued_at)
);

create index if not exists vault_recovery_access_request_idx
  on public.vault_recovery_access_grants (recovery_request_id, issued_at desc);

create index if not exists vault_recovery_access_user_idx
  on public.vault_recovery_access_grants (user_id, issued_at desc);

create unique index if not exists vault_recovery_access_one_active_per_request_idx
  on public.vault_recovery_access_grants (recovery_request_id)
  where status in ('issued','claimed');

alter table public.vault_recovery_access_grants enable row level security;

create or replace function public.admin_issue_vault_recovery_access(
  p_recovery_request_id uuid,
  p_actor_id uuid,
  p_ttl_seconds integer default 900
)
returns table (
  id uuid,
  recovery_request_id uuid,
  user_id uuid,
  status text,
  issued_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_now timestamptz := clock_timestamp();
  v_document_id text;
begin
  if p_ttl_seconds < 300 or p_ttl_seconds > 3600 then
    raise exception 'Recovery access lifetime must be between 5 and 60 minutes.';
  end if;

  select * into v_request
  from public.vault_recovery_requests
  where vault_recovery_requests.id = p_recovery_request_id
  for update;

  if not found then
    raise exception 'Recovery request not found.';
  end if;

  if v_request.archived_at is not null then
    raise exception 'Restore the case before issuing recovery access.';
  end if;

  if v_request.status not in ('approved', 'recovery_issued') then
    raise exception 'Recovery access can only be issued after approval.';
  end if;

  select d.document_id into v_document_id
  from public.vault_recovery_documents d
  where d.recovery_request_id = p_recovery_request_id
    and coalesce(d.customer_signed_at, d.signed_at, d.signed_uploaded_at) is not null
  order by d.generated_at desc
  limit 1;

  if v_document_id is null then
    raise exception 'A signed recovery consent is required before recovery access can be issued.';
  end if;

  update public.vault_recovery_access_grants g
  set status = 'expired', updated_at = v_now
  where g.recovery_request_id = p_recovery_request_id
    and g.status in ('issued','claimed')
    and g.expires_at <= v_now;

  if exists (
    select 1
    from public.vault_recovery_access_grants g
    where g.recovery_request_id = p_recovery_request_id
      and g.status in ('issued','claimed')
      and g.expires_at > v_now
  ) then
    raise exception 'An active recovery access grant already exists for this case.';
  end if;

  insert into public.vault_recovery_access_grants (
    recovery_request_id,
    user_id,
    status,
    issued_by,
    issued_at,
    expires_at,
    created_at,
    updated_at
  ) values (
    p_recovery_request_id,
    v_request.user_id,
    'issued',
    p_actor_id,
    v_now,
    v_now + make_interval(secs => p_ttl_seconds),
    v_now,
    v_now
  ) returning * into v_grant;

  update public.vault_recovery_requests
  set status = 'recovery_issued', updated_by = p_actor_id, updated_at = v_now
  where vault_recovery_requests.id = p_recovery_request_id;

  insert into public.vault_recovery_case_audit (
    recovery_request_id,
    action,
    actor_id,
    details
  ) values (
    p_recovery_request_id,
    'recovery_access_issued',
    p_actor_id,
    jsonb_build_object(
      'grant_id', v_grant.id,
      'issued_at', v_grant.issued_at,
      'expires_at', v_grant.expires_at,
      'ttl_seconds', p_ttl_seconds,
      'signed_document_id', v_document_id
    )
  );

  return query
  select v_grant.id, v_grant.recovery_request_id, v_grant.user_id,
         v_grant.status, v_grant.issued_at, v_grant.expires_at;
end;
$$;

create or replace function public.admin_revoke_vault_recovery_access(
  p_recovery_request_id uuid,
  p_actor_id uuid
)
returns table (
  id uuid,
  status text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_grant public.vault_recovery_access_grants%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  perform 1
  from public.vault_recovery_requests r
  where r.id = p_recovery_request_id
  for update;

  if not found then
    raise exception 'Recovery request not found.';
  end if;

  select * into v_grant
  from public.vault_recovery_access_grants g
  where g.recovery_request_id = p_recovery_request_id
    and g.status in ('issued','claimed')
  order by g.issued_at desc
  limit 1
  for update;

  if not found then
    raise exception 'There is no active recovery access grant to revoke.';
  end if;

  update public.vault_recovery_access_grants
  set status = 'revoked', revoked_at = v_now, revoked_by = p_actor_id, updated_at = v_now
  where vault_recovery_access_grants.id = v_grant.id
  returning * into v_grant;

  insert into public.vault_recovery_case_audit (
    recovery_request_id,
    action,
    actor_id,
    details
  ) values (
    p_recovery_request_id,
    'recovery_access_revoked',
    p_actor_id,
    jsonb_build_object('grant_id', v_grant.id, 'revoked_at', v_now)
  );

  return query select v_grant.id, v_grant.status, v_grant.revoked_at;
end;
$$;

revoke all on table public.vault_recovery_access_grants from anon, authenticated;
revoke all on function public.admin_issue_vault_recovery_access(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_revoke_vault_recovery_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_issue_vault_recovery_access(uuid, uuid, integer) to service_role;
grant execute on function public.admin_revoke_vault_recovery_access(uuid, uuid) to service_role;

commit;

notify pgrst, 'reload schema';