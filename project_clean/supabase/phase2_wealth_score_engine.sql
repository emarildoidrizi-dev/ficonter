-- FICONTER Phase 2 · Wealth Score inputs
-- Run once in Supabase SQL Editor after phase2_financial_health_engine.sql.
-- The Wealth Score reuses get_financial_health_inputs() as its shared source
-- for savings, debt, goals and emergency-reserve metrics.

begin;

create or replace function public.get_wealth_score_inputs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_health jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_health := public.get_financial_health_inputs();

  with month_range as (
    select generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  monthly_transactions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    where user_id = v_user_id
      and transaction_date >= (date_trunc('month', current_date) - interval '11 months')::date
      and transaction_date <= current_date
    group by 1
  ),
  monthly_series as (
    select
      m.month_start,
      coalesce(t.transaction_count, 0)::integer as transaction_count,
      coalesce(t.income, 0)::numeric as income,
      coalesce(t.expenses, 0)::numeric as expenses,
      coalesce(t.savings, 0)::numeric as savings,
      (coalesce(t.income, 0) - coalesce(t.expenses, 0))::numeric as retained_capital,
      (
        coalesce(t.income, 0)
        - coalesce(t.expenses, 0)
        - coalesce(t.savings, 0)
      )::numeric as available_cash_change
    from month_range m
    left join monthly_transactions t using (month_start)
    order by m.month_start
  ),
  period_metrics as (
    select
      coalesce(sum(income) filter (
        where month_start >= date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as recent_3_month_income,
      coalesce(sum(retained_capital) filter (
        where month_start >= date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as recent_3_month_retained_capital,
      coalesce(sum(income) filter (
        where month_start >= date_trunc('month', current_date) - interval '5 months'
          and month_start < date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as prior_3_month_income,
      coalesce(sum(retained_capital) filter (
        where month_start >= date_trunc('month', current_date) - interval '5 months'
          and month_start < date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as prior_3_month_retained_capital
    from monthly_series
  ),
  liabilities as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'originalBalance', original_balance_eur,
          'currentBalance', current_balance_eur,
          'annualInterestRate', annual_interest_rate,
          'status', status,
          'updatedAt', updated_at
        ) order by current_balance_eur desc, created_at asc
      ),
      '[]'::jsonb
    ) as items
    from public.debts
    where user_id = v_user_id
      and status <> 'paid_off'
  ),
  totals as (
    select
      coalesce((v_health #>> '{transactions,totalIncome}')::numeric, 0) as total_income,
      coalesce((v_health #>> '{transactions,totalExpenses}')::numeric, 0) as total_expenses,
      coalesce((v_health #>> '{transactions,totalSavings}')::numeric, 0) as total_savings,
      coalesce((v_health #>> '{debts,currentBalance}')::numeric, 0) as current_debt,
      coalesce((v_health #>> '{transactions,activeMonths}')::integer, 0) as history_months
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'financialHealth', v_health,
    'wealth', jsonb_build_object(
      'availableCash', totals.total_income - totals.total_expenses - totals.total_savings,
      'recordedSavings', totals.total_savings,
      'recordedCapital', totals.total_income - totals.total_expenses,
      'currentDebt', totals.current_debt,
      'netWorth', totals.total_income - totals.total_expenses - totals.current_debt,
      'recent3MonthIncome', period_metrics.recent_3_month_income,
      'recent3MonthRetainedCapital', period_metrics.recent_3_month_retained_capital,
      'prior3MonthIncome', period_metrics.prior_3_month_income,
      'prior3MonthRetainedCapital', period_metrics.prior_3_month_retained_capital,
      'historyMonths', totals.history_months
    ),
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'retainedCapital', retained_capital,
            'availableCashChange', available_cash_change
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'liabilities', liabilities.items
  ) into v_result
  from totals
  cross join period_metrics
  cross join liabilities;

  return v_result;
end;
$$;

revoke all on function public.get_wealth_score_inputs() from public, anon;
grant execute on function public.get_wealth_score_inputs() to authenticated;

comment on function public.get_wealth_score_inputs() is
  'Returns privacy-scoped Wealth Score inputs for the authenticated user, reusing the existing Financial Health source of truth.';

commit;

notify pgrst, 'reload schema';
