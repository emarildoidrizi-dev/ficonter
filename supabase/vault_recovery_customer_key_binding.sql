-- FICONTER · Bind a customer browser ephemeral public key to a claimed Recovery Access grant.
-- The matching private key never leaves the customer browser.

begin;

alter table public.vault_recovery_access_grants
  add column if not exists recovery_material_issued_at timestamptz;

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
as $$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null then
    raise exception 'Authenticated customer is required.';
  end if;

  if p_algorithm <> 'RSA-OAEP-256' then
    raise exception 'Unsupported customer recovery key algorithm.';
  end if;

  if p_public_key is null or length(p_public_key) < 100 or length(p_public_key) > 12000 then
    raise exception 'Invalid customer recovery public key.';
  end if;

  select * into v_request
  from public.vault_recovery_requests r
  where r.id = p_recovery_request_id
    and r.user_id = p_user_id
  for update;

  if not found or v_request.archived_at is not null then
    raise exception 'Recovery request is not active.';
  end if;

  select * into v_grant
  from public.vault_recovery_access_grants g
  where g.recovery_request_id = p_recovery_request_id
    and g.user_id = p_user_id
    and g.status = 'claimed'
  order by g.issued_at desc
  limit 1
  for update;

  if not found then
    raise exception 'A claimed Recovery Access grant is required.';
  end if;

  if v_grant.expires_at <= v_now then
    update public.vault_recovery_access_grants
    set status = 'expired', updated_at = v_now
    where id = v_grant.id;
    raise exception 'Recovery Access has expired.';
  end if;

  if v_grant.customer_ephemeral_public_key is not null then
    if v_grant.customer_key_algorithm = p_algorithm
       and v_grant.customer_ephemeral_public_key = p_public_key then
      return query
      select v_grant.id, v_grant.status, v_grant.customer_key_algorithm,
             v_grant.customer_ephemeral_public_key, v_grant.key_bound_at, v_grant.expires_at;
      return;
    end if;
    raise exception 'A customer recovery key is already bound to this Recovery Access.';
  end if;

  update public.vault_recovery_access_grants g
  set customer_key_algorithm = p_algorithm,
      customer_ephemeral_public_key = p_public_key,
      key_bound_at = v_now,
      updated_at = v_now
  where g.id = v_grant.id
  returning * into v_grant;

  insert into public.vault_recovery_case_audit (
    recovery_request_id, action, actor_id, details
  ) values (
    p_recovery_request_id,
    'customer_recovery_key_bound',
    p_user_id,
    jsonb_build_object(
      'grant_id', v_grant.id,
      'algorithm', p_algorithm,
      'key_bound_at', v_grant.key_bound_at
    )
  );

  return query
  select v_grant.id, v_grant.status, v_grant.customer_key_algorithm,
         v_grant.customer_ephemeral_public_key, v_grant.key_bound_at, v_grant.expires_at;
end;
$$;

revoke all on function public.customer_bind_vault_recovery_key(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.customer_bind_vault_recovery_key(uuid, uuid, text, text) to service_role;

commit;

notify pgrst, 'reload schema';
