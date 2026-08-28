-- FICONTER E2EE: ciphertext-only transaction storage.
-- Administrative metadata remains available (id, user_id, created_at,
-- encryption_version, encrypted_payload presence/length).
-- Readable financial contents become nullable and are removed from rows
-- that already carry an encrypted payload.

alter table public.transactions
  alter column description drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_eur drop not null,
  alter column exchange_rate_to_eur drop not null,
  alter column exchange_rate_date drop not null,
  alter column exchange_rate_source drop not null,
  alter column type drop not null,
  alter column category drop not null,
  alter column transaction_date drop not null,
  alter column occurred_at drop not null;

update public.transactions
set
  description = null,
  amount = null,
  currency = null,
  amount_eur = null,
  exchange_rate_to_eur = null,
  exchange_rate_date = null,
  exchange_rate_source = null,
  type = null,
  category = null,
  transaction_date = null,
  occurred_at = null
where encrypted_payload is not null;

comment on column public.transactions.encrypted_payload is
  'Client-side encrypted financial transaction payload. Readable financial contents must not be stored in plaintext for E2EE rows.';

notify pgrst, 'reload schema';