create extension if not exists "pgcrypto";

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  company text,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  amount_eur numeric(14,2) not null check (amount_eur >= 0),
  exchange_rate_to_eur numeric(18,8) not null default 1 check (exchange_rate_to_eur > 0),
  due_date date not null,
  recurrence text not null default 'none'
    check (recurrence in ('none','weekly','biweekly','monthly','quarterly','semiannual','yearly')),
  payment_method text,
  autopay boolean not null default false,
  reminder_days integer not null default 3 check (reminder_days between 0 and 365),
  status text not null default 'pending'
    check (status in ('pending','paid','cancelled')),
  notes text,
  paid_at timestamptz,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bills enable row level security;

drop policy if exists "Users can view own bills" on public.bills;
create policy "Users can view own bills"
on public.bills for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own bills" on public.bills;
create policy "Users can create own bills"
on public.bills for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own bills" on public.bills;
create policy "Users can update own bills"
on public.bills for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bills" on public.bills;
create policy "Users can delete own bills"
on public.bills for delete
using (auth.uid() = user_id);

create index if not exists bills_user_due_date_idx
on public.bills (user_id, due_date);

create index if not exists bills_user_status_idx
on public.bills (user_id, status);

do $$
begin
  alter publication supabase_realtime add table public.bills;
exception
  when duplicate_object then null;
end $$;

alter table public.bills replica identity full;
notify pgrst, 'reload schema';
