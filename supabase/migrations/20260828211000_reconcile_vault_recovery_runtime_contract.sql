-- FICONTER · Reconcile the ordered Vault Assisted Recovery runtime contract.
--
-- These objects already exist in staging from the hardened recovery rollout.
-- This migration makes the ordered migration history reproduce that same
-- service-only contract on a fresh database. No private recovery key material
-- is stored in this migration; private key material remains in Supabase Vault.

begin;

alter table public.vault_recovery_requests
  add column if not exists verification_started_by uuid references auth.users(id),
  add column if not exists verification_started_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz;

alter table public.vault_recovery_documents
  add column if not exists sent_to_customer_at timestamptz,
  add column if not exists sent_to_customer_by uuid references auth.users(id) on delete set null,
  add column if not exists customer_signed_at timestamptz,
  add column if not exists customer_signed_by uuid references auth.users(id) on delete set null,
  add column if not exists customer_signature text,
  add column if not exists customer_signature_method text,
  add column if not exists customer_submission_ip_hash text,
  add column if not exists customer_submission_user_agent_hash text;

alter table public.vault_recovery_case_audit
  drop constraint if exists vault_recovery_case_audit_action_check;

alter table public.vault_recovery_case_audit
  add constraint vault_recovery_case_audit_action_check check (
    action = any (array[
      'created'::text,
      'updated'::text,
      'archived'::text,
      'restored'::text,
      'status_verification_pending'::text,
      'status_consent_signed'::text,
      'status_approved'::text,
      'status_rejected'::text,
      'status_cancelled'::text,
      'consent_document_generated'::text,
      'signed_consent_uploaded'::text,
      'consent_document_sent_to_customer'::text,
      'customer_electronic_consent_signed'::text,
      'recovery_access_issued'::text,
      'recovery_access_revoked'::text,
      'recovery_access_claimed'::text,
      'recovery_access_completed'::text,
      'recovery_access_expired'::text,
      'recovery_access_failed'::text,
      'customer_recovery_key_bound'::text,
      'customer_recovery_key_rebound'::text,
      'recovery_material_issued'::text,
      'recovery_bootstrap_completed'::text,
      'assisted_recovery_completed'::text
    ])
  );

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
  recovery_material_issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vault_recovery_access_expiry_check check (expires_at > issued_at)
);

alter table public.vault_recovery_access_grants
  add column if not exists recovery_material_issued_at timestamptz;

create index if not exists vault_recovery_access_request_idx
  on public.vault_recovery_access_grants (recovery_request_id, issued_at desc);
create index if not exists vault_recovery_access_user_idx
  on public.vault_recovery_access_grants (user_id, issued_at desc);
create unique index if not exists vault_recovery_access_one_active_per_request_idx
  on public.vault_recovery_access_grants (recovery_request_id)
  where status in ('issued','claimed');

alter table public.vault_recovery_access_grants enable row level security;
revoke all on table public.vault_recovery_access_grants from anon, authenticated;

create table if not exists public.vault_emergency_recovery_envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recovery_request_id uuid references public.vault_recovery_requests(id) on delete set null,
  recovery_access_grant_id uuid references public.vault_recovery_access_grants(id) on delete set null,
  recovery_version integer not null check (recovery_version >= 1),
  key_version integer not null check (key_version >= 1),
  envelope_version integer not null default 1 check (envelope_version = 1),
  algorithm text not null check (algorithm = 'RSA-OAEP-256'),
  kms_key_id text not null,
  ciphertext text not null,
  status text not null default 'active' check (status in ('active','superseded','revoked')),
  created_via text not null default 'customer_rotation' check (created_via in ('vault_creation','customer_rotation','assisted_recovery')),
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists vault_emergency_recovery_one_active_per_user_idx
  on public.vault_emergency_recovery_envelopes (user_id)
  where status = 'active';
create index if not exists vault_emergency_recovery_request_idx
  on public.vault_emergency_recovery_envelopes (recovery_request_id, created_at desc);
create index if not exists vault_emergency_recovery_user_history_idx
  on public.vault_emergency_recovery_envelopes (user_id, created_at desc);

alter table public.vault_emergency_recovery_envelopes enable row level security;
revoke all on table public.vault_emergency_recovery_envelopes from anon, authenticated;

create table if not exists public.ficonter_recovery_key_registry (
  kid text primary key,
  algorithm text not null check (algorithm = 'RSA-OAEP-256'),
  public_jwk jsonb not null,
  vault_secret_name text not null unique,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index if not exists ficonter_one_active_recovery_key_idx
  on public.ficonter_recovery_key_registry (active)
  where active = true;

alter table public.ficonter_recovery_key_registry enable row level security;
revoke all on table public.ficonter_recovery_key_registry from public, anon, authenticated;
grant all on table public.ficonter_recovery_key_registry to service_role;

create or replace function public.customer_create_financial_vault_with_recovery(
  p_user_id uuid,
  p_wrapped_vault_key jsonb,
  p_emergency_envelope jsonb
)
returns table (
  user_id uuid,
  key_version integer,
  recovery_version integer,
  vault_status text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_alg text;
  v_kid text;
  v_ct text;
begin
  if p_user_id is null then
    raise exception 'Authenticated customer is required.';
  end if;

  perform 1 from public.user_financial_vaults v where v.user_id = p_user_id;
  if found then
    raise exception 'A Financial Vault already exists for this account.';
  end if;

  if p_wrapped_vault_key->>'v' <> '1'
     or p_wrapped_vault_key->>'alg' <> 'A256GCM'
     or p_wrapped_vault_key->>'kdf' <> 'HKDF-SHA256'
     or nullif(p_wrapped_vault_key->>'salt','') is null
     or nullif(p_wrapped_vault_key->>'iv','') is null
     or nullif(p_wrapped_vault_key->>'ct','') is null then
    raise exception 'Invalid wrapped Vault-key envelope.';
  end if;

  v_alg := p_emergency_envelope->>'alg';
  v_kid := p_emergency_envelope->>'kid';
  v_ct := p_emergency_envelope->>'ct';

  if p_emergency_envelope->>'v' <> '1'
     or v_alg <> 'RSA-OAEP-256'
     or nullif(v_kid,'') is null
     or nullif(v_ct,'') is null then
    raise exception 'Invalid emergency recovery envelope.';
  end if;

  insert into public.user_financial_vaults (
    user_id,
    wrapped_vault_key,
    key_version,
    recovery_version,
    vault_status
  ) values (
    p_user_id,
    p_wrapped_vault_key,
    1,
    1,
    'active'
  );

  insert into public.vault_emergency_recovery_envelopes (
    user_id,
    recovery_version,
    key_version,
    envelope_version,
    algorithm,
    kms_key_id,
    ciphertext,
    status,
    created_via
  ) values (
    p_user_id,
    1,
    1,
    1,
    v_alg,
    v_kid,
    v_ct,
    'active',
    'vault_creation'
  );

  return query select p_user_id, 1, 1, 'active'::text;
end;
$function$;

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
as $function$
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

  if not found then raise exception 'Recovery request not found.'; end if;
  if v_request.archived_at is not null then raise exception 'Restore the case before issuing recovery access.'; end if;
  if v_request.status not in ('approved','recovery_issued') then raise exception 'Recovery access can only be issued after approval.'; end if;

  if v_request.verified_by is null or v_request.verified_at is null
     or v_request.approved_by is null or v_request.approved_at is null then
    raise exception 'Completed verification and dual-control approval are required before Recovery Access can be issued.';
  end if;
  if v_request.verified_by = v_request.approved_by then
    raise exception 'Dual control violation: verifier and approver must be different staff members.';
  end if;

  select d.document_id into v_document_id
  from public.vault_recovery_documents d
  where d.recovery_request_id = p_recovery_request_id
    and coalesce(d.customer_signed_at,d.signed_at,d.signed_uploaded_at) is not null
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
    select 1 from public.vault_recovery_access_grants g
    where g.recovery_request_id = p_recovery_request_id
      and g.status in ('issued','claimed')
      and g.expires_at > v_now
  ) then
    raise exception 'An active recovery access grant already exists for this case.';
  end if;

  insert into public.vault_recovery_access_grants (
    recovery_request_id,user_id,status,issued_by,issued_at,expires_at,created_at,updated_at
  ) values (
    p_recovery_request_id,v_request.user_id,'issued',p_actor_id,v_now,
    v_now + make_interval(secs => p_ttl_seconds),v_now,v_now
  ) returning * into v_grant;

  update public.vault_recovery_requests
  set status = 'recovery_issued', updated_by = p_actor_id, updated_at = v_now
  where id = p_recovery_request_id;

  insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
  values (
    p_recovery_request_id,
    'recovery_access_issued',
    p_actor_id,
    jsonb_build_object(
      'grant_id',v_grant.id,
      'issued_at',v_grant.issued_at,
      'expires_at',v_grant.expires_at,
      'ttl_seconds',p_ttl_seconds,
      'signed_document_id',v_document_id,
      'verifier_id',v_request.verified_by,
      'approver_id',v_request.approved_by
    )
  );

  return query select v_grant.id,v_grant.recovery_request_id,v_grant.user_id,v_grant.status,v_grant.issued_at,v_grant.expires_at;
end;
$function$;

create or replace function public.admin_revoke_vault_recovery_access(
  p_recovery_request_id uuid,
  p_actor_id uuid
)
returns table (id uuid, status text, revoked_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_grant public.vault_recovery_access_grants%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  perform 1
  from public.vault_recovery_requests r
  where r.id = p_recovery_request_id
  for update;
  if not found then raise exception 'Recovery request not found.'; end if;

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

  insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
  values (p_recovery_request_id,'recovery_access_revoked',p_actor_id,jsonb_build_object('grant_id',v_grant.id,'revoked_at',v_now));

  return query select v_grant.id,v_grant.status,v_grant.revoked_at;
end;
$function$;

create or replace function public.customer_claim_vault_recovery_access(
  p_recovery_request_id uuid,
  p_user_id uuid
)
returns table (
  id uuid,
  recovery_request_id uuid,
  user_id uuid,
  status text,
  issued_at timestamptz,
  expires_at timestamptz,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null then raise exception 'Authenticated customer is required.'; end if;

  select * into v_request
  from public.vault_recovery_requests r
  where r.id = p_recovery_request_id and r.user_id = p_user_id
  for update;

  if not found then raise exception 'Recovery request not found.'; end if;
  if v_request.archived_at is not null then raise exception 'This recovery request is no longer active.'; end if;
  if v_request.status <> 'recovery_issued' then raise exception 'Recovery Access is not currently available for this request.'; end if;

  select * into v_grant
  from public.vault_recovery_access_grants g
  where g.recovery_request_id = p_recovery_request_id
    and g.user_id = p_user_id
    and g.status in ('issued','claimed')
  order by g.issued_at desc
  limit 1
  for update;

  if not found then raise exception 'No active Recovery Access grant was found.'; end if;

  if v_grant.expires_at <= v_now then
    update public.vault_recovery_access_grants g
    set status = 'expired', updated_at = v_now
    where g.id = v_grant.id
    returning * into v_grant;

    insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
    values (p_recovery_request_id,'recovery_access_expired',p_user_id,jsonb_build_object('grant_id',v_grant.id,'expired_at',v_now));

    return query select v_grant.id,v_grant.recovery_request_id,v_grant.user_id,v_grant.status,v_grant.issued_at,v_grant.expires_at,v_grant.claimed_at;
    return;
  end if;

  if v_grant.status = 'issued' then
    update public.vault_recovery_access_grants g
    set status = 'claimed', claimed_at = v_now, updated_at = v_now
    where g.id = v_grant.id
    returning * into v_grant;

    insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
    values (p_recovery_request_id,'recovery_access_claimed',p_user_id,jsonb_build_object('grant_id',v_grant.id,'claimed_at',v_grant.claimed_at));
  end if;

  return query select v_grant.id,v_grant.recovery_request_id,v_grant.user_id,v_grant.status,v_grant.issued_at,v_grant.expires_at,v_grant.claimed_at;
end;
$function$;

create or replace function public.customer_bind_vault_recovery_key(
  p_recovery_request_id uuid,
  p_user_id uuid,
  p_algorithm text,
  p_public_key text
)
returns table (
  id uuid,
  status text,
  customer_key_algorithm text,
  customer_ephemeral_public_key text,
  key_bound_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_now timestamptz := clock_timestamp();
  v_action text := 'customer_recovery_key_bound';
begin
  if p_user_id is null then raise exception 'Authenticated customer is required.'; end if;
  if p_algorithm <> 'RSA-OAEP-256' then raise exception 'Unsupported customer recovery key algorithm.'; end if;
  if p_public_key is null or length(p_public_key) < 100 or length(p_public_key) > 12000 then
    raise exception 'Invalid customer recovery public key.';
  end if;

  select * into v_request
  from public.vault_recovery_requests r
  where r.id = p_recovery_request_id and r.user_id = p_user_id
  for update;
  if not found or v_request.archived_at is not null then raise exception 'Recovery request is not active.'; end if;

  select * into v_grant
  from public.vault_recovery_access_grants g
  where g.recovery_request_id = p_recovery_request_id
    and g.user_id = p_user_id
    and g.status = 'claimed'
  order by g.issued_at desc
  limit 1
  for update;
  if not found then raise exception 'A claimed Recovery Access grant is required.'; end if;

  if v_grant.expires_at <= v_now then
    update public.vault_recovery_access_grants set status='expired',updated_at=v_now where id=v_grant.id;
    raise exception 'Recovery Access has expired.';
  end if;

  if v_grant.customer_ephemeral_public_key is not null then
    if v_grant.customer_key_algorithm = p_algorithm and v_grant.customer_ephemeral_public_key = p_public_key then
      return query select v_grant.id,v_grant.status,v_grant.customer_key_algorithm,v_grant.customer_ephemeral_public_key,v_grant.key_bound_at,v_grant.expires_at;
      return;
    end if;
    if v_grant.recovery_material_issued_at is not null then
      raise exception 'Recovery material was already issued to the previously bound browser key. A new Recovery Access is required.';
    end if;
    v_action := 'customer_recovery_key_rebound';
  end if;

  update public.vault_recovery_access_grants g
  set customer_key_algorithm=p_algorithm,
      customer_ephemeral_public_key=p_public_key,
      key_bound_at=v_now,
      updated_at=v_now
  where g.id=v_grant.id
  returning * into v_grant;

  insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
  values (p_recovery_request_id,v_action,p_user_id,jsonb_build_object('grant_id',v_grant.id,'algorithm',p_algorithm,'key_bound_at',v_grant.key_bound_at));

  return query select v_grant.id,v_grant.status,v_grant.customer_key_algorithm,v_grant.customer_ephemeral_public_key,v_grant.key_bound_at,v_grant.expires_at;
end;
$function$;

create or replace function public.customer_complete_vault_assisted_recovery(
  p_recovery_request_id uuid,
  p_user_id uuid,
  p_expected_recovery_version integer,
  p_wrapped_vault_key jsonb
)
returns table (
  recovery_version integer,
  grant_status text,
  request_status text,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_vault public.user_financial_vaults%rowtype;
  v_emergency public.vault_emergency_recovery_envelopes%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_recovery_version integer;
begin
  if p_user_id is null then raise exception 'Authenticated customer is required.'; end if;

  select * into v_request from public.vault_recovery_requests r
  where r.id=p_recovery_request_id and r.user_id=p_user_id for update;
  if not found or v_request.archived_at is not null then raise exception 'Recovery request is not active.'; end if;

  select * into v_grant from public.vault_recovery_access_grants g
  where g.recovery_request_id=p_recovery_request_id and g.user_id=p_user_id and g.status='claimed'
  order by g.issued_at desc limit 1 for update;
  if not found then raise exception 'A claimed Recovery Access grant is required.'; end if;

  if v_grant.expires_at <= v_now then
    update public.vault_recovery_access_grants set status='expired',updated_at=v_now where id=v_grant.id;
    raise exception 'Recovery Access has expired.';
  end if;

  if v_grant.customer_key_algorithm <> 'RSA-OAEP-256'
     or v_grant.customer_ephemeral_public_key is null
     or v_grant.key_bound_at is null
     or v_grant.recovery_material_issued_at is null then
    raise exception 'Customer-bound recovery material has not been issued.';
  end if;

  select * into v_vault from public.user_financial_vaults v where v.user_id=p_user_id for update;
  if not found then raise exception 'Financial Vault could not be found.'; end if;
  if coalesce(v_vault.recovery_version,1) <> p_expected_recovery_version then
    raise exception 'Vault recovery material changed. Reload and restart recovery.';
  end if;

  if p_wrapped_vault_key->>'v' <> '1'
     or p_wrapped_vault_key->>'alg' <> 'A256GCM'
     or p_wrapped_vault_key->>'kdf' <> 'HKDF-SHA256'
     or nullif(p_wrapped_vault_key->>'salt','') is null
     or nullif(p_wrapped_vault_key->>'iv','') is null
     or nullif(p_wrapped_vault_key->>'ct','') is null then
    raise exception 'Invalid wrapped Vault-key envelope.';
  end if;

  select * into v_emergency
  from public.vault_emergency_recovery_envelopes e
  where e.user_id=p_user_id and e.status='active'
  for update;
  if not found then raise exception 'Active emergency recovery envelope was not found.'; end if;

  v_next_recovery_version := p_expected_recovery_version + 1;

  update public.vault_emergency_recovery_envelopes
  set status='superseded',superseded_at=v_now where id=v_emergency.id;

  update public.user_financial_vaults
  set wrapped_vault_key=p_wrapped_vault_key,
      recovery_version=v_next_recovery_version,
      vault_status='active',
      last_unlocked_at=v_now,
      updated_at=v_now
  where user_id=p_user_id;

  insert into public.vault_emergency_recovery_envelopes (
    user_id,recovery_request_id,recovery_access_grant_id,recovery_version,key_version,
    envelope_version,algorithm,kms_key_id,ciphertext,status,created_via,created_at
  ) values (
    p_user_id,p_recovery_request_id,v_grant.id,v_next_recovery_version,v_emergency.key_version,
    v_emergency.envelope_version,v_emergency.algorithm,v_emergency.kms_key_id,v_emergency.ciphertext,
    'active','assisted_recovery',v_now
  );

  update public.vault_recovery_access_grants
  set status='completed',completed_at=v_now,updated_at=v_now where id=v_grant.id;
  update public.vault_recovery_requests set status='completed',updated_at=v_now where id=p_recovery_request_id;

  insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
  values (
    p_recovery_request_id,'assisted_recovery_completed',p_user_id,
    jsonb_build_object('grant_id',v_grant.id,'previous_recovery_version',p_expected_recovery_version,'recovery_version',v_next_recovery_version,'kms_key_id',v_emergency.kms_key_id,'completed_at',v_now)
  );

  return query select v_next_recovery_version,'completed'::text,'completed'::text,v_now;
end;
$function$;

create or replace function public.customer_complete_vault_recovery_bootstrap(
  p_recovery_request_id uuid,
  p_user_id uuid,
  p_expected_recovery_version integer,
  p_wrapped_vault_key jsonb,
  p_emergency_envelope jsonb
)
returns table (
  recovery_version integer,
  grant_status text,
  request_status text,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_vault public.user_financial_vaults%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_recovery_version integer;
  v_kid text;
  v_ct text;
  v_alg text;
begin
  if p_user_id is null then raise exception 'Authenticated customer is required.'; end if;

  select * into v_request from public.vault_recovery_requests r
  where r.id=p_recovery_request_id and r.user_id=p_user_id for update;
  if not found or v_request.archived_at is not null then raise exception 'Recovery request is not active.'; end if;

  select * into v_grant from public.vault_recovery_access_grants g
  where g.recovery_request_id=p_recovery_request_id and g.user_id=p_user_id and g.status='claimed'
  order by g.issued_at desc limit 1 for update;
  if not found then raise exception 'A claimed Recovery Access grant is required.'; end if;

  if v_grant.expires_at <= v_now then
    update public.vault_recovery_access_grants set status='expired',updated_at=v_now where id=v_grant.id;
    raise exception 'Recovery Access has expired.';
  end if;

  select * into v_vault from public.user_financial_vaults v where v.user_id=p_user_id for update;
  if not found then raise exception 'Financial Vault could not be found.'; end if;
  if coalesce(v_vault.recovery_version,1) <> p_expected_recovery_version then
    raise exception 'Vault recovery material changed. Reload and try again.';
  end if;

  if p_wrapped_vault_key->>'v' <> '1'
     or p_wrapped_vault_key->>'alg' <> 'A256GCM'
     or p_wrapped_vault_key->>'kdf' <> 'HKDF-SHA256'
     or nullif(p_wrapped_vault_key->>'salt','') is null
     or nullif(p_wrapped_vault_key->>'iv','') is null
     or nullif(p_wrapped_vault_key->>'ct','') is null then
    raise exception 'Invalid wrapped Vault-key envelope.';
  end if;

  v_alg := p_emergency_envelope->>'alg';
  v_kid := p_emergency_envelope->>'kid';
  v_ct := p_emergency_envelope->>'ct';
  if p_emergency_envelope->>'v' <> '1'
     or v_alg <> 'RSA-OAEP-256'
     or nullif(v_kid,'') is null
     or nullif(v_ct,'') is null then
    raise exception 'Invalid emergency recovery envelope.';
  end if;

  v_next_recovery_version := p_expected_recovery_version + 1;

  update public.vault_emergency_recovery_envelopes
  set status='superseded',superseded_at=v_now
  where user_id=p_user_id and status='active';

  update public.user_financial_vaults
  set wrapped_vault_key=p_wrapped_vault_key,
      recovery_version=v_next_recovery_version,
      vault_status='active',
      last_unlocked_at=v_now,
      updated_at=v_now
  where user_id=p_user_id;

  insert into public.vault_emergency_recovery_envelopes (
    user_id,recovery_request_id,recovery_access_grant_id,recovery_version,key_version,
    envelope_version,algorithm,kms_key_id,ciphertext,status,created_via,created_at
  ) values (
    p_user_id,p_recovery_request_id,v_grant.id,v_next_recovery_version,coalesce(v_vault.key_version,1),
    1,v_alg,v_kid,v_ct,'active','customer_rotation',v_now
  );

  update public.vault_recovery_access_grants
  set status='completed',completed_at=v_now,updated_at=v_now where id=v_grant.id;
  update public.vault_recovery_requests set status='completed',updated_at=v_now where id=p_recovery_request_id;

  insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
  values (
    p_recovery_request_id,'recovery_bootstrap_completed',p_user_id,
    jsonb_build_object('grant_id',v_grant.id,'recovery_version',v_next_recovery_version,'kms_key_id',v_kid,'completed_at',v_now)
  );

  return query select v_next_recovery_version,'completed'::text,'completed'::text,v_now;
end;
$function$;

create or replace function public.customer_submit_vault_recovery_consent(
  p_recovery_request_id uuid,
  p_user_id uuid,
  p_signature text,
  p_ip_hash text default null,
  p_user_agent_hash text default null
)
returns table (document_id text, signed_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_document public.vault_recovery_documents%rowtype;
  v_now timestamptz := clock_timestamp();
  v_signature text := btrim(coalesce(p_signature,''));
begin
  if p_user_id is null then raise exception 'Authenticated customer is required.'; end if;
  if length(v_signature) < 2 or length(v_signature) > 500 then
    raise exception 'Add your electronic signature before submitting the document.';
  end if;
  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request metadata.'; end if;
  if p_user_agent_hash is not null and p_user_agent_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request metadata.'; end if;

  select * into v_request
  from public.vault_recovery_requests r
  where r.id=p_recovery_request_id and r.user_id=p_user_id
  for update;
  if not found then raise exception 'Recovery request not found.'; end if;
  if v_request.archived_at is not null then raise exception 'This recovery request is no longer active.'; end if;
  if v_request.status <> 'consent_pending' then raise exception 'This recovery request is not awaiting consent.'; end if;

  select * into v_document
  from public.vault_recovery_documents d
  where d.recovery_request_id=p_recovery_request_id and d.sent_to_customer_at is not null
  order by d.generated_at desc
  limit 1
  for update;
  if not found then raise exception 'No consent document has been sent to this account.'; end if;
  if coalesce(v_document.customer_signed_at,v_document.signed_at,v_document.signed_uploaded_at) is not null then
    raise exception 'This consent document has already been signed.';
  end if;

  update public.vault_recovery_documents
  set status='signed',
      customer_signed_at=v_now,
      customer_signed_by=p_user_id,
      customer_signature=v_signature,
      customer_signature_method='authenticated_electronic_signature',
      customer_submission_ip_hash=p_ip_hash,
      customer_submission_user_agent_hash=p_user_agent_hash,
      signed_at=v_now
  where id=v_document.id;

  update public.vault_recovery_requests
  set status='consent_signed',updated_by=p_user_id,updated_at=v_now
  where id=p_recovery_request_id;

  insert into public.vault_recovery_case_audit(recovery_request_id,action,actor_id,details)
  values (
    p_recovery_request_id,'customer_electronic_consent_signed',p_user_id,
    jsonb_build_object('document_id',v_document.document_id,'sent_at',v_document.sent_to_customer_at,'signed_at',v_now,'signature_method','authenticated_electronic_signature','ip_hash_recorded',p_ip_hash is not null,'user_agent_hash_recorded',p_user_agent_hash is not null)
  );

  insert into public.user_notifications(user_id,kind,title,body,href,metadata)
  values (
    p_user_id,'system','Vault recovery consent submitted',
    'Your signed Vault recovery consent was received by FICONTER.',
    '/dashboard/inbox/vault-recovery/' || p_recovery_request_id::text,
    jsonb_build_object('recovery_request_id',p_recovery_request_id,'document_id',v_document.document_id)
  );

  return query select v_document.document_id,v_now;
end;
$function$;

create or replace function public.ficonter_get_active_recovery_private_key()
returns table (kid text, algorithm text, private_jwk text)
language sql
security definer
set search_path = public, vault, pg_temp
as $function$
  select r.kid,r.algorithm,s.decrypted_secret
  from public.ficonter_recovery_key_registry r
  join vault.decrypted_secrets s on s.name=r.vault_secret_name
  where r.active=true
  order by r.created_at desc
  limit 1;
$function$;

revoke all on function public.customer_create_financial_vault_with_recovery(uuid,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.customer_bind_vault_recovery_key(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.customer_complete_vault_assisted_recovery(uuid,uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.customer_complete_vault_recovery_bootstrap(uuid,uuid,integer,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.customer_submit_vault_recovery_consent(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_issue_vault_recovery_access(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.admin_revoke_vault_recovery_access(uuid,uuid) from public, anon, authenticated;
revoke all on function public.customer_claim_vault_recovery_access(uuid,uuid) from public, anon, authenticated;
revoke all on function public.ficonter_get_active_recovery_private_key() from public, anon, authenticated;

grant execute on function public.customer_create_financial_vault_with_recovery(uuid,jsonb,jsonb) to service_role;
grant execute on function public.customer_bind_vault_recovery_key(uuid,uuid,text,text) to service_role;
grant execute on function public.customer_complete_vault_assisted_recovery(uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.customer_complete_vault_recovery_bootstrap(uuid,uuid,integer,jsonb,jsonb) to service_role;
grant execute on function public.customer_submit_vault_recovery_consent(uuid,uuid,text,text,text) to service_role;
grant execute on function public.admin_issue_vault_recovery_access(uuid,uuid,integer) to service_role;
grant execute on function public.admin_revoke_vault_recovery_access(uuid,uuid) to service_role;
grant execute on function public.customer_claim_vault_recovery_access(uuid,uuid) to service_role;
grant execute on function public.ficonter_get_active_recovery_private_key() to service_role;

commit;

notify pgrst, 'reload schema';
