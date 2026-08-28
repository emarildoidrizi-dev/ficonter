-- FICONTER · Customer-side Vault Assisted Recovery access flow
-- Adds authenticated-account-bound claim handling and in-platform notification.
-- This control plane does not expose or store a readable Financial Vault key.

begin;

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
as $$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null then
    raise exception 'Authenticated customer is required.';
  end if;

  select * into v_request
  from public.vault_recovery_requests r
  where r.id = p_recovery_request_id
    and r.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Recovery request not found.';
  end if;

  if v_request.archived_at is not null then
    raise exception 'This recovery request is no longer active.';
  end if;

  if v_request.status <> 'recovery_issued' then
    raise exception 'Recovery Access is not currently available for this request.';
  end if;

  select * into v_grant
  from public.vault_recovery_access_grants g
  where g.recovery_request_id = p_recovery_request_id
    and g.user_id = p_user_id
    and g.status in ('issued','claimed')
  order by g.issued_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active Recovery Access grant was found.';
  end if;

  if v_grant.expires_at <= v_now then
    update public.vault_recovery_access_grants g
    set status = 'expired', updated_at = v_now
    where g.id = v_grant.id
    returning * into v_grant;

    insert into public.vault_recovery_case_audit (
      recovery_request_id, action, actor_id, details
    ) values (
      p_recovery_request_id,
      'recovery_access_expired',
      p_user_id,
      jsonb_build_object('grant_id', v_grant.id, 'expired_at', v_now)
    );

    return query
    select v_grant.id, v_grant.recovery_request_id, v_grant.user_id,
           v_grant.status, v_grant.issued_at, v_grant.expires_at, v_grant.claimed_at;
    return;
  end if;

  if v_grant.status = 'issued' then
    update public.vault_recovery_access_grants g
    set status = 'claimed', claimed_at = v_now, updated_at = v_now
    where g.id = v_grant.id
    returning * into v_grant;

    insert into public.vault_recovery_case_audit (
      recovery_request_id, action, actor_id, details
    ) values (
      p_recovery_request_id,
      'recovery_access_claimed',
      p_user_id,
      jsonb_build_object('grant_id', v_grant.id, 'claimed_at', v_grant.claimed_at)
    );
  end if;

  return query
  select v_grant.id, v_grant.recovery_request_id, v_grant.user_id,
         v_grant.status, v_grant.issued_at, v_grant.expires_at, v_grant.claimed_at;
end;
$$;

revoke all on function public.customer_claim_vault_recovery_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.customer_claim_vault_recovery_access(uuid, uuid) to service_role;

create or replace function public.notify_vault_recovery_access_issued()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_reference text;
begin
  select r.reference into v_reference
  from public.vault_recovery_requests r
  where r.id = new.recovery_request_id;

  insert into public.user_notifications (
    user_id, kind, title, body, href, metadata
  ) values (
    new.user_id,
    'system',
    'Vault Recovery Access approved',
    'Your temporary FICONTER Recovery Access is ready. Open it before it expires to continue secure Vault recovery.',
    '/dashboard/inbox/vault-recovery/' || new.recovery_request_id::text || '/recover',
    jsonb_build_object(
      'recovery_request_id', new.recovery_request_id,
      'recovery_reference', v_reference,
      'recovery_access_id', new.id,
      'expires_at', new.expires_at
    )
  );

  return new;
end;
$$;

drop trigger if exists vault_recovery_access_notify_customer on public.vault_recovery_access_grants;
create trigger vault_recovery_access_notify_customer
after insert on public.vault_recovery_access_grants
for each row execute function public.notify_vault_recovery_access_issued();

revoke all on function public.notify_vault_recovery_access_issued() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
