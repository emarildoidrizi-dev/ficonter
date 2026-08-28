-- FICONTER · Atomic Financial Vault creation with Assisted Recovery protection.
-- Both stored key representations are ciphertext-only and wrap the SAME client-generated Vault key.

begin;

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
as $$
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
$$;

revoke all on function public.customer_create_financial_vault_with_recovery(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.customer_create_financial_vault_with_recovery(uuid, jsonb, jsonb) to service_role;

commit;

notify pgrst, 'reload schema';
