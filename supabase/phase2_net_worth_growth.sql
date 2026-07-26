-- FICONTER Phase 2 · Net Worth Growth
-- Extends the existing Wealth Score source of truth with historical growth data.
-- No duplicate net-worth balance, savings balance, or liability table is created.

begin;

create or replace function public.get_net_worth_growth_inputs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wealth jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_wealth := public.get_wealth_score_inputs();

  with source_months as (
    select date_trunc(
      'month',
      min(coalesce(occurred_at, transaction_date::timestamptz))
    )::date as month_start
    from public.transactions
    where user_id = v_user_id

    union all

    select date_trunc('month', min(created_at))::date as month_start
    from public.debts
    where user_id = v_user_id

    union all

    select date_trunc('month', min(paid_at))::date as month_start
    from public.debt_payments
    where user_id = v_user_id
  ),
  bounds as (
    select greatest(
      coalesce(min(month_start), date_trunc('month', current_date)::date),
      (date_trunc('month', current_date) - interval '119 months')::date
    )::date as first_month
    from source_months
  ),
  month_range as (
    select generate_series(
      bounds.first_month,
      date_trunc('month', current_date)::date,
      interval '1 month'
    )::date as month_start
    from bounds
  ),
  opening_transactions as (
    select
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    cross join bounds
    where user_id = v_user_id
      and coalesce(occurred_at, transaction_date::timestamptz) < bounds.first_month
  ),
  opening_debt as (
    select coalesce(sum(
      least(
        d.original_balance_eur,
        greatest(
          0,
          d.current_balance_eur + coalesce(future_payments.amount, 0)
        )
      )
    ), 0)::numeric as outstanding
    from public.debts d
    cross join bounds
    left join lateral (
      select coalesce(sum(dp.amount_eur), 0)::numeric as amount
      from public.debt_payments dp
      where dp.user_id = v_user_id
        and dp.debt_id = d.id
        and dp.paid_at >= bounds.first_month
    ) future_payments on true
    where d.user_id = v_user_id
      and d.created_at < bounds.first_month
  ),
  monthly_transactions as (
    select
      date_trunc(
        'month',
        coalesce(occurred_at, transaction_date::timestamptz)
      )::date as month_start,
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    cross join bounds
    where user_id = v_user_id
      and coalesce(occurred_at, transaction_date::timestamptz) >= bounds.first_month
    group by 1
  ),
  monthly_debt_payments as (
    select
      date_trunc('month', paid_at)::date as month_start,
      coalesce(sum(amount_eur), 0)::numeric as debt_payments
    from public.debt_payments
    cross join bounds
    where user_id = v_user_id
      and paid_at >= bounds.first_month
    group by 1
  ),
  monthly_base as (
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
      )::numeric as available_cash_change,
      coalesce(p.debt_payments, 0)::numeric as debt_payments
    from month_range m
    left join monthly_transactions t using (month_start)
    left join monthly_debt_payments p using (month_start)
  ),
  cumulative as (
    select
      b.*,
      (
        opening_transactions.income
        - opening_transactions.expenses
        + sum(b.retained_capital) over (
          order by b.month_start rows between unbounded preceding and current row
        )
      )::numeric as cumulative_capital,
      (
        opening_transactions.savings
        + sum(b.savings) over (
          order by b.month_start rows between unbounded preceding and current row
        )
      )::numeric as cumulative_savings,
      (
        opening_transactions.income
        - opening_transactions.expenses
        - opening_transactions.savings
        + sum(b.available_cash_change) over (
          order by b.month_start rows between unbounded preceding and current row
        )
      )::numeric as cumulative_available_cash
    from monthly_base b
    cross join opening_transactions
  ),
  positioned as (
    select
      c.*,
      coalesce(debt_state.outstanding, 0)::numeric as debt_outstanding
    from cumulative c
    left join lateral (
      select coalesce(sum(
        least(
          d.original_balance_eur,
          greatest(
            0,
            d.current_balance_eur + coalesce(future_payments.amount, 0)
          )
        )
      ), 0)::numeric as outstanding
      from public.debts d
      left join lateral (
        select coalesce(sum(dp.amount_eur), 0)::numeric as amount
        from public.debt_payments dp
        where dp.user_id = v_user_id
          and dp.debt_id = d.id
          and dp.paid_at >= c.month_start + interval '1 month'
      ) future_payments on true
      where d.user_id = v_user_id
        and d.created_at < c.month_start + interval '1 month'
    ) debt_state on true
  ),
  final_series as (
    select
      p.*,
      (p.cumulative_capital - p.debt_outstanding)::numeric as net_worth,
      (
        p.debt_outstanding
        - lag(p.debt_outstanding, 1, opening_debt.outstanding)
          over (order by p.month_start)
      )::numeric as debt_change,
      (
        (p.cumulative_capital - p.debt_outstanding)
        - lag(
            p.cumulative_capital - p.debt_outstanding,
            1,
            opening_transactions.income
              - opening_transactions.expenses
              - opening_debt.outstanding
          ) over (order by p.month_start)
      )::numeric as net_worth_change
    from positioned p
    cross join opening_transactions
    cross join opening_debt
  ),
  growth_payload as (
    select jsonb_build_object(
      'firstMonth', (select to_char(first_month, 'YYYY-MM') from bounds),
      'historyMonths', count(*)::integer,
      'monthly', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'retainedCapital', retained_capital,
            'availableCashChange', available_cash_change,
            'cumulativeCapital', cumulative_capital,
            'cumulativeSavings', cumulative_savings,
            'debtOutstanding', debt_outstanding,
            'debtPayments', debt_payments,
            'debtChange', debt_change,
            'netWorth', net_worth,
            'netWorthChange', net_worth_change
          ) order by month_start
        ),
        '[]'::jsonb
      )
    ) as payload
    from final_series
  )
  select
    v_wealth || jsonb_build_object(
      'schemaVersion', 1,
      'generatedAt', now(),
      'growth', growth_payload.payload
    )
  into v_result
  from growth_payload;

  return v_result;
end;
$$;

revoke all on function public.get_net_worth_growth_inputs() from public, anon;
grant execute on function public.get_net_worth_growth_inputs() to authenticated;

comment on function public.get_net_worth_growth_inputs() is
  'Returns privacy-scoped Net Worth Growth history for the authenticated user while reusing the existing Wealth Score source of truth.';

commit;

notify pgrst, 'reload schema';
