-- FICONTER Phase 2 · Financial Health Score inputs
-- Run once in Supabase SQL Editor before deploying the application files.

begin;

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
      count(
        distinct to_char(
          coalesce(occurred_at, transaction_date::timestamptz),
          'YYYY-MM'
        )
      )::integer as active_months,
      (
        count(
          distinct to_char(
            coalesce(occurred_at, transaction_date::timestamptz),
            'YYYY-MM'
          )
        ) filter (where type = 'income')
      )::integer as income_months,
      coalesce(
        sum(amount_eur) filter (
          where type in ('expense', 'saving')
            and date_trunc(
              'month',
              coalesce(occurred_at, transaction_date::timestamptz)
            ) = date_trunc('month', now())
        ),
        0
      )::numeric as current_month_outflow
    from public.transactions
    where user_id = v_user_id
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
      )::numeric as pending_amount
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
      'currentMonthOutflow', transaction_metrics.current_month_outflow
    ),
    'bills', jsonb_build_object(
      'count', bill_metrics.bill_count,
      'pendingCount', bill_metrics.pending_count,
      'overdueCount', bill_metrics.overdue_count,
      'paidCount', bill_metrics.paid_count,
      'paidOnTimeCount', bill_metrics.paid_on_time_count,
      'dueNext30DaysCount', bill_metrics.due_next_30_days_count,
      'pendingAmount', bill_metrics.pending_amount
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

commit;

notify pgrst, 'reload schema';
