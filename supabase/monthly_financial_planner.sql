create extension if not exists "pgcrypto";
create table if not exists public.monthly_budget_plans(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 month text not null check(month ~ '^\\d{4}-\\d{2}$'), start_balance numeric(14,2) not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,month));
create table if not exists public.monthly_budget_items(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 month text not null check(month ~ '^\\d{4}-\\d{2}$'), section text not null check(section in('income','bills','expenses','savings','debt')),
 label text not null check(char_length(label) between 1 and 120), planned_amount numeric(14,2) not null check(planned_amount>=0),
 position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.monthly_budget_plans enable row level security; alter table public.monthly_budget_items enable row level security;
drop policy if exists "Users manage own monthly plans" on public.monthly_budget_plans;
create policy "Users manage own monthly plans" on public.monthly_budget_plans for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "Users manage own monthly budget items" on public.monthly_budget_items;
create policy "Users manage own monthly budget items" on public.monthly_budget_items for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create index if not exists monthly_budget_items_user_month_idx on public.monthly_budget_items(user_id,month);
do $$ begin alter publication supabase_realtime add table public.monthly_budget_plans; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.monthly_budget_items; exception when duplicate_object then null; end $$;
alter table public.monthly_budget_plans replica identity full; alter table public.monthly_budget_items replica identity full;
notify pgrst,'reload schema';