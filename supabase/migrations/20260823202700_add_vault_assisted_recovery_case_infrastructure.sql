create sequence if not exists public.vault_recovery_request_seq;
create sequence if not exists public.vault_recovery_document_seq;

create or replace function public.next_vault_recovery_reference()
returns text
language sql
volatile
set search_path = public
as $$
  select 'RCV-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.vault_recovery_request_seq')::text, 6, '0');
$$;

create or replace function public.next_vault_recovery_document_id()
returns text
language sql
volatile
set search_path = public
as $$
  select 'FVR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.vault_recovery_document_seq')::text, 6, '0');
$$;

create table if not exists public.vault_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.next_vault_recovery_reference(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  status text not null default 'opened' check (status in ('opened','verification_pending','consent_pending','consent_signed','approved','recovery_issued','completed','rejected','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_recovery_documents (
  id uuid primary key default gen_random_uuid(),
  document_id text not null unique default public.next_vault_recovery_document_id(),
  recovery_request_id uuid not null references public.vault_recovery_requests(id) on delete cascade,
  document_type text not null default 'customer_consent',
  internal_template_revision text not null default 'consent-2026-08-23',
  generated_by uuid not null references auth.users(id),
  generated_at timestamptz not null default now(),
  status text not null default 'generated' check (status in ('generated','sent','signed','superseded','cancelled')),
  document_hash text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists vault_recovery_requests_user_idx on public.vault_recovery_requests(user_id, created_at desc);
create index if not exists vault_recovery_documents_request_idx on public.vault_recovery_documents(recovery_request_id, generated_at desc);

alter table public.vault_recovery_requests enable row level security;
alter table public.vault_recovery_documents enable row level security;

revoke all on public.vault_recovery_requests from anon, authenticated;
revoke all on public.vault_recovery_documents from anon, authenticated;
revoke all on sequence public.vault_recovery_request_seq from anon, authenticated;
revoke all on sequence public.vault_recovery_document_seq from anon, authenticated;
revoke all on function public.next_vault_recovery_reference() from public, anon, authenticated;
revoke all on function public.next_vault_recovery_document_id() from public, anon, authenticated;