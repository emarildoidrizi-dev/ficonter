-- FICONTER · Cash Flow one-calendar-month commitment alignment v2
-- Production migration: run once in Supabase SQL Editor.
--
-- Purpose
-- Adds a versioned Cash Flow RPC with an inclusive one-calendar-month
-- window. The existing v1 RPC remains untouched for production rollback safety. A bill due on 31 August is therefore included when the calculation
-- runs on 31 July. The Cash Flow and Bills modules now use the same planning
-- boundary for upcoming commitments.

begin;

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

commit;

notify pgrst, 'reload schema';
