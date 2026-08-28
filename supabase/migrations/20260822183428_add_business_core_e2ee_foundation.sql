begin;

alter table public.business_transactions
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_transactions
  alter column description drop not null,
  alter column type drop not null,
  alter column category drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_base drop not null,
  alter column exchange_rate_to_base drop not null,
  alter column transaction_date drop not null,
  alter column occurred_at drop not null;

alter table public.business_cost_categories
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_cost_categories
  alter column name drop not null,
  alter column default_nature drop not null;

alter table public.business_cost_centres
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_cost_centres
  alter column name drop not null;

alter table public.business_suppliers
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_suppliers
  alter column name drop not null,
  alter column category drop not null,
  alter column payment_terms_days drop not null,
  alter column default_currency drop not null;

commit;
