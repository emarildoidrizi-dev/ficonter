-- Backfill SHA-256 evidence hashes for legacy signed Vault recovery documents.
-- Signed records remain immutable except for a one-time NULL -> hash seal.

create or replace function public.protect_signed_vault_recovery_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(old.customer_signed_at, old.signed_at, old.signed_uploaded_at) is not null then
      raise exception 'Signed Vault recovery consent evidence cannot be deleted.';
    end if;
    return old;
  end if;

  if coalesce(old.customer_signed_at, old.signed_at, old.signed_uploaded_at) is not null then
    if old.document_hash is null
       and new.document_hash is not null
       and (to_jsonb(new) - 'document_hash') = (to_jsonb(old) - 'document_hash') then
      return new;
    end if;
    if new is distinct from old then
      raise exception 'Signed Vault recovery consent evidence is immutable.';
    end if;
  end if;
  return new;
end;
$$;

update public.vault_recovery_documents d
set document_hash = encode(
  digest(
    concat_ws('|',
      'FICONTER_VAULT_RECOVERY_CONSENT_V1',
      d.document_id,
      d.recovery_request_id::text,
      coalesce(d.sent_to_customer_at::text,''),
      coalesce(d.customer_signed_at::text,''),
      coalesce(d.customer_signed_by::text,''),
      coalesce(d.customer_signature_method,''),
      coalesce(d.customer_signature,''),
      coalesce(d.signed_at::text,''),
      coalesce(d.signed_uploaded_at::text,''),
      coalesce(d.signed_uploaded_by::text,''),
      coalesce(d.signed_file_name,''),
      coalesce(d.signed_mime_type,''),
      coalesce(d.signed_file_size::text,'')
    ),
    'sha256'
  ),
  'hex'
)
where coalesce(d.customer_signed_at,d.signed_at,d.signed_uploaded_at) is not null
  and d.document_hash is null;
