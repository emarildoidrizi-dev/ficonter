-- FICONTER Subscription Phase 2
-- Replace the unused Stripe billing fields with PayPal Sandbox support.
-- Historical Phase 1 migrations remain untouched.

do $$
begin
  if exists (
    select 1
    from public.subscriptions
    where provider = 'stripe'
       or stripe_customer_id is not null
       or stripe_subscription_id is not null
       or stripe_price_id is not null
  ) then
    raise exception
      'Stripe subscription data exists. Migration stopped to prevent accidental data loss.';
  end if;
end
$$;

-- Remove old Stripe-specific indexes.
drop index if exists public.subscriptions_stripe_customer_id_key;
drop index if exists public.subscriptions_stripe_subscription_id_key;

-- Replace the billing-provider constraint.
alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;

alter table public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('internal', 'paypal'));

-- Remove unused Stripe fields.
alter table public.subscriptions
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id,
  drop column if exists stripe_price_id;

-- Add PayPal subscription identifiers.
alter table public.subscriptions
  add column if not exists paypal_payer_id text,
  add column if not exists paypal_subscription_id text,
  add column if not exists paypal_plan_id text;

-- A PayPal subscription must belong to only one FICONTER subscription row.
create unique index if not exists subscriptions_paypal_subscription_id_key
  on public.subscriptions (paypal_subscription_id)
  where paypal_subscription_id is not null;

comment on table public.subscriptions is
'FICONTER subscription entitlement source of truth. Billing provider is internal or PayPal. Client users may only read their own row; billing mutations are reserved for trusted server-side code and PayPal webhooks.';
