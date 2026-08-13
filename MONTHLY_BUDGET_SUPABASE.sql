-- Run this once in Supabase Dashboard -> SQL Editor before testing the update.
-- The amount is stored in FICONTER's canonical EUR format and displayed in
-- the customer's selected base currency.

alter table public.monthly_budget_plans
  add column if not exists spending_budget numeric(14,2) not null default 0;

alter table public.monthly_budget_plans
  drop constraint if exists monthly_budget_plans_spending_budget_check;

alter table public.monthly_budget_plans
  add constraint monthly_budget_plans_spending_budget_check
  check (spending_budget >= 0);

comment on column public.monthly_budget_plans.spending_budget is
  'Canonical EUR monthly spending limit used by Monthly Planner and Overview.';

notify pgrst, 'reload schema';
