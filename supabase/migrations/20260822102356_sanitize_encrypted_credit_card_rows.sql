begin;

create or replace function public.ficonter_sanitize_encrypted_credit_card_row()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.debt_kind='credit_card'
     and new.encryption_version=1
     and new.encrypted_payload is not null then
    new.name:=null;
    new.lender:=null;
    new.description:=null;
    new.category:=null;
    new.original_balance:=null;
    new.current_balance:=null;
    new.currency:=null;
    new.original_balance_eur:=null;
    new.current_balance_eur:=null;
    new.exchange_rate_to_eur:=null;
    new.annual_interest_rate:=null;
    new.minimum_payment:=null;
    new.minimum_payment_eur:=null;
    new.card_last_four:=null;
    new.credit_limit:=null;
    new.credit_limit_eur:=null;
    new.statement_balance:=null;
    new.statement_balance_eur:=null;
    new.interest_charged:=null;
    new.interest_charged_eur:=null;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_debts_sanitize_encrypted_credit_card on public.debts;
create trigger zz_debts_sanitize_encrypted_credit_card
before insert or update on public.debts
for each row execute function public.ficonter_sanitize_encrypted_credit_card_row();

commit;
