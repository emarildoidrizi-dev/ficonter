begin;

alter table public.debts
  add column if not exists debt_kind text;

update public.debts
set debt_kind = case
  when lower(coalesce(category, '')) = 'credit card' then 'credit_card'
  else 'standard'
end
where debt_kind is null;

alter table public.debts
  alter column debt_kind set default 'standard',
  alter column debt_kind set not null,
  alter column name drop not null,
  alter column category drop not null,
  alter column original_balance drop not null,
  alter column current_balance drop not null,
  alter column currency drop not null,
  alter column original_balance_eur drop not null,
  alter column current_balance_eur drop not null,
  alter column exchange_rate_to_eur drop not null,
  alter column annual_interest_rate drop not null,
  alter column minimum_payment drop not null,
  alter column minimum_payment_eur drop not null;

alter table public.debts
  drop constraint if exists debts_debt_kind_check;

alter table public.debts
  add constraint debts_debt_kind_check
  check (debt_kind in ('standard', 'credit_card'));

create or replace function public.ficonter_enforce_standard_debt_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.debt_kind = 'standard' then
    if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
      raise exception 'Standard Debt must be stored as encrypted v1 ciphertext.' using errcode = '23514';
    end if;

    new.name := null;
    new.lender := null;
    new.description := null;
    new.category := null;
    new.original_balance := null;
    new.current_balance := null;
    new.currency := null;
    new.original_balance_eur := null;
    new.current_balance_eur := null;
    new.exchange_rate_to_eur := null;
    new.annual_interest_rate := null;
    new.minimum_payment := null;
    new.minimum_payment_eur := null;
  end if;

  return new;
end;
$$;

revoke all on function public.ficonter_enforce_standard_debt_ciphertext_only() from public, anon, authenticated;

drop trigger if exists debts_enforce_standard_ciphertext_only on public.debts;
create trigger debts_enforce_standard_ciphertext_only
before insert or update on public.debts
for each row execute function public.ficonter_enforce_standard_debt_ciphertext_only();

create or replace function public.ficonter_enforce_standard_debt_payment_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
begin
  select d.debt_kind into v_kind
  from public.debts d
  where d.id = new.debt_id and d.user_id = new.user_id;

  if v_kind = 'standard' then
    if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
      raise exception 'Standard Debt payment must be stored as encrypted v1 ciphertext.' using errcode = '23514';
    end if;

    new.amount := null;
    new.currency := null;
    new.amount_eur := null;
    new.exchange_rate_to_eur := null;
    new.notes := null;
  end if;

  return new;
end;
$$;

revoke all on function public.ficonter_enforce_standard_debt_payment_ciphertext_only() from public, anon, authenticated;

drop trigger if exists debt_payments_enforce_standard_ciphertext_only on public.debt_payments;
create trigger debt_payments_enforce_standard_ciphertext_only
before insert or update on public.debt_payments
for each row execute function public.ficonter_enforce_standard_debt_payment_ciphertext_only();

update public.debts
set
  name = null,
  lender = null,
  description = null,
  category = null,
  original_balance = null,
  current_balance = null,
  currency = null,
  original_balance_eur = null,
  current_balance_eur = null,
  exchange_rate_to_eur = null,
  annual_interest_rate = null,
  minimum_payment = null,
  minimum_payment_eur = null
where debt_kind = 'standard'
  and encryption_version = 1
  and encrypted_payload is not null;

update public.debt_payments p
set
  amount = null,
  currency = null,
  amount_eur = null,
  exchange_rate_to_eur = null,
  notes = null
where p.encryption_version = 1
  and p.encrypted_payload is not null
  and exists (
    select 1 from public.debts d
    where d.id = p.debt_id
      and d.user_id = p.user_id
      and d.debt_kind = 'standard'
  );

commit;
