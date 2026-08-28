begin;

alter table public.ai_insight_snapshots
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version integer,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.ai_insight_snapshots
  alter column data_fingerprint drop not null,
  alter column report drop not null,
  alter column data_coverage drop not null,
  alter column data_coverage drop default;

commit;
