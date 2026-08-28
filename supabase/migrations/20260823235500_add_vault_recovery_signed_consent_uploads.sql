alter table public.vault_recovery_documents
  add column if not exists signed_storage_path text,
  add column if not exists signed_file_name text,
  add column if not exists signed_mime_type text,
  add column if not exists signed_file_size bigint,
  add column if not exists signed_uploaded_by uuid references auth.users(id),
  add column if not exists signed_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vault-recovery-consents',
  'vault-recovery-consents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
