alter table public.monthly_budget_plans
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.monthly_budget_items
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

comment on column public.monthly_budget_plans.encrypted_payload is 'FICONTER Financial Vault ciphertext envelope for private Monthly Planner plan fields.';
comment on column public.monthly_budget_plans.encryption_version is 'Financial Vault payload version.';
comment on column public.monthly_budget_plans.e2ee_revision is 'Optimistic concurrency revision for encrypted Monthly Planner mutations.';
comment on column public.monthly_budget_items.encrypted_payload is 'FICONTER Financial Vault ciphertext envelope for private Monthly Planner item fields.';
comment on column public.monthly_budget_items.encryption_version is 'Financial Vault payload version.';
comment on column public.monthly_budget_items.e2ee_revision is 'Optimistic concurrency revision for encrypted Monthly Planner item mutations.';
