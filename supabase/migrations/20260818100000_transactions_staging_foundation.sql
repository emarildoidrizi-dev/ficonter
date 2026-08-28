-- FICONTER — E2EE transaction foundation
-- Adds encryption-ready fields to the existing transaction table.
-- No existing transaction data is modified.

alter table public.transactions
  add column if not exists encrypted_payload text;

alter table public.transactions
  add column if not exists encryption_version smallint;

comment on column public.transactions.encrypted_payload is
  'Reserved for client-side authenticated encrypted financial payloads.';

comment on column public.transactions.encryption_version is
  'Encryption envelope version used by the FICONTER zero-knowledge vault.';

notify pgrst, 'reload schema';