-- FICONTER · Financial Consistency Hardening v1
-- Consolidated production migration.
--
-- Corrects cross-module reporting dates, future-dated transaction handling,
-- one-calendar-month commitments, financial protection baselines, historical
-- comparison rules, and Smart Insights source consistency.
--
-- Run once in the Supabase SQL Editor. The migration is atomic: either every
-- database object is updated successfully or none of these changes are applied.

begin;

-- ============================================================================
-- SOURCE: supabase/phase2_financial_health_engine.sql
-- ============================================================================
-- FICONTER Phase 2 · Financial Health Score inputs
-- Run once in Supabase SQL Editor before deploying the application files.

create or replace function public.get_financial_health_inputs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  with transaction_metrics as (
    select
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as total_income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as total_expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as total_savings,
      coalesce(
        sum(amount_eur) filter (
          where type = 'saving'
            and lower(category) = 'emergency fund'
        ),
        0
      )::numeric as emergency_fund_savings,
      coalesce(
        sum(amount_eur) filter (
          where type = 'saving'
            and description ilike 'Goal investment ·%'
        ),
        0
      )::numeric as goal_investments,
      coalesce(
        sum(amount_eur) filter (
          where type = 'expense'
            and (
              description ilike 'Debt payment ·%'
              or lower(category) in (
                'debt repayment',
                'credit-card payment',
                'personal-loan payment',
                'student-loan payment',
                'mortgage principal'
              )
            )
        ),
        0
      )::numeric as debt_payments,
      count(distinct to_char(transaction_date, 'YYYY-MM'))::integer as active_months,
      (
        count(distinct to_char(transaction_date, 'YYYY-MM'))
          filter (where type = 'income')
      )::integer as income_months,
      (
        count(distinct to_char(transaction_date, 'YYYY-MM'))
          filter (where type = 'expense')
      )::integer as expense_months,
      coalesce(
        sum(amount_eur) filter (
          where type in ('expense', 'saving')
            and date_trunc('month', transaction_date) = date_trunc('month', current_date)
        ),
        0
      )::numeric as current_month_outflow
    from public.transactions
    where user_id = v_user_id
      and transaction_date <= current_date
  ),
  bill_metrics as (
    select
      count(*)::integer as bill_count,
      (count(*) filter (
        where status = 'pending' and due_date >= current_date
      ))::integer as pending_count,
      (count(*) filter (
        where status = 'pending' and due_date < current_date
      ))::integer as overdue_count,
      (count(*) filter (where status = 'paid'))::integer as paid_count,
      (count(*) filter (
        where status = 'paid'
          and paid_at is not null
          and paid_at::date <= due_date
      ))::integer as paid_on_time_count,
      (count(*) filter (
        where status = 'pending'
          and due_date between current_date and current_date + 30
      ))::integer as due_next_30_days_count,
      coalesce(
        sum(amount_eur) filter (where status = 'pending'),
        0
      )::numeric as pending_amount,
      coalesce(
        sum(amount_eur) filter (
          where status = 'pending'
            and due_date >= current_date
            and due_date <= (current_date + interval '1 month')::date
        ),
        0
      )::numeric as one_month_amount
    from public.bills
    where user_id = v_user_id
  ),
  debt_metrics as (
    select
      count(*)::integer as debt_count,
      (count(*) filter (where status <> 'paid_off'))::integer as active_count,
      coalesce(
        sum(original_balance_eur) filter (where status <> 'paid_off'),
        0
      )::numeric as original_balance,
      coalesce(
        sum(current_balance_eur) filter (where status <> 'paid_off'),
        0
      )::numeric as current_balance,
      coalesce(
        sum(minimum_payment_eur) filter (where status <> 'paid_off'),
        0
      )::numeric as minimum_monthly_payment,
      coalesce(
        avg(annual_interest_rate) filter (where status <> 'paid_off'),
        0
      )::numeric as average_interest_rate
    from public.debts
    where user_id = v_user_id
  ),
  goal_metrics as (
    select
      count(*)::integer as goal_count,
      (count(*) filter (where status = 'active'))::integer as active_count,
      (count(*) filter (where status = 'completed'))::integer as completed_count,
      coalesce(sum(target_amount), 0)::numeric as total_target,
      coalesce(sum(current_amount), 0)::numeric as total_current
    from public.goals
    where user_id = v_user_id
  ),
  planner_metrics as (
    select
      to_char(current_date, 'YYYY-MM') as current_month,
      exists (
        select 1
        from public.monthly_budget_plans plan
        where plan.user_id = v_user_id
          and plan.month = to_char(current_date, 'YYYY-MM')
      ) as has_plan,
      count(*)::integer as item_count,
      coalesce(
        sum(planned_amount) filter (where section = 'income'),
        0
      )::numeric as planned_income,
      coalesce(
        sum(planned_amount) filter (where section <> 'income'),
        0
      )::numeric as planned_outflow
    from public.monthly_budget_items
    where user_id = v_user_id
      and month = to_char(current_date, 'YYYY-MM')
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'transactions', jsonb_build_object(
      'count', transaction_metrics.transaction_count,
      'totalIncome', transaction_metrics.total_income,
      'totalExpenses', transaction_metrics.total_expenses,
      'totalSavings', transaction_metrics.total_savings,
      'emergencyFundSavings', transaction_metrics.emergency_fund_savings,
      'goalInvestments', transaction_metrics.goal_investments,
      'debtPayments', transaction_metrics.debt_payments,
      'activeMonths', transaction_metrics.active_months,
      'incomeMonths', transaction_metrics.income_months,
      'expenseMonths', transaction_metrics.expense_months,
      'currentMonthOutflow', transaction_metrics.current_month_outflow
    ),
    'bills', jsonb_build_object(
      'count', bill_metrics.bill_count,
      'pendingCount', bill_metrics.pending_count,
      'overdueCount', bill_metrics.overdue_count,
      'paidCount', bill_metrics.paid_count,
      'paidOnTimeCount', bill_metrics.paid_on_time_count,
      'dueNext30DaysCount', bill_metrics.due_next_30_days_count,
      'pendingAmount', bill_metrics.pending_amount,
      'oneMonthAmount', bill_metrics.one_month_amount
    ),
    'debts', jsonb_build_object(
      'count', debt_metrics.debt_count,
      'activeCount', debt_metrics.active_count,
      'originalBalance', debt_metrics.original_balance,
      'currentBalance', debt_metrics.current_balance,
      'minimumMonthlyPayment', debt_metrics.minimum_monthly_payment,
      'averageInterestRate', debt_metrics.average_interest_rate
    ),
    'goals', jsonb_build_object(
      'count', goal_metrics.goal_count,
      'activeCount', goal_metrics.active_count,
      'completedCount', goal_metrics.completed_count,
      'totalTarget', goal_metrics.total_target,
      'totalCurrent', goal_metrics.total_current
    ),
    'planner', jsonb_build_object(
      'currentMonth', planner_metrics.current_month,
      'hasPlan', planner_metrics.has_plan,
      'itemCount', planner_metrics.item_count,
      'plannedIncome', planner_metrics.planned_income,
      'plannedOutflow', planner_metrics.planned_outflow
    )
  ) into v_result
  from transaction_metrics
  cross join bill_metrics
  cross join debt_metrics
  cross join goal_metrics
  cross join planner_metrics;

  return v_result;
end;
$$;

revoke all on function public.get_financial_health_inputs() from public, anon;
grant execute on function public.get_financial_health_inputs() to authenticated;

comment on function public.get_financial_health_inputs() is
  'Returns privacy-safe financial-health inputs for the authenticated user only.';

-- ============================================================================
-- SOURCE: supabase/phase2_cash_flow_intelligence.sql
-- ============================================================================
-- FICONTER Phase 2 · Cash Flow Intelligence inputs
-- Run once in Supabase SQL Editor after phase2_financial_health_engine.sql.
-- Core totals are inherited from get_financial_health_inputs(); this function
-- adds time-series, spending-pressure and known-commitment intelligence only.

create or replace function public.get_cash_flow_intelligence_inputs()
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
      months.month_start,
      coalesce(tx.transaction_count, 0)::integer as transaction_count,
      coalesce(tx.income, 0)::numeric as income,
      coalesce(tx.expenses, 0)::numeric as expenses,
      coalesce(tx.savings, 0)::numeric as savings,
      (coalesce(tx.expenses, 0) + coalesce(tx.savings, 0))::numeric as outflow,
      (
        coalesce(tx.income, 0)
        - coalesce(tx.expenses, 0)
        - coalesce(tx.savings, 0)
      )::numeric as net_cash_flow
    from month_range months
    left join monthly_transactions tx using (month_start)
    order by months.month_start
  ),
  recent_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 89
      and transaction_date <= current_date
    group by 1
  ),
  prior_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 179
      and transaction_date < current_date - 89
    group by 1
  ),
  category_rows as (
    select
      coalesce(recent.category, prior.category) as category,
      coalesce(recent.amount, 0)::numeric as recent_amount,
      coalesce(prior.amount, 0)::numeric as prior_amount
    from recent_categories recent
    full outer join prior_categories prior using (category)
  ),
  category_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category', ranked.category,
          'recentAmount', ranked.recent_amount,
          'priorAmount', ranked.prior_amount
        ) order by ranked.recent_amount desc, ranked.category asc
      ),
      '[]'::jsonb
    ) as items
    from (
      select category, recent_amount, prior_amount
      from category_rows
      where recent_amount > 0 or prior_amount > 0
      order by recent_amount desc, category asc
      limit 8
    ) ranked
  ),
  bill_commitments as (
    select
      ('bill:' || id::text) as id,
      'bill'::text as kind,
      name,
      category,
      due_date,
      coalesce(amount_eur, 0)::numeric as amount
    from public.bills
    where user_id = v_user_id
      and status = 'pending'
      and due_date between current_date and current_date + 30
  ),
  debt_commitments as (
    select
      ('debt:' || id::text) as id,
      'debt'::text as kind,
      name,
      category,
      null::date as due_date,
      coalesce(minimum_payment_eur, 0)::numeric as amount
    from public.debts
    where user_id = v_user_id
      and status <> 'paid_off'
      and coalesce(minimum_payment_eur, 0) > 0
  ),
  commitment_rows as (
    select * from bill_commitments
    union all
    select * from debt_commitments
  ),
  commitment_totals as (
    select
      coalesce(sum(amount) filter (where kind = 'bill'), 0)::numeric as bills_total,
      coalesce(sum(amount) filter (where kind = 'debt'), 0)::numeric as debt_minimums,
      coalesce(sum(amount), 0)::numeric as total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'kind', kind,
            'name', name,
            'category', category,
            'dueDate', due_date,
            'amount', amount
          ) order by due_date asc nulls last, amount desc, name asc
        ),
        '[]'::jsonb
      ) as items
    from commitment_rows
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'financialHealth', v_health,
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'outflow', outflow,
            'netCashFlow', net_cash_flow
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'categories', category_json.items,
    'commitments', jsonb_build_object(
      'total', commitment_totals.total,
      'billsTotal', commitment_totals.bills_total,
      'debtMinimums', commitment_totals.debt_minimums,
      'items', commitment_totals.items
    ),
    'planner', jsonb_build_object(
      'hasPlan', coalesce((v_health #>> '{planner,hasPlan}')::boolean, false),
      'plannedIncome', coalesce((v_health #>> '{planner,plannedIncome}')::numeric, 0),
      'plannedOutflow', coalesce((v_health #>> '{planner,plannedOutflow}')::numeric, 0)
    )
  ) into v_result
  from category_json
  cross join commitment_totals;

  return v_result;
end;
$$;

revoke all on function public.get_cash_flow_intelligence_inputs() from public, anon;
grant execute on function public.get_cash_flow_intelligence_inputs() to authenticated;

comment on function public.get_cash_flow_intelligence_inputs() is
  'Returns privacy-scoped Cash Flow Intelligence inputs for the authenticated user, reusing the existing Financial Health source of truth.';

-- ============================================================================
-- SOURCE: supabase/cash_flow_one_month_commitments_v2.sql
-- ============================================================================
-- FICONTER · Cash Flow one-calendar-month commitment alignment v2
-- Production migration: run once in Supabase SQL Editor.
--
-- Purpose
-- Adds a versioned Cash Flow RPC with an inclusive one-calendar-month
-- window. The existing v1 RPC remains untouched for production rollback safety. A bill due on 31 August is therefore included when the calculation
-- runs on 31 July. The Cash Flow and Bills modules now use the same planning
-- boundary for upcoming commitments.

create or replace function public.get_cash_flow_intelligence_inputs_v2()
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
      months.month_start,
      coalesce(tx.transaction_count, 0)::integer as transaction_count,
      coalesce(tx.income, 0)::numeric as income,
      coalesce(tx.expenses, 0)::numeric as expenses,
      coalesce(tx.savings, 0)::numeric as savings,
      (coalesce(tx.expenses, 0) + coalesce(tx.savings, 0))::numeric as outflow,
      (
        coalesce(tx.income, 0)
        - coalesce(tx.expenses, 0)
        - coalesce(tx.savings, 0)
      )::numeric as net_cash_flow
    from month_range months
    left join monthly_transactions tx using (month_start)
    order by months.month_start
  ),
  recent_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 89
      and transaction_date <= current_date
    group by 1
  ),
  prior_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 179
      and transaction_date < current_date - 89
    group by 1
  ),
  category_rows as (
    select
      coalesce(recent.category, prior.category) as category,
      coalesce(recent.amount, 0)::numeric as recent_amount,
      coalesce(prior.amount, 0)::numeric as prior_amount
    from recent_categories recent
    full outer join prior_categories prior using (category)
  ),
  category_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category', ranked.category,
          'recentAmount', ranked.recent_amount,
          'priorAmount', ranked.prior_amount
        ) order by ranked.recent_amount desc, ranked.category asc
      ),
      '[]'::jsonb
    ) as items
    from (
      select category, recent_amount, prior_amount
      from category_rows
      where recent_amount > 0 or prior_amount > 0
      order by recent_amount desc, category asc
      limit 8
    ) ranked
  ),
  bill_commitments as (
    select
      ('bill:' || id::text) as id,
      'bill'::text as kind,
      name,
      category,
      due_date,
      coalesce(amount_eur, 0)::numeric as amount
    from public.bills
    where user_id = v_user_id
      and status = 'pending'
      and due_date >= current_date
      and due_date <= (current_date + interval '1 month')::date
  ),
  debt_commitments as (
    select
      ('debt:' || id::text) as id,
      'debt'::text as kind,
      name,
      category,
      null::date as due_date,
      coalesce(minimum_payment_eur, 0)::numeric as amount
    from public.debts
    where user_id = v_user_id
      and status <> 'paid_off'
      and coalesce(minimum_payment_eur, 0) > 0
  ),
  commitment_rows as (
    select * from bill_commitments
    union all
    select * from debt_commitments
  ),
  commitment_totals as (
    select
      coalesce(sum(amount) filter (where kind = 'bill'), 0)::numeric as bills_total,
      coalesce(sum(amount) filter (where kind = 'debt'), 0)::numeric as debt_minimums,
      coalesce(sum(amount), 0)::numeric as total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'kind', kind,
            'name', name,
            'category', category,
            'dueDate', due_date,
            'amount', amount
          ) order by due_date asc nulls last, amount desc, name asc
        ),
        '[]'::jsonb
      ) as items
    from commitment_rows
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'financialHealth', v_health,
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'outflow', outflow,
            'netCashFlow', net_cash_flow
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'categories', category_json.items,
    'commitments', jsonb_build_object(
      'total', commitment_totals.total,
      'billsTotal', commitment_totals.bills_total,
      'debtMinimums', commitment_totals.debt_minimums,
      'items', commitment_totals.items
    ),
    'planner', jsonb_build_object(
      'hasPlan', coalesce((v_health #>> '{planner,hasPlan}')::boolean, false),
      'plannedIncome', coalesce((v_health #>> '{planner,plannedIncome}')::numeric, 0),
      'plannedOutflow', coalesce((v_health #>> '{planner,plannedOutflow}')::numeric, 0)
    )
  ) into v_result
  from category_json
  cross join commitment_totals;

  return v_result;
end;
$$;

revoke all on function public.get_cash_flow_intelligence_inputs_v2() from public, anon;
grant execute on function public.get_cash_flow_intelligence_inputs_v2() to authenticated;

comment on function public.get_cash_flow_intelligence_inputs_v2() is
  'Returns privacy-scoped Cash Flow Intelligence inputs using an inclusive one-calendar-month commitment window.';

-- ============================================================================
-- SOURCE: supabase/phase2_savings_intelligence.sql
-- ============================================================================
-- FICONTER Phase 2 · Savings Intelligence inputs
-- Run in Supabase SQL Editor after phase2_cash_flow_intelligence.sql.
-- Emergency Fund contributions are intentionally excluded because they are
-- analyzed in the dedicated Emergency Fund module. Income, expenses and
-- affordability inputs continue to reuse the existing Cash Flow and Financial
-- Health sources of truth.

create or replace function public.get_savings_intelligence_inputs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cash_flow jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_cash_flow := public.get_cash_flow_intelligence_inputs_v2();

  with month_range as (
    select generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  saving_rows as (
    select
      case
        when description ilike 'Goal investment ·%' then 'Goal investments'
        else coalesce(nullif(trim(category), ''), 'General savings')
      end as saving_category,
      coalesce(amount_eur, 0)::numeric as amount,
      transaction_date,
      coalesce(occurred_at, transaction_date::timestamptz, created_at) as occurred_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and coalesce(lower(trim(category)), '') <> 'emergency fund'
  ),
  monthly_contributions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as contribution_count,
      coalesce(sum(amount), 0)::numeric as savings
    from saving_rows
    where transaction_date >=
      (date_trunc('month', current_date) - interval '11 months')::date
    group by 1
  ),
  monthly_series as (
    select
      months.month_start,
      coalesce(contributions.contribution_count, 0)::integer as contribution_count,
      coalesce(contributions.savings, 0)::numeric as savings
    from month_range months
    left join monthly_contributions contributions using (month_start)
    order by months.month_start
  ),
  category_rows as (
    select
      saving_category as category,
      count(*)::integer as contribution_count,
      coalesce(sum(amount), 0)::numeric as amount,
      max(occurred_at) as latest_at
    from saving_rows
    group by saving_category
  ),
  recent_savings as (
    select
      id,
      coalesce(nullif(trim(description), ''), 'Saving contribution') as description,
      case
        when description ilike 'Goal investment ·%' then 'Goal investments'
        else coalesce(nullif(trim(category), ''), 'General savings')
      end as category,
      coalesce(amount_eur, 0)::numeric as amount,
      coalesce(occurred_at, transaction_date::timestamptz, created_at) as occurred_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and coalesce(lower(trim(category)), '') <> 'emergency fund'
    order by coalesce(occurred_at, transaction_date::timestamptz, created_at) desc
    limit 10
  ),
  saving_stats as (
    select
      coalesce(sum(amount), 0)::numeric as total_amount,
      count(*)::integer as contribution_count,
      min(occurred_at) as first_contribution_at,
      max(occurred_at) as last_contribution_at
    from saving_rows
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'generatedAt', now(),
    'cashFlow', v_cash_flow,
    'monthlySavings', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'contributionCount', contribution_count,
            'savings', savings
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'categories', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'category', category,
            'amount', amount,
            'contributionCount', contribution_count,
            'latestAt', latest_at
          ) order by amount desc, category asc
        ),
        '[]'::jsonb
      )
      from category_rows
    ),
    'recentSavings', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id::text,
            'description', description,
            'category', category,
            'amount', amount,
            'occurredAt', occurred_at
          ) order by occurred_at desc
        ),
        '[]'::jsonb
      )
      from recent_savings
    ),
    'stats', jsonb_build_object(
      'totalAmount', saving_stats.total_amount,
      'contributionCount', saving_stats.contribution_count,
      'firstContributionAt', saving_stats.first_contribution_at,
      'lastContributionAt', saving_stats.last_contribution_at
    )
  ) into v_result
  from saving_stats;

  return v_result;
end;
$$;

revoke all on function public.get_savings_intelligence_inputs() from public, anon;
grant execute on function public.get_savings_intelligence_inputs() to authenticated;

comment on function public.get_savings_intelligence_inputs() is
  'Returns privacy-scoped non-emergency Savings Intelligence inputs for the authenticated user. Emergency Fund contributions remain exclusively in the dedicated Emergency Fund module.';

-- ============================================================================
-- SOURCE: supabase/phase2_emergency_fund.sql
-- ============================================================================
-- FICONTER Phase 2 · Emergency Fund Intelligence inputs
-- Run once in Supabase SQL Editor after phase2_financial_health_engine.sql.
-- Core income, expense, savings and reserve totals are inherited from
-- get_financial_health_inputs(); this function adds contribution history only.

create or replace function public.get_emergency_fund_intelligence_inputs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_health jsonb;
  v_cash_flow jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_health := public.get_financial_health_inputs();
  v_cash_flow := public.get_cash_flow_intelligence_inputs_v2();

  with contribution_bounds as (
    select min(
      date_trunc(
        'month',
        transaction_date
      )::date
    ) as first_month
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
  ),
  month_range as (
    select generate_series(
      least(
        coalesce(
          (select first_month from contribution_bounds),
          date_trunc('month', current_date)::date
        ),
        (date_trunc('month', current_date) - interval '11 months')::date
      ),
      date_trunc('month', current_date)::date,
      interval '1 month'
    )::date as month_start
  ),
  monthly_contributions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as contribution_count,
      coalesce(sum(amount_eur), 0)::numeric as contribution
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
    group by 1
  ),
  monthly_series as (
    select
      months.month_start,
      coalesce(contributions.contribution_count, 0)::integer as contribution_count,
      coalesce(contributions.contribution, 0)::numeric as contribution
    from month_range months
    left join monthly_contributions contributions using (month_start)
    order by months.month_start
  ),
  recent_contributions as (
    select
      id,
      coalesce(nullif(trim(description), ''), 'Emergency fund saving') as description,
      coalesce(amount_eur, 0)::numeric as amount,
      coalesce(occurred_at, transaction_date::timestamptz, created_at) as occurred_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
    order by coalesce(occurred_at, transaction_date::timestamptz, created_at) desc
    limit 10
  ),
  contribution_stats as (
    select
      count(*)::integer as contribution_count,
      max(coalesce(occurred_at, transaction_date::timestamptz, created_at)) as last_contribution_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'generatedAt', now(),
    'financialHealth', v_health,
    'oneMonthCommitments', coalesce((v_cash_flow #>> '{commitments,total}')::numeric, 0),
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'contributionCount', contribution_count,
            'contribution', contribution
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'recentContributions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id::text,
            'description', description,
            'amount', amount,
            'occurredAt', occurred_at
          ) order by occurred_at desc
        ),
        '[]'::jsonb
      )
      from recent_contributions
    ),
    'stats', jsonb_build_object(
      'contributionCount', contribution_stats.contribution_count,
      'lastContributionAt', contribution_stats.last_contribution_at
    )
  ) into v_result
  from contribution_stats;

  return v_result;
end;
$$;

revoke all on function public.get_emergency_fund_intelligence_inputs() from public, anon;
grant execute on function public.get_emergency_fund_intelligence_inputs() to authenticated;

comment on function public.get_emergency_fund_intelligence_inputs() is
  'Returns privacy-scoped Emergency Fund Intelligence inputs, including complete monthly contribution history, for the authenticated user while reusing the existing Financial Health source of truth.';

-- ============================================================================
-- SOURCE: supabase/phase2_wealth_score_engine.sql
-- ============================================================================
-- FICONTER Phase 2 · Wealth Score inputs
-- Run once in Supabase SQL Editor after phase2_financial_health_engine.sql.
-- The Wealth Score reuses get_financial_health_inputs() as its shared source
-- for savings, debt, goals and emergency-reserve metrics.

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

-- ============================================================================
-- SOURCE: supabase/phase2_net_worth_growth.sql
-- ============================================================================
-- FICONTER Phase 2 · Net Worth Growth
-- Extends the existing Wealth Score source of truth with historical growth data.
-- No duplicate net-worth balance, savings balance, or liability table is created.

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
    select date_trunc('month', min(transaction_date))::date as month_start
    from public.transactions
    where user_id = v_user_id
      and transaction_date <= current_date

    union all

    select date_trunc('month', min(created_at))::date as month_start
    from public.debts
    where user_id = v_user_id
      and created_at::date <= current_date

    union all

    select date_trunc('month', min(paid_at))::date as month_start
    from public.debt_payments
    where user_id = v_user_id
      and paid_at::date <= current_date
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
      and transaction_date < bounds.first_month
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
        and dp.paid_at::date <= current_date
    ) future_payments on true
    where d.user_id = v_user_id
      and d.created_at < bounds.first_month
      and d.created_at::date <= current_date
  ),
  monthly_transactions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    cross join bounds
    where user_id = v_user_id
      and transaction_date >= bounds.first_month
      and transaction_date <= current_date
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
      and paid_at::date <= current_date
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
          and dp.paid_at::date <= current_date
      ) future_payments on true
      where d.user_id = v_user_id
        and d.created_at < c.month_start + interval '1 month'
        and d.created_at::date <= current_date
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

-- ============================================================================
-- SOURCE: supabase/phase2_financial_independence.sql
-- ============================================================================
-- FICONTER Phase 2 · Financial Independence
-- Reuses Net Worth Growth, Savings Intelligence and Emergency Fund inputs.
-- Creates only private planning assumptions; no duplicate balances are stored.

create table if not exists public.financial_independence_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_monthly_spending numeric(14, 2),
  withdrawal_rate numeric(5, 2) not null default 4.00,
  annual_real_return_rate numeric(5, 2) not null default 4.00,
  updated_at timestamptz not null default now(),
  constraint financial_independence_target_spending_check
    check (target_monthly_spending is null or target_monthly_spending > 0),
  constraint financial_independence_withdrawal_rate_check
    check (withdrawal_rate between 2.00 and 8.00),
  constraint financial_independence_real_return_rate_check
    check (annual_real_return_rate between -2.00 and 12.00)
);

update public.financial_independence_settings
set target_monthly_spending = null
where target_monthly_spending is not null
  and target_monthly_spending <= 0;

alter table public.financial_independence_settings
  drop constraint if exists financial_independence_target_spending_check;
alter table public.financial_independence_settings
  add constraint financial_independence_target_spending_check
  check (target_monthly_spending is null or target_monthly_spending > 0);

alter table public.financial_independence_settings enable row level security;

grant select, insert, update, delete
  on public.financial_independence_settings
  to authenticated;

drop policy if exists "Users can read their financial independence settings"
  on public.financial_independence_settings;
create policy "Users can read their financial independence settings"
  on public.financial_independence_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their financial independence settings"
  on public.financial_independence_settings;
create policy "Users can create their financial independence settings"
  on public.financial_independence_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their financial independence settings"
  on public.financial_independence_settings;
create policy "Users can update their financial independence settings"
  on public.financial_independence_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their financial independence settings"
  on public.financial_independence_settings;
create policy "Users can delete their financial independence settings"
  on public.financial_independence_settings
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.get_financial_independence_inputs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_growth jsonb;
  v_savings jsonb;
  v_emergency jsonb;
  v_settings jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_growth := public.get_net_worth_growth_inputs();
  v_savings := public.get_savings_intelligence_inputs();
  v_emergency := public.get_emergency_fund_intelligence_inputs();

  select jsonb_build_object(
    'targetMonthlySpending', settings.target_monthly_spending,
    'withdrawalRate', settings.withdrawal_rate,
    'annualRealReturnRate', settings.annual_real_return_rate,
    'updatedAt', settings.updated_at
  )
  into v_settings
  from public.financial_independence_settings settings
  where settings.user_id = v_user_id;

  if v_settings is null then
    v_settings := jsonb_build_object(
      'targetMonthlySpending', null,
      'withdrawalRate', 4.00,
      'annualRealReturnRate', 4.00,
      'updatedAt', null
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'netWorthGrowth', v_growth,
    'savingsIntelligence', v_savings,
    'emergencyFund', v_emergency,
    'settings', v_settings
  );
end;
$$;

revoke all on function public.get_financial_independence_inputs() from public, anon;
grant execute on function public.get_financial_independence_inputs() to authenticated;

comment on table public.financial_independence_settings is
  'Private per-user Financial Independence planning assumptions protected by RLS.';

comment on function public.get_financial_independence_inputs() is
  'Returns Financial Independence inputs for the authenticated user by composing existing Wealth Engine sources of truth.';

-- ============================================================================
-- SOURCE: supabase/phase2_ai_insights.sql
-- ============================================================================
-- FICONTER Phase 2 · AI Insights
-- Adds privacy-first, user-controlled AI insight preferences and cached reports.
-- Reuses existing Wealth Engine aggregate functions. No raw transaction rows are exposed.

create extension if not exists "pgcrypto";

create table if not exists public.ai_insight_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_fingerprint text not null,
  report jsonb not null,
  model text not null,
  data_coverage integer not null default 0 check (data_coverage between 0 and 100),
  generated_at timestamptz not null default now(),
  constraint ai_insight_snapshots_report_object_check
    check (jsonb_typeof(report) = 'object')
);

create index if not exists ai_insight_snapshots_user_generated_idx
  on public.ai_insight_snapshots (user_id, generated_at desc);

create index if not exists ai_insight_snapshots_user_fingerprint_idx
  on public.ai_insight_snapshots (user_id, data_fingerprint, generated_at desc);

alter table public.ai_insight_preferences enable row level security;
alter table public.ai_insight_snapshots enable row level security;

grant select, insert, update, delete
  on public.ai_insight_preferences
  to authenticated;

grant select, insert, delete
  on public.ai_insight_snapshots
  to authenticated;

drop policy if exists "Users can read their AI insight preference"
  on public.ai_insight_preferences;
create policy "Users can read their AI insight preference"
  on public.ai_insight_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their AI insight preference"
  on public.ai_insight_preferences;
create policy "Users can create their AI insight preference"
  on public.ai_insight_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their AI insight preference"
  on public.ai_insight_preferences;
create policy "Users can update their AI insight preference"
  on public.ai_insight_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their AI insight preference"
  on public.ai_insight_preferences;
create policy "Users can delete their AI insight preference"
  on public.ai_insight_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their AI insight snapshots"
  on public.ai_insight_snapshots;
create policy "Users can read their AI insight snapshots"
  on public.ai_insight_snapshots
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their AI insight snapshots"
  on public.ai_insight_snapshots;
create policy "Users can create their AI insight snapshots"
  on public.ai_insight_snapshots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their AI insight snapshots"
  on public.ai_insight_snapshots;
create policy "Users can delete their AI insight snapshots"
  on public.ai_insight_snapshots
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.get_ai_insights_inputs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cash_flow jsonb;
  v_financial_independence jsonb;
  v_preferences jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  -- These two aggregate functions already compose every Phase 2 source of truth.
  v_cash_flow := public.get_cash_flow_intelligence_inputs_v2();
  v_financial_independence := public.get_financial_independence_inputs();

  select jsonb_build_object(
    'enabled', preferences.enabled,
    'consentVersion', preferences.consent_version,
    'consentedAt', preferences.consented_at,
    'updatedAt', preferences.updated_at
  )
  into v_preferences
  from public.ai_insight_preferences preferences
  where preferences.user_id = v_user_id;

  if v_preferences is null then
    v_preferences := jsonb_build_object(
      'enabled', false,
      'consentVersion', null,
      'consentedAt', null,
      'updatedAt', null
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'cashFlow', v_cash_flow,
    'financialIndependence', v_financial_independence,
    'preferences', v_preferences
  );
end;
$$;

revoke all on function public.get_ai_insights_inputs() from public, anon;
grant execute on function public.get_ai_insights_inputs() to authenticated;

comment on table public.ai_insight_preferences is
  'Private per-user consent and enablement settings for on-demand FICONTER AI Insights.';

comment on table public.ai_insight_snapshots is
  'Private per-user cached AI insight reports. Raw financial input payloads are not stored.';

comment on function public.get_ai_insights_inputs() is
  'Returns privacy-scoped aggregate inputs for AI Insights by composing existing Wealth Engine sources of truth.';

commit;

notify pgrst, 'reload schema';
