-- FICONTER · Support Messaging, Notifications and Private Document Vault
-- Idempotent extension of the existing private support center.

begin;

create extension if not exists "pgcrypto";

alter table public.support_requests
  add column if not exists last_message_at timestamptz,
  add column if not exists customer_last_read_at timestamptz,
  add column if not exists admin_last_read_at timestamptz;

update public.support_requests
set last_message_at = coalesce(last_message_at, created_at)
where last_message_at is null;

alter table public.support_requests
  alter column last_message_at set default now(),
  alter column last_message_at set not null;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'admin')),
  body text not null check (char_length(body) between 1 and 5000),
  internal_note boolean not null default false,
  is_initial boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_request_created_idx
  on public.support_messages (request_id, created_at asc);
create unique index if not exists support_messages_one_initial_idx
  on public.support_messages (request_id)
  where is_initial;

insert into public.support_messages (
  request_id,
  sender_user_id,
  sender_role,
  body,
  internal_note,
  is_initial,
  created_at
)
select
  request.id,
  request.user_id,
  'customer',
  request.message,
  false,
  true,
  request.created_at
from public.support_requests request
where not exists (
  select 1
  from public.support_messages message
  where message.request_id = request.id
    and message.is_initial = true
);

create or replace function public.touch_support_request_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.internal_note then
    return new;
  end if;

  update public.support_requests
  set
    last_message_at = new.created_at,
    updated_at = new.created_at,
    status = case
      when new.sender_role = 'customer' and status = 'resolved' then 'open'
      else status
    end,
    resolved_at = case
      when new.sender_role = 'customer' and status = 'resolved' then null
      else resolved_at
    end
  where id = new.request_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch_request on public.support_messages;
create trigger support_messages_touch_request
after insert on public.support_messages
for each row execute function public.touch_support_request_from_message();

alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon;
revoke insert, update, delete on public.support_messages from authenticated;
grant select on public.support_messages to authenticated;

drop policy if exists "Customers read their support messages" on public.support_messages;
create policy "Customers read their support messages"
  on public.support_messages
  for select
  to authenticated
  using (
    internal_note = false
    and exists (
      select 1
      from public.support_requests request
      where request.id = support_messages.request_id
        and request.user_id = auth.uid()
    )
  );

drop policy if exists "Customers send messages to their support threads" on public.support_messages;
create policy "Customers send messages to their support threads"
  on public.support_messages
  for insert
  to authenticated
  with check (
    sender_role = 'customer'
    and sender_user_id = auth.uid()
    and internal_note = false
    and is_initial = false
    and exists (
      select 1
      from public.support_requests request
      where request.id = support_messages.request_id
        and request.user_id = auth.uid()
    )
  );

-- All support creation and replies pass through authenticated same-origin API
-- routes so server-side rate limits cannot be bypassed with a direct client insert.
revoke insert on public.support_requests from authenticated;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in (
      'support_reply',
      'support_status',
      'document_uploaded',
      'document_deleted',
      'system'
    )
  ),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);
create index if not exists user_notifications_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;
revoke all on public.user_notifications from anon;
revoke insert, delete on public.user_notifications from authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;

drop policy if exists "Users read their own notifications" on public.user_notifications;
create policy "Users read their own notifications"
  on public.user_notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users mark their own notifications read" on public.user_notifications;
create policy "Users mark their own notifications read"
  on public.user_notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  display_name text not null check (char_length(display_name) between 1 and 160),
  category text not null check (
    category in (
      'bank_statement',
      'payslip',
      'tax_document',
      'invoice_receipt',
      'insurance',
      'contract',
      'loan_document',
      'pension_record',
      'other'
    )
  ),
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    )
  ),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  document_date date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_upload_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  display_name text not null check (char_length(display_name) between 1 and 160),
  category text not null check (
    category in (
      'bank_statement', 'payslip', 'tax_document', 'invoice_receipt',
      'insurance', 'contract', 'loan_document', 'pension_record', 'other'
    )
  ),
  mime_type text not null check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  document_date date,
  notes text check (notes is null or char_length(notes) <= 1000),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now()
);

create index if not exists document_upload_intents_user_created_idx
  on public.document_upload_intents (user_id, created_at desc);
alter table public.document_upload_intents enable row level security;
revoke all on public.document_upload_intents from anon, authenticated;

-- Atomically reserves a private upload slot. The advisory lock prevents
-- simultaneous requests from bypassing the per-user quota or pending limit.
create or replace function public.reserve_document_upload(
  p_user_id uuid,
  p_storage_path text,
  p_original_name text,
  p_display_name text,
  p_category text,
  p_mime_type text,
  p_size_bytes bigint,
  p_document_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_bytes bigint := 0;
  v_pending_bytes bigint := 0;
  v_pending_count integer := 0;
  v_intent_id uuid;
begin
  if p_user_id is null then
    raise exception 'invalid_document_owner';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(size_bytes), 0)
    into v_document_bytes
  from public.financial_documents
  where user_id = p_user_id;

  select count(*), coalesce(sum(size_bytes), 0)
    into v_pending_count, v_pending_bytes
  from public.document_upload_intents
  where user_id = p_user_id
    and expires_at > now();

  if v_pending_count >= 5 then
    raise exception 'too_many_pending_document_uploads';
  end if;

  if v_document_bytes + v_pending_bytes + p_size_bytes > 104857600 then
    raise exception 'document_vault_quota_exceeded';
  end if;

  insert into public.document_upload_intents (
    user_id,
    storage_path,
    original_name,
    display_name,
    category,
    mime_type,
    size_bytes,
    document_date,
    notes
  ) values (
    p_user_id,
    p_storage_path,
    p_original_name,
    p_display_name,
    p_category,
    p_mime_type,
    p_size_bytes,
    p_document_date,
    p_notes
  )
  returning id into v_intent_id;

  return v_intent_id;
end;
$$;

revoke all on function public.reserve_document_upload(
  uuid, text, text, text, text, text, bigint, date, text
) from public, anon, authenticated;
grant execute on function public.reserve_document_upload(
  uuid, text, text, text, text, text, bigint, date, text
) to service_role;

create index if not exists financial_documents_user_created_idx
  on public.financial_documents (user_id, created_at desc);
create index if not exists financial_documents_user_category_idx
  on public.financial_documents (user_id, category, document_date desc);

create or replace function public.set_financial_document_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists financial_documents_set_updated_at on public.financial_documents;
create trigger financial_documents_set_updated_at
before update on public.financial_documents
for each row execute function public.set_financial_document_updated_at();

alter table public.financial_documents enable row level security;
revoke all on public.financial_documents from anon;
revoke insert, update, delete on public.financial_documents from authenticated;
grant select on public.financial_documents to authenticated;

drop policy if exists "Users read their own financial documents" on public.financial_documents;
create policy "Users read their own financial documents"
  on public.financial_documents
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users register their own financial documents" on public.financial_documents;
create policy "Users register their own financial documents"
  on public.financial_documents
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their own financial documents" on public.financial_documents;
create policy "Users update their own financial documents"
  on public.financial_documents
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own financial documents" on public.financial_documents;
create policy "Users delete their own financial documents"
  on public.financial_documents
  for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'financial-documents',
  'financial-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.has_active_document_upload_intent(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.document_upload_intents intent
    where intent.user_id = auth.uid()
      and intent.storage_path = p_storage_path
      and intent.expires_at > now()
  );
$$;

revoke all on function public.has_active_document_upload_intent(text) from public, anon;
grant execute on function public.has_active_document_upload_intent(text) to authenticated;

drop policy if exists "Users upload their own financial document files" on storage.objects;
create policy "Users upload their own financial document files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'financial-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_active_document_upload_intent(name)
  );

-- Reads, metadata updates, and deletion happen only through authenticated
-- server routes that issue short-lived signed URLs or perform owner-scoped
-- service-role mutations. Remove earlier broad direct-client policies.
drop policy if exists "Users read their own financial document files" on storage.objects;
drop policy if exists "Users update their own financial document files" on storage.objects;
drop policy if exists "Users delete their own financial document files" on storage.objects;

-- The existing support request policy already limits customers to their own rows.
grant update (customer_last_read_at) on public.support_requests to authenticated;

drop policy if exists "Users mark their support threads read" on public.support_requests;
create policy "Users mark their support threads read"
  on public.support_requests
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime registration, idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_requests'
  ) then
    alter publication supabase_realtime add table public.support_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'financial_documents'
  ) then
    alter publication supabase_realtime add table public.financial_documents;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
