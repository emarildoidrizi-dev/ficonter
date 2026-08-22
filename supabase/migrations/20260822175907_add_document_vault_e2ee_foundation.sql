begin;

alter table public.financial_documents
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists file_encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.financial_documents
  alter column original_name drop not null,
  alter column display_name drop not null,
  alter column category drop not null,
  alter column mime_type drop not null;

alter table public.document_upload_intents
  add column if not exists document_id uuid,
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists file_encryption_version smallint;

alter table public.document_upload_intents
  alter column original_name drop not null,
  alter column display_name drop not null,
  alter column category drop not null,
  alter column mime_type drop not null;

create or replace function public.ficonter_enforce_financial_document_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.encryption_version is distinct from 1
     or new.file_encryption_version is distinct from 1
     or new.encrypted_payload is null then
    raise exception 'Financial document must use encrypted metadata and encrypted file v1.' using errcode='23514';
  end if;
  new.original_name := null;
  new.display_name := null;
  new.category := null;
  new.mime_type := null;
  new.document_date := null;
  new.notes := null;
  return new;
end;
$$;

drop trigger if exists financial_documents_enforce_ciphertext_only on public.financial_documents;
create trigger financial_documents_enforce_ciphertext_only
before insert or update on public.financial_documents
for each row execute function public.ficonter_enforce_financial_document_ciphertext_only();

create or replace function public.ficonter_enforce_document_upload_intent_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.document_id is null
     or new.encryption_version is distinct from 1
     or new.file_encryption_version is distinct from 1
     or new.encrypted_payload is null then
    raise exception 'Document upload intent must use encrypted v1 data.' using errcode='23514';
  end if;
  new.original_name := null;
  new.display_name := null;
  new.category := null;
  new.mime_type := null;
  new.document_date := null;
  new.notes := null;
  return new;
end;
$$;

drop trigger if exists document_upload_intents_enforce_ciphertext_only on public.document_upload_intents;
create trigger document_upload_intents_enforce_ciphertext_only
before insert or update on public.document_upload_intents
for each row execute function public.ficonter_enforce_document_upload_intent_ciphertext_only();

create or replace function public.reserve_document_upload_e2ee(
  p_user_id uuid,
  p_document_id uuid,
  p_storage_path text,
  p_size_bytes bigint,
  p_encrypted_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_document_bytes bigint := 0;
  v_pending_bytes bigint := 0;
  v_pending_count integer := 0;
  v_intent_id uuid;
begin
  if p_user_id is null or p_document_id is null or p_encrypted_payload is null then
    raise exception 'invalid_encrypted_document_upload';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception 'invalid_encrypted_document_size';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(size_bytes), 0) into v_document_bytes
  from public.financial_documents where user_id = p_user_id;

  select count(*), coalesce(sum(size_bytes), 0)
    into v_pending_count, v_pending_bytes
  from public.document_upload_intents
  where user_id = p_user_id and expires_at > now();

  if v_pending_count >= 5 then raise exception 'too_many_pending_document_uploads'; end if;
  if v_document_bytes + v_pending_bytes + p_size_bytes > 104857600 then
    raise exception 'document_vault_quota_exceeded';
  end if;

  insert into public.document_upload_intents (
    user_id, document_id, storage_path, size_bytes,
    encrypted_payload, encryption_version, file_encryption_version
  ) values (
    p_user_id, p_document_id, p_storage_path, p_size_bytes,
    p_encrypted_payload, 1, 1
  ) returning id into v_intent_id;

  return v_intent_id;
end;
$$;

revoke all on function public.reserve_document_upload_e2ee(uuid,uuid,text,bigint,jsonb) from public, anon;
grant execute on function public.reserve_document_upload_e2ee(uuid,uuid,text,bigint,jsonb) to service_role;
revoke execute on function public.reserve_document_upload(uuid,text,text,text,text,text,bigint,date,text) from authenticated, anon, public;

commit;
