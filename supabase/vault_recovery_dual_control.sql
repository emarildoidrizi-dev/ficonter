-- FICONTER Vault recovery dual-control hardening
-- Staging validated first. Apply to production only after final security acceptance.

alter table public.vault_recovery_requests
  add column if not exists verification_started_by uuid references auth.users(id),
  add column if not exists verification_started_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz;

create or replace function public.enforce_vault_recovery_dual_control()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if old.status = 'opened' and new.status = 'verification_pending' then
    if new.updated_by is null then
      raise exception 'Verification actor is required.';
    end if;
    new.verification_started_by := new.updated_by;
    new.verification_started_at := coalesce(new.verification_started_at, clock_timestamp());
  end if;

  if old.status = 'consent_signed' and new.status = 'approved' then
    if old.verification_started_by is null then
      raise exception 'A recorded verification actor is required before approval.';
    end if;
    if new.updated_by is null then
      raise exception 'Approval actor is required.';
    end if;
    if new.updated_by = old.verification_started_by then
      raise exception 'Dual control required: the verifier cannot approve the same recovery case.';
    end if;
    new.approved_by := new.updated_by;
    new.approved_at := clock_timestamp();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_vault_recovery_dual_control on public.vault_recovery_requests;
create trigger trg_vault_recovery_dual_control
before update of status on public.vault_recovery_requests
for each row
execute function public.enforce_vault_recovery_dual_control();

create or replace function public.admin_issue_vault_recovery_access(
  p_recovery_request_id uuid,
  p_actor_id uuid,
  p_ttl_seconds integer default 900
)
returns table(
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

  if not found then raise exception 'Recovery request not found.'; end if;
  if v_request.archived_at is not null then raise exception 'Restore the case before issuing recovery access.'; end if;
  if v_request.status not in ('approved', 'recovery_issued') then raise exception 'Recovery access can only be issued after approval.'; end if;
  if v_request.verification_started_by is null or v_request.approved_by is null or v_request.approved_at is null then
    raise exception 'Dual-control verification and approval are required before Recovery Access can be issued.';
  end if;
  if v_request.verification_started_by = v_request.approved_by then
    raise exception 'Dual control violation: verifier and approver must be different staff members.';
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
  where vault_recovery_requests.id = p_recovery_request_id;

  insert into public.vault_recovery_case_audit (
    recovery_request_id,action,actor_id,details
  ) values (
    p_recovery_request_id,
    'recovery_access_issued',
    p_actor_id,
    jsonb_build_object(
      'grant_id', v_grant.id,
      'issued_at', v_grant.issued_at,
      'expires_at', v_grant.expires_at,
      'ttl_seconds', p_ttl_seconds,
      'signed_document_id', v_document_id,
      'verifier_id', v_request.verification_started_by,
      'approver_id', v_request.approved_by
    )
  );

  return query
  select v_grant.id,v_grant.recovery_request_id,v_grant.user_id,
         v_grant.status,v_grant.issued_at,v_grant.expires_at;
end;
$$;
