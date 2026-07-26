-- FICONTER Phase 2 · Financial Independence
-- Reuses Net Worth Growth, Savings Intelligence and Emergency Fund inputs.
-- Creates only private planning assumptions; no duplicate balances are stored.

begin;

create table if not exists public.financial_independence_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_monthly_spending numeric(14, 2),
  withdrawal_rate numeric(5, 2) not null default 4.00,
  annual_real_return_rate numeric(5, 2) not null default 4.00,
  updated_at timestamptz not null default now(),
  constraint financial_independence_target_spending_check
    check (target_monthly_spending is null or target_monthly_spending >= 0),
  constraint financial_independence_withdrawal_rate_check
    check (withdrawal_rate between 2.00 and 8.00),
  constraint financial_independence_real_return_rate_check
    check (annual_real_return_rate between -2.00 and 12.00)
);

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

commit;

notify pgrst, 'reload schema';
