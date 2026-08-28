begin;

alter table public.bills
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint;

alter table public.bills
  drop constraint if exists bills_encryption_version_check;

alter table public.bills
  add constraint bills_encryption_version_check
  check (
    encryption_version is null
    or encryption_version = 1
  );

alter table public.bills
  drop constraint if exists bills_encrypted_payload_shape_check;

alter table public.bills
  add constraint bills_encrypted_payload_shape_check
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

alter table public.bills
  drop constraint if exists bills_encrypted_pair_check;

alter table public.bills
  add constraint bills_encrypted_pair_check
  check (
    (encrypted_payload is null and encryption_version is null)
    or
    (encrypted_payload is not null and encryption_version = 1)
  );

create index if not exists bills_user_encryption_version_idx
  on public.bills (user_id, encryption_version);

comment on column public.bills.encrypted_payload
is 'Client-side AES-GCM encrypted private Bill payload. Server must not decrypt.';

comment on column public.bills.encryption_version
is 'Client-side Bill encryption contract version. Version 1 uses the FICONTER Financial Vault.';

notify pgrst, 'reload schema';

commit;
