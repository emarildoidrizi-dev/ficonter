begin;

alter table public.credit_card_activities
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.credit_card_monthly_records
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.credit_card_activities
  drop constraint if exists credit_card_activities_encryption_version_check;
alter table public.credit_card_activities
  add constraint credit_card_activities_encryption_version_check
  check (encryption_version is null or encryption_version = 1);

alter table public.credit_card_monthly_records
  drop constraint if exists credit_card_monthly_records_encryption_version_check;
alter table public.credit_card_monthly_records
  add constraint credit_card_monthly_records_encryption_version_check
  check (encryption_version is null or encryption_version = 1);

create index if not exists credit_card_activities_e2ee_lookup_idx
  on public.credit_card_activities (user_id, debt_id, encryption_version, created_at desc);

create index if not exists credit_card_monthly_records_e2ee_lookup_idx
  on public.credit_card_monthly_records (user_id, debt_id, month_start desc, encryption_version);

commit;
