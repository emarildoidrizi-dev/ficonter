-- FICONTER · Credit-card minimum payment cent ceiling
--
-- Automatic credit-card minimums remain 3% of the applicable balance.
-- If the result contains any fraction of a cent, FICONTER rounds upward to
-- the next cent. Exact-cent results remain unchanged.
-- Example: 2955.82 * 3% = 88.6746 -> 88.68.

begin;

create or replace function public.credit_card_minimum_payment_amount(
  p_balance numeric
)
returns numeric
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select least(
    p_balance,
    ceil(greatest(p_balance, 0) * 0.03 * 100) / 100
  );
$$;

create or replace function public.credit_card_minimum_payment_3_percent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.category, '')) = 'credit card' then
    if new.statement_balance is null then
      new.minimum_payment := 0;
      new.minimum_payment_eur := 0;
    else
      new.minimum_payment := public.credit_card_minimum_payment_amount(
        new.statement_balance
      );
      new.minimum_payment_eur := public.credit_card_minimum_payment_amount(
        coalesce(new.statement_balance_eur, 0)
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.credit_card_monthly_minimum_payment_round_up()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.minimum_payment := public.credit_card_minimum_payment_amount(
    new.statement_balance
  );
  new.minimum_payment_eur := public.credit_card_minimum_payment_amount(
    new.statement_balance_eur
  );
  return new;
end;
$$;

drop trigger if exists credit_card_monthly_minimum_payment_round_up
on public.credit_card_monthly_records;

create trigger credit_card_monthly_minimum_payment_round_up
before insert or update of
  statement_balance,
  statement_balance_eur,
  minimum_payment,
  minimum_payment_eur
on public.credit_card_monthly_records
for each row
execute function public.credit_card_monthly_minimum_payment_round_up();

update public.debts
set
  minimum_payment = case
    when statement_balance is null then 0
    else public.credit_card_minimum_payment_amount(statement_balance)
  end,
  minimum_payment_eur = case
    when statement_balance_eur is null then 0
    else public.credit_card_minimum_payment_amount(statement_balance_eur)
  end,
  updated_at = now()
where lower(category) = 'credit card';

update public.credit_card_monthly_records
set
  minimum_payment = public.credit_card_minimum_payment_amount(statement_balance),
  minimum_payment_eur = public.credit_card_minimum_payment_amount(statement_balance_eur),
  updated_at = now();

commit;
