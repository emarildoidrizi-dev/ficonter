begin;

alter table public.monthly_budget_plans
  alter column start_balance drop not null,
  alter column spending_budget drop not null;

alter table public.monthly_budget_items
  alter column section drop not null,
  alter column label drop not null,
  alter column planned_amount drop not null;

alter table public.monthly_budget_plans
  drop constraint if exists monthly_budget_plans_spending_budget_check;
alter table public.monthly_budget_plans
  add constraint monthly_budget_plans_spending_budget_check check (encryption_version = 1 or spending_budget >= 0);

alter table public.monthly_budget_items
  drop constraint if exists monthly_budget_items_label_check,
  drop constraint if exists monthly_budget_items_planned_amount_check,
  drop constraint if exists monthly_budget_items_section_check;
alter table public.monthly_budget_items
  add constraint monthly_budget_items_label_check check (encryption_version = 1 or (char_length(label) between 1 and 120)),
  add constraint monthly_budget_items_planned_amount_check check (encryption_version = 1 or planned_amount >= 0),
  add constraint monthly_budget_items_section_check check (encryption_version = 1 or section = any(array['income'::text,'bills'::text,'expenses'::text,'savings'::text,'debt'::text]));

create or replace function public.save_monthly_budget_plan_e2ee_atomic(
  p_plan_id uuid,
  p_month text,
  p_expected_revision bigint,
  p_encrypted_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.monthly_budget_plans%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid planner month.' using errcode='22023'; end if;
  if p_encrypted_payload is null then raise exception 'Encrypted Monthly Planner payload is required.' using errcode='22023'; end if;

  select p.* into v_plan from public.monthly_budget_plans p
  where p.user_id=v_user_id and p.month=p_month for update;

  if found then
    if p_expected_revision < 0 or v_plan.e2ee_revision<>p_expected_revision then
      raise exception 'Monthly Planner changed before it could be saved.' using errcode='40001';
    end if;
    update public.monthly_budget_plans
    set encrypted_payload=p_encrypted_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,
        start_balance=null,spending_budget=null,updated_at=now()
    where id=v_plan.id and user_id=v_user_id;
    return jsonb_build_object('id',v_plan.id,'month',p_month,'revision',p_expected_revision+1);
  end if;

  if p_expected_revision <> -1 then
    raise exception 'Monthly Planner row changed before it could be created.' using errcode='40001';
  end if;

  insert into public.monthly_budget_plans(
    id,user_id,month,start_balance,spending_budget,encrypted_payload,encryption_version,e2ee_revision
  ) values (
    p_plan_id,v_user_id,p_month,null,null,p_encrypted_payload,1,0
  );
  return jsonb_build_object('id',p_plan_id,'month',p_month,'revision',0);
end;
$$;

revoke all on function public.save_monthly_budget_plan_e2ee_atomic(uuid,text,bigint,jsonb) from public,anon;
grant execute on function public.save_monthly_budget_plan_e2ee_atomic(uuid,text,bigint,jsonb) to authenticated;

commit;
