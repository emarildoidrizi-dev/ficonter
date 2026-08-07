-- FICONTER Subscription System — Phase 1 foundation
-- Safe scope: plan/status persistence only. No Stripe/live payment logic is enabled here.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_code text not null default 'beta'
    check (plan_code in ('beta', 'free', 'personal_pro', 'business_pro')),
  status text not null default 'active'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  billing_interval text null
    check (billing_interval is null or billing_interval in ('monthly', 'annual')),
  provider text not null default 'internal'
    check (provider in ('internal', 'stripe')),
  stripe_customer_id text null,
  stripe_subscription_id text null,
  stripe_price_id text null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_stripe_customer_id_key
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists subscriptions_stripe_subscription_id_key
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.subscriptions enable row level security;

revoke all on table public.subscriptions from anon;
revoke insert, update, delete on table public.subscriptions from authenticated;
grant select on table public.subscriptions to authenticated;
grant all on table public.subscriptions to service_role;

drop policy if exists "Users can view their own subscription" on public.subscriptions;
create policy "Users can view their own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_subscription_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_subscription_updated_at();

-- Private Beta policy: all existing users receive full Beta Access for €0.
insert into public.subscriptions (user_id, plan_code, status, provider)
select id, 'beta', 'active', 'internal'
from auth.users
on conflict (user_id) do nothing;

-- Private Beta policy for new sign-ups. Before public launch, change the
-- inserted plan_code below from 'beta' to 'free'.
create or replace function public.create_default_ficonter_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan_code, status, provider)
  values (new.id, 'beta', 'active', 'internal')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ficonter_subscription on auth.users;
create trigger on_auth_user_created_ficonter_subscription
after insert on auth.users
for each row
execute function public.create_default_ficonter_subscription();

comment on table public.subscriptions is
  'FICONTER subscription entitlement source of truth. Client users may only read their own row; billing mutations are reserved for trusted server-side code/webhooks.';
