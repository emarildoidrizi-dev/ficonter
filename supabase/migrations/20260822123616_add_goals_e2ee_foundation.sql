alter table public.goals
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.goal_investments
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

comment on column public.goals.encrypted_payload is 'FICONTER Financial Vault ciphertext envelope for private Goal fields.';
comment on column public.goals.encryption_version is 'Financial Vault payload version.';
comment on column public.goals.e2ee_revision is 'Optimistic concurrency revision for encrypted Goal mutations.';
comment on column public.goal_investments.encrypted_payload is 'FICONTER Financial Vault ciphertext envelope for private Goal investment fields.';
comment on column public.goal_investments.encryption_version is 'Financial Vault payload version.';
comment on column public.goal_investments.e2ee_revision is 'Optimistic concurrency revision for encrypted Goal investment mutations.';
