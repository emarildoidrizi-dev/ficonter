begin;

alter table public.monthly_budget_plans
  alter column start_balance drop default,
  alter column spending_budget drop default;

create or replace function public.enforce_monthly_budget_plan_e2ee()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
    raise exception 'Monthly Planner plans must be stored as encrypted v1 records.' using errcode='23514';
  end if;
  new.start_balance := null;
  new.spending_budget := null;
  return new;
end;
$$;

drop trigger if exists monthly_budget_plans_e2ee_guard on public.monthly_budget_plans;
create trigger monthly_budget_plans_e2ee_guard
before insert or update on public.monthly_budget_plans
for each row execute function public.enforce_monthly_budget_plan_e2ee();

create or replace function public.enforce_monthly_budget_item_e2ee()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
    raise exception 'Monthly Planner items must be stored as encrypted v1 records.' using errcode='23514';
  end if;
  new.section := null;
  new.label := null;
  new.planned_amount := null;
  return new;
end;
$$;

drop trigger if exists monthly_budget_items_e2ee_guard on public.monthly_budget_items;
create trigger monthly_budget_items_e2ee_guard
before insert or update on public.monthly_budget_items
for each row execute function public.enforce_monthly_budget_item_e2ee();

alter table public.monthly_budget_plans
  drop constraint if exists monthly_budget_plans_e2ee_required,
  add constraint monthly_budget_plans_e2ee_required check (
    encryption_version = 1 and encrypted_payload is not null and
    start_balance is null and spending_budget is null
  );

alter table public.monthly_budget_items
  drop constraint if exists monthly_budget_items_e2ee_required,
  add constraint monthly_budget_items_e2ee_required check (
    encryption_version = 1 and encrypted_payload is not null and
    section is null and label is null and planned_amount is null
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='monthly_budget_plans'
  ) then
    alter publication supabase_realtime add table public.monthly_budget_plans;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='monthly_budget_items'
  ) then
    alter publication supabase_realtime add table public.monthly_budget_items;
  end if;
end;
$$;

commit;
