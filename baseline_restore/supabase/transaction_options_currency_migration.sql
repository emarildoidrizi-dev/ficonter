-- Ficonter — Transaction Options & Multi-Currency Migration
-- Run once in Supabase SQL Editor before deploying this UI update.

alter table public.transactions
  add column if not exists currency text not null default 'EUR';

update public.transactions
set currency = 'EUR'
where currency is null or btrim(currency) = '';

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in (
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
    'expense',
    'purchase',
    'bill_payment',
    'subscription_payment',
    'rent_payment',
    'mortgage_payment',
    'loan_repayment',
    'credit_card_payment',
    'tax_payment',
    'fee',
    'fine_penalty',
    'donation',
    'gift_sent',
    'cash_withdrawal',
    'savings_contribution',
    'investment_purchase',
    'retirement_contribution',
    'crypto_purchase',
    'crypto_sale',
    'transfer',
    'currency_exchange',
    'balance_adjustment',
    'opening_balance'
  ));

alter table public.transactions
  drop constraint if exists transactions_currency_check;

alter table public.transactions
  add constraint transactions_currency_check
  check (currency ~ '^[A-Z]{3}$');

create index if not exists transactions_user_currency_date_idx
on public.transactions (user_id, currency, transaction_date desc);

notify pgrst, 'reload schema';
