-- FICONTER Phase 2 · AI Insights
-- Adds privacy-first, user-controlled AI insight preferences and cached reports.
-- Reuses existing Wealth Engine aggregate functions. No raw transaction rows are exposed.

begin;

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
