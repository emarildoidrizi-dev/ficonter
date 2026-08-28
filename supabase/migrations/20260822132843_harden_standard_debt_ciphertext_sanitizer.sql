begin;

create or replace function public.ficonter_enforce_standard_debt_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
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
    new.card_last_four := null;
    new.credit_limit := null;
    new.credit_limit_eur := null;
    new.statement_balance := null;
    new.statement_balance_eur := null;
    new.interest_charged := null;
    new.interest_charged_eur := null;
  end if;

  return new;
end;
$$;

update public.debts
set
  card_last_four = null,
  credit_limit = null,
  credit_limit_eur = null,
  statement_balance = null,
  statement_balance_eur = null,
  interest_charged = null,
  interest_charged_eur = null
where debt_kind='standard'
  and encryption_version=1
  and encrypted_payload is not null;

commit;
