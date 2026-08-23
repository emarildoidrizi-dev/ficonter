alter table public.vault_recovery_requests
  add column if not exists customer_name text,
  add column if not exists country_region text,
  add column if not exists internal_notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists updated_by uuid;

create table if not exists public.vault_recovery_case_audit (
  id uuid primary key default gen_random_uuid(),
  recovery_request_id uuid not null references public.vault_recovery_requests(id) on delete cascade,
  action text not null check (action in ('created','updated','archived','restored')),
  actor_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vault_recovery_case_audit_request_idx
  on public.vault_recovery_case_audit(recovery_request_id, created_at desc);

alter table public.vault_recovery_case_audit enable row level security;
revoke all on table public.vault_recovery_case_audit from anon, authenticated;
