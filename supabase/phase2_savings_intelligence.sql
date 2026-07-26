-- FICONTER Phase 2 · Savings Intelligence inputs
-- Run in Supabase SQL Editor after phase2_cash_flow_intelligence.sql.
-- Emergency Fund contributions are intentionally excluded because they are
-- analyzed in the dedicated Emergency Fund module. Income, expenses and
-- affordability inputs continue to reuse the existing Cash Flow and Financial
-- Health sources of truth.

begin;

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

  v_cash_flow := public.get_cash_flow_intelligence_inputs();

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
      coalesce(occurred_at, transaction_date::timestamptz, created_at) as occurred_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and coalesce(lower(trim(category)), '') <> 'emergency fund'
  ),
  monthly_contributions as (
    select
      date_trunc('month', occurred_at)::date as month_start,
      count(*)::integer as contribution_count,
      coalesce(sum(amount), 0)::numeric as savings
    from saving_rows
    where date_trunc('month', occurred_at) >=
      date_trunc('month', current_date) - interval '11 months'
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

commit;

notify pgrst, 'reload schema';
