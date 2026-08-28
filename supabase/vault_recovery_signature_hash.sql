-- FICONTER Vault recovery signed-consent hash sealing
create extension if not exists pgcrypto;

create or replace function public.seal_vault_recovery_document_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_signed boolean;
begin
  v_signed := coalesce(new.customer_signed_at, new.signed_at, new.signed_uploaded_at) is not null;

  if v_signed and coalesce(old.customer_signed_at, old.signed_at, old.signed_uploaded_at) is null then
    new.document_hash := encode(
      digest(
        concat_ws('|',
          'FICONTER_VAULT_RECOVERY_CONSENT_V1',
          new.document_id,
          new.recovery_request_id::text,
          coalesce(new.sent_to_customer_at::text,''),
          coalesce(new.customer_signed_at::text,''),
          coalesce(new.customer_signed_by::text,''),
          coalesce(new.customer_signature_method,''),
          coalesce(new.customer_signature,''),
          coalesce(new.signed_at::text,''),
          coalesce(new.signed_uploaded_at::text,''),
          coalesce(new.signed_uploaded_by::text,''),
          coalesce(new.signed_file_name,''),
          coalesce(new.signed_mime_type,''),
          coalesce(new.signed_file_size::text,'')
        ),
        'sha256'
      ),
      'hex'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_vault_recovery_document_hash on public.vault_recovery_documents;
create trigger trg_vault_recovery_document_hash
before update on public.vault_recovery_documents
for each row execute function public.seal_vault_recovery_document_hash();
