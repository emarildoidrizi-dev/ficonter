-- FICONTER · Complete true lost-code Assisted Recovery after customer-bound recovery material is issued.
-- Preserves the SAME Vault key and existing emergency envelope while replacing the customer recovery credential.

begin;

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
as $$
declare
  v_request public.vault_recovery_requests%rowtype;
  v_grant public.vault_recovery_access_grants%rowtype;
  v_vault public.user_financial_vaults%rowtype;
  v_emergency public.vault_emergency_recovery_envelopes%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_recovery_version integer;
begin
  if p_user_id is null then
    raise exception 'Authenticated customer is required.';
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

  if v_grant.customer_key_algorithm <> 'RSA-OAEP-256'
     or v_grant.customer_ephemeral_public_key is null
     or v_grant.key_bound_at is null
     or v_grant.recovery_material_issued_at is null then
    raise exception 'Customer-bound recovery material has not been issued.';
  end if;

  select * into v_vault
  from public.user_financial_vaults v
  where v.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Financial Vault could not be found.';
  end if;

  if coalesce(v_vault.recovery_version, 1) <> p_expected_recovery_version then
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
  where e.user_id = p_user_id
    and e.status = 'active'
  for update;

  if not found then
    raise exception 'Active emergency recovery envelope was not found.';
  end if;

  v_next_recovery_version := p_expected_recovery_version + 1;

  update public.vault_emergency_recovery_envelopes
  set status = 'superseded', superseded_at = v_now
  where id = v_emergency.id;

  update public.user_financial_vaults
  set wrapped_vault_key = p_wrapped_vault_key,
      recovery_version = v_next_recovery_version,
      vault_status = 'active',
      last_unlocked_at = v_now,
      updated_at = v_now
  where user_id = p_user_id;

  insert into public.vault_emergency_recovery_envelopes (
    user_id,
    recovery_request_id,
    recovery_access_grant_id,
    recovery_version,
    key_version,
    envelope_version,
    algorithm,
    kms_key_id,
    ciphertext,
    status,
    created_via,
    created_at
  ) values (
    p_user_id,
    p_recovery_request_id,
    v_grant.id,
    v_next_recovery_version,
    v_emergency.key_version,
    v_emergency.envelope_version,
    v_emergency.algorithm,
    v_emergency.kms_key_id,
    v_emergency.ciphertext,
    'active',
    'assisted_recovery',
    v_now
  );

  update public.vault_recovery_access_grants
  set status = 'completed', completed_at = v_now, updated_at = v_now
  where id = v_grant.id;

  update public.vault_recovery_requests
  set status = 'completed', updated_at = v_now
  where id = p_recovery_request_id;

  insert into public.vault_recovery_case_audit (
    recovery_request_id, action, actor_id, details
  ) values (
    p_recovery_request_id,
    'assisted_recovery_completed',
    p_user_id,
    jsonb_build_object(
      'grant_id', v_grant.id,
      'previous_recovery_version', p_expected_recovery_version,
      'recovery_version', v_next_recovery_version,
      'kms_key_id', v_emergency.kms_key_id,
      'completed_at', v_now
    )
  );

  return query
  select v_next_recovery_version, 'completed'::text, 'completed'::text, v_now;
end;
$$;

revoke all on function public.customer_complete_vault_assisted_recovery(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.customer_complete_vault_assisted_recovery(uuid, uuid, integer, jsonb) to service_role;

commit;

notify pgrst, 'reload schema';
