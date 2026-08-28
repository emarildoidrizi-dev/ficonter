begin;

alter table public.debts
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint;

alter table public.debts
  drop constraint if exists debts_encryption_version_check;

alter table public.debts
  add constraint debts_encryption_version_check
  check (
    encryption_version is null
    or encryption_version = 1
  );

alter table public.debts
  drop constraint if exists debts_encrypted_payload_shape_check;

alter table public.debts
  add constraint debts_encrypted_payload_shape_check
  check (
    encrypted_payload is null
    or (
      jsonb_typeof(encrypted_payload) = 'object'
      and encrypted_payload ->> 'alg' = 'A256GCM'
      and encrypted_payload ->> 'v' = '1'
      and nullif(encrypted_payload ->> 'iv', '') is not null
      and nullif(encrypted_payload ->> 'ct', '') is not null
    )
  );

alter table public.debts
  drop constraint if exists debts_encrypted_pair_check;

alter table public.debts
  add constraint debts_encrypted_pair_check
  check (
    (encrypted_payload is null and encryption_version is null)
    or
    (encrypted_payload is not null and encryption_version = 1)
  );

create index if not exists debts_user_encryption_version_idx
  on public.debts (user_id, encryption_version);

comment on column public.debts.encrypted_payload
is 'Client-side AES-GCM encrypted private Debt payload. Server must not decrypt.';

comment on column public.debts.encryption_version
is 'Client-side Debt encryption contract version. Version 1 uses the FICONTER Financial Vault.';

alter table public.debt_payments
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint;

alter table public.debt_payments
  drop constraint if exists debt_payments_encryption_version_check;

alter table public.debt_payments
  add constraint debt_payments_encryption_version_check
  check (
    encryption_version is null
    or encryption_version = 1
  );

alter table public.debt_payments
  drop constraint if exists debt_payments_encrypted_payload_shape_check;

alter table public.debt_payments
  add constraint debt_payments_encrypted_payload_shape_check
  check (
    encrypted_payload is null
    or (
      jsonb_typeof(encrypted_payload) = 'object'
      and encrypted_payload ->> 'alg' = 'A256GCM'
      and encrypted_payload ->> 'v' = '1'
      and nullif(encrypted_payload ->> 'iv', '') is not null
      and nullif(encrypted_payload ->> 'ct', '') is not null
    )
  );

alter table public.debt_payments
  drop constraint if exists debt_payments_encrypted_pair_check;

alter table public.debt_payments
  add constraint debt_payments_encrypted_pair_check
  check (
    (encrypted_payload is null and encryption_version is null)
    or
    (encrypted_payload is not null and encryption_version = 1)
  );

create index if not exists debt_payments_user_encryption_version_idx
  on public.debt_payments (user_id, encryption_version);

comment on column public.debt_payments.encrypted_payload
is 'Client-side AES-GCM encrypted private Debt payment payload. Server must not decrypt.';

comment on column public.debt_payments.encryption_version
is 'Client-side Debt payment encryption contract version. Version 1 uses the FICONTER Financial Vault.';

notify pgrst, 'reload schema';

commit;
