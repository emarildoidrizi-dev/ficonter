-- Ficonter — Simplify Transaction Types
-- Converts every existing transaction to either "income" or "expense"
-- and restricts future records to those two values.

alter table public.transactions
  drop constraint if exists transactions_type_check;

update public.transactions
set type = case
  when type in (
    'income',
    'salary',
    'bonus',
    'freelance_income',
    'business_income',
    'interest_income',
    'dividend_income',
    'rental_income',
    'benefit_income',
    'pension_income',
    'gift_received',
    'cashback',
    'refund',
    'reimbursement',
    'loan_received',
    'insurance_payout',
    'asset_sale',
    'investment_sale',
    'savings_withdrawal',
    'cash_deposit',
    'crypto_sale',
    'opening_balance'
  ) then 'income'
  else 'expense'
end;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('expense', 'income'));

notify pgrst, 'reload schema';
