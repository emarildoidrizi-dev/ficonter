-- FICONTER · Private Help and Contact Support Center
-- Stores authenticated customer concerns in a private, RLS-protected inbox.
-- No external email provider is required. Administrators access requests only
-- through protected server routes that use the server-only service role.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_email text not null
    check (char_length(contact_email) between 3 and 254),
  category text not null
    check (
      category in (
        'technical_issue',
        'account_access',
        'privacy_data',
        'feature_request',
        'billing_subscription',
        'other'
      )
    ),
  subject text not null
    check (char_length(subject) between 3 and 120),
  message text not null
    check (char_length(message) between 20 and 5000),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved')),
  handled_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_user_created_idx
  on public.support_requests (user_id, created_at desc);

create index if not exists support_requests_status_created_idx
  on public.support_requests (status, created_at desc);

create or replace function public.set_support_request_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
  elsif new.status is distinct from 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists support_requests_set_updated_at
  on public.support_requests;
create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function public.set_support_request_updated_at();

alter table public.support_requests enable row level security;

grant select, insert on public.support_requests to authenticated;
revoke update, delete on public.support_requests from authenticated;

drop policy if exists "Users can create their own support requests"
  on public.support_requests;
create policy "Users can create their own support requests"
  on public.support_requests
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'open'
    and handled_by is null
    and resolved_at is null
  );

drop policy if exists "Users can read their own support requests"
  on public.support_requests;
create policy "Users can read their own support requests"
  on public.support_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.support_requests is
  'Private authenticated customer concerns submitted through the FICONTER Contact Us window.';
comment on column public.support_requests.contact_email is
  'Customer-selected reply address. Never used as an authentication authority.';
comment on column public.support_requests.handled_by is
  'Administrator who last changed the support status through a protected server route.';

commit;

notify pgrst, 'reload schema';
