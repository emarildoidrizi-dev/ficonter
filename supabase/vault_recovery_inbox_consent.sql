-- FICONTER · In-platform Vault recovery consent workflow
-- Idempotent staging/production schema source for customer Inbox delivery,
-- authenticated electronic signature timestamps, and realtime admin updates.

begin;

alter table public.vault_recovery_documents
  add column if not exists sent_to_customer_at timestamptz,
  add column if not exists sent_to_customer_by uuid references auth.users(id) on delete set null,
  add column if not exists customer_signed_at timestamptz,
  add column if not exists customer_signed_by uuid references auth.users(id) on delete set null,
  add column if not exists customer_signature text,
  add column if not exists customer_signature_method text,
  add column if not exists customer_submission_ip_hash text,
  add column if not exists customer_submission_user_agent_hash text;

create index if not exists vault_recovery_documents_sent_idx
  on public.vault_recovery_documents (recovery_request_id, sent_to_customer_at desc)
  where sent_to_customer_at is not null;

create index if not exists vault_recovery_documents_signed_idx
  on public.vault_recovery_documents (recovery_request_id, customer_signed_at desc)
  where customer_signed_at is not null;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vault_recovery_documents'
  ) then
    alter publication supabase_realtime add table public.vault_recovery_documents;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vault_recovery_requests'
  ) then
    alter publication supabase_realtime add table public.vault_recovery_requests;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
