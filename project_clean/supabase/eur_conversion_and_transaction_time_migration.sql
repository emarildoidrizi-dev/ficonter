alter table public.transactions
  add column if not exists occurred_at timestamptz,
  add column if not exists amount_eur numeric(18,6),
  add column if not exists exchange_rate_to_eur numeric(20,10),
  add column if not exists exchange_rate_date date,
  add column if not exists exchange_rate_source text;

update public.transactions
set
  occurred_at = coalesce(occurred_at, transaction_date::timestamp at time zone 'UTC'),
  amount_eur = coalesce(amount_eur, amount),
  exchange_rate_to_eur = coalesce(exchange_rate_to_eur, 1),
  exchange_rate_date = coalesce(exchange_rate_date, transaction_date),
  exchange_rate_source = coalesce(exchange_rate_source, 'legacy EUR assumption')
where occurred_at is null
   or amount_eur is null
   or exchange_rate_to_eur is null
   or exchange_rate_date is null
   or exchange_rate_source is null;

alter table public.transactions
  alter column occurred_at set not null,
  alter column amount_eur set not null,
  alter column exchange_rate_to_eur set not null;

alter table public.transactions
  drop constraint if exists transactions_amount_eur_check;

alter table public.transactions
  add constraint transactions_amount_eur_check
  check (amount_eur > 0 and exchange_rate_to_eur > 0);

create index if not exists transactions_user_occurred_at_idx
on public.transactions (user_id, occurred_at desc);

notify pgrst, 'reload schema';
