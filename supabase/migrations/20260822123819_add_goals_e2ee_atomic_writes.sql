begin;

alter table public.goals
  alter column name drop not null,
  alter column target_amount drop not null,
  alter column current_amount drop not null,
  alter column status drop not null;

alter table public.goal_investments
  alter column amount drop not null;

alter table public.goals
  drop constraint if exists goals_name_check,
  drop constraint if exists goals_target_amount_check,
  drop constraint if exists goals_current_amount_check,
  drop constraint if exists goals_status_check;

alter table public.goals
  add constraint goals_name_check check (encryption_version = 1 or (char_length(btrim(name)) between 1 and 120)),
  add constraint goals_target_amount_check check (encryption_version = 1 or target_amount > 0),
  add constraint goals_current_amount_check check (encryption_version = 1 or current_amount >= 0),
  add constraint goals_status_check check (encryption_version = 1 or status = any(array['active'::text,'completed'::text,'paused'::text]));

alter table public.goal_investments
  drop constraint if exists goal_investments_amount_check;

alter table public.goal_investments
  add constraint goal_investments_amount_check check (encryption_version = 1 or amount > 0);

create or replace function public.record_goal_investment_e2ee_atomic(
  p_goal_id uuid,
  p_expected_revision bigint,
  p_new_goal_payload jsonb,
  p_investment_id uuid,
  p_investment_payload jsonb,
  p_invested_at timestamptz,
  p_transaction_id uuid,
  p_transaction_payload text
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_new_goal_payload is null or p_investment_payload is null or nullif(btrim(p_transaction_payload),'') is null then
    raise exception 'Encrypted Goal payloads are required.' using errcode='22023';
  end if;

  select g.* into v_goal from public.goals g
  where g.id=p_goal_id and g.user_id=v_user_id for update;
  if not found then raise exception 'Goal not found.' using errcode='P0002'; end if;
  if v_goal.encryption_version<>1 or v_goal.encrypted_payload is null then raise exception 'Goal must be encrypted first.' using errcode='P0001'; end if;
  if v_goal.e2ee_revision<>p_expected_revision then raise exception 'Goal changed before investment could be committed.' using errcode='40001'; end if;

  insert into public.transactions(id,user_id,encrypted_payload,encryption_version)
  values (p_transaction_id,v_user_id,p_transaction_payload,1);

  insert into public.goal_investments(
    id,goal_id,user_id,amount,invested_at,notes,transaction_id,original_amount,currency,exchange_rate_to_eur,exchange_rate_date,encrypted_payload,encryption_version,e2ee_revision
  ) values (
    p_investment_id,p_goal_id,v_user_id,null,coalesce(p_invested_at,now()),null,p_transaction_id,null,null,null,null,p_investment_payload,1,0
  );

  update public.goals
  set encrypted_payload=p_new_goal_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,
      name=null,target_amount=null,current_amount=null,target_date=null,status=null,updated_at=now()
  where id=p_goal_id and user_id=v_user_id;

  return jsonb_build_object('goal_id',p_goal_id,'investment_id',p_investment_id,'transaction_id',p_transaction_id,'revision',p_expected_revision+1);
end;
$$;

create or replace function public.reverse_goal_investment_e2ee_atomic(
  p_investment_id uuid,
  p_expected_revision bigint,
  p_restored_goal_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_investment public.goal_investments%rowtype;
  v_goal public.goals%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_restored_goal_payload is null then raise exception 'Encrypted restored Goal payload is required.' using errcode='22023'; end if;

  select i.* into v_investment from public.goal_investments i
  where i.id=p_investment_id and i.user_id=v_user_id for update;
  if not found then raise exception 'Investment not found.' using errcode='P0002'; end if;

  select g.* into v_goal from public.goals g
  where g.id=v_investment.goal_id and g.user_id=v_user_id for update;
  if not found then raise exception 'Goal not found.' using errcode='P0002'; end if;
  if v_goal.e2ee_revision<>p_expected_revision then raise exception 'Goal changed before investment reversal could be committed.' using errcode='40001'; end if;

  if v_investment.transaction_id is not null then
    delete from public.transactions where id=v_investment.transaction_id and user_id=v_user_id;
  end if;
  delete from public.goal_investments where id=p_investment_id and user_id=v_user_id;

  update public.goals
  set encrypted_payload=p_restored_goal_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,
      name=null,target_amount=null,current_amount=null,target_date=null,status=null,updated_at=now()
  where id=v_goal.id and user_id=v_user_id;

  return jsonb_build_object('goal_id',v_goal.id,'investment_id',p_investment_id,'transaction_id',v_investment.transaction_id,'revision',p_expected_revision+1);
end;
$$;

revoke all on function public.record_goal_investment_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,timestamptz,uuid,text) from public,anon;
revoke all on function public.reverse_goal_investment_e2ee_atomic(uuid,bigint,jsonb) from public,anon;
grant execute on function public.record_goal_investment_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,timestamptz,uuid,text) to authenticated;
grant execute on function public.reverse_goal_investment_e2ee_atomic(uuid,bigint,jsonb) to authenticated;

commit;
