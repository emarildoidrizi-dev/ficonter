alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text;

alter table public.vault_recovery_requests
  add column if not exists customer_birth_date date,
  add column if not exists customer_city text,
  add column if not exists customer_address_line1 text,
  add column if not exists customer_address_line2 text,
  add column if not exists customer_postal_code text;

comment on column public.vault_recovery_requests.customer_birth_date is 'Snapshot of customer birth date at recovery case creation.';
comment on column public.vault_recovery_requests.customer_city is 'Snapshot of customer city at recovery case creation.';
comment on column public.vault_recovery_requests.customer_address_line1 is 'Snapshot of customer residential address line 1 at recovery case creation.';
comment on column public.vault_recovery_requests.customer_address_line2 is 'Snapshot of customer residential address line 2 at recovery case creation.';
comment on column public.vault_recovery_requests.customer_postal_code is 'Snapshot of customer postal code at recovery case creation.';
