-- FICONTER · Automatic 3% Credit-Card Minimum Payment
--
-- The minimum payment is a due amount, not a purchase.
-- It must never increase the credit-card balance or Total Debt.
--
-- This migration:
-- 1. recalculates existing confirmed card statements at 3%;
-- 2. enforces 3% whenever statement balances are created or updated;
-- 3. preserves public.debts as the shared liability source.

begin;

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
      new.minimum_payment := least(
        new.statement_balance,
        round(new.statement_balance * 0.03, 2)
      );

      new.minimum_payment_eur := least(
        coalesce(new.statement_balance_eur, 0),
        round(coalesce(new.statement_balance_eur, 0) * 0.03, 2)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists debts_credit_card_minimum_payment_3_percent
on public.debts;

create trigger debts_credit_card_minimum_payment_3_percent
before insert or update of
  category,
  statement_balance,
  statement_balance_eur
on public.debts
for each row
execute function public.credit_card_minimum_payment_3_percent();

update public.debts
set
  minimum_payment = case
    when statement_balance is null then 0
    else least(
      statement_balance,
      round(statement_balance * 0.03, 2)
    )
  end,
  minimum_payment_eur = case
    when statement_balance_eur is null then 0
    else least(
      statement_balance_eur,
      round(statement_balance_eur * 0.03, 2)
    )
  end,
  updated_at = now()
where lower(category) = 'credit card';

commit;
