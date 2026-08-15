-- Dedicated monthly spending limit shared by the planner and live overview.
-- Values use FICONTER's canonical EUR storage convention and are converted to
-- the customer's selected base currency at the UI boundary.

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
