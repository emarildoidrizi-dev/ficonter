-- FICONTER Phase 2 · Savings Intelligence inputs
-- Run once in Supabase SQL Editor after phase2_cash_flow_intelligence.sql.
-- Core savings totals, rates and monthly history are inherited from
-- get_cash_flow_intelligence_inputs(); this function adds allocation and
-- recent-contribution intelligence only.

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

  with saving_rows as (
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
    order by coalesce(occurred_at, transaction_date::timestamptz, created_at) desc
    limit 10
  ),
  saving_stats as (
    select
      count(*)::integer as contribution_count,
      min(coalesce(occurred_at, transaction_date::timestamptz, created_at)) as first_contribution_at,
      max(coalesce(occurred_at, transaction_date::timestamptz, created_at)) as last_contribution_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'cashFlow', v_cash_flow,
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
  'Returns privacy-scoped Savings Intelligence inputs for the authenticated user, reusing the existing Cash Flow and Financial Health sources of truth.';

commit;

notify pgrst, 'reload schema';
