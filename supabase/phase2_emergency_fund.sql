-- FICONTER Phase 2 · Emergency Fund Intelligence inputs
-- Run once in Supabase SQL Editor after phase2_financial_health_engine.sql.
-- Core income, expense, savings and reserve totals are inherited from
-- get_financial_health_inputs(); this function adds contribution history only.

begin;

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
  monthly_contributions as (
    select
      date_trunc(
        'month',
        coalesce(occurred_at, transaction_date::timestamptz)
      )::date as month_start,
      count(*)::integer as contribution_count,
      coalesce(sum(amount_eur), 0)::numeric as contribution
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and lower(trim(category)) = 'emergency fund'
      and date_trunc(
        'month',
        coalesce(occurred_at, transaction_date::timestamptz)
      ) >= date_trunc('month', current_date) - interval '11 months'
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
      and lower(trim(category)) = 'emergency fund'
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
  'Returns privacy-scoped Emergency Fund Intelligence inputs for the authenticated user, reusing the existing Financial Health source of truth.';

commit;

notify pgrst, 'reload schema';
