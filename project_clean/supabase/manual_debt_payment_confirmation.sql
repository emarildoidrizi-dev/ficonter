-- FICONTER · Manual Debt Payment Confirmation
--
-- Scheduled loan and instalment payments must not be treated as paid until the
-- user confirms that money actually left their account.
--
-- Existing payment history is preserved. This migration only disables future
-- automatic debt-payment recording for non-credit-card debts.

begin;

update public.debts
set
  autopay = false,
  autopay_enabled_at = null,
  updated_at = now()
where lower(coalesce(category, '')) <> 'credit card'
  and (
    autopay is true
    or autopay_enabled_at is not null
  );

create or replace function public.enforce_manual_debt_payment_confirmation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.category, '')) <> 'credit card' then
    new.autopay := false;
    new.autopay_enabled_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists debts_manual_payment_confirmation
on public.debts;

create trigger debts_manual_payment_confirmation
before insert or update of category, autopay, autopay_enabled_at
on public.debts
for each row
execute function public.enforce_manual_debt_payment_confirmation();

comment on function public.enforce_manual_debt_payment_confirmation()
is 'Prevents non-credit-card debts from being marked paid by the automatic schedule before the user confirms the payment.';

commit;
