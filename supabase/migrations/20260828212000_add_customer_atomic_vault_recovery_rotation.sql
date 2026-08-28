create or replace function public.customer_rotate_financial_vault_recovery(
  p_expected_recovery_version integer,
  p_wrapped_vault_key jsonb,
  p_emergency_envelope jsonb
)
returns table (
  recovery_version integer,
  vault_status text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_vault public.user_financial_vaults%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_recovery_version integer;
  v_alg text;
  v_kid text;
  v_ct text;
begin
  if v_user_id is null then
    raise exception 'Authenticated customer is required.';
  end if;

  select * into v_vault
  from public.user_financial_vaults v
  where v.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Financial Vault could not be found.';
  end if;

  if coalesce(v_vault.recovery_version, 1) <> p_expected_recovery_version then
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
  set status = 'superseded', superseded_at = v_now
  where user_id = v_user_id and status = 'active';

  update public.user_financial_vaults
  set wrapped_vault_key = p_wrapped_vault_key,
      recovery_version = v_next_recovery_version,
      vault_status = 'active',
      last_unlocked_at = v_now,
      updated_at = v_now
  where user_id = v_user_id;

  insert into public.vault_emergency_recovery_envelopes (
    user_id,
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
    v_user_id,
    v_next_recovery_version,
    coalesce(v_vault.key_version, 1),
    1,
    v_alg,
    v_kid,
    v_ct,
    'active',
    'customer_rotation',
    v_now
  );

  return query select v_next_recovery_version, 'active'::text;
end;
$$;

revoke all on function public.customer_rotate_financial_vault_recovery(integer, jsonb, jsonb) from public, anon;
grant execute on function public.customer_rotate_financial_vault_recovery(integer, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
