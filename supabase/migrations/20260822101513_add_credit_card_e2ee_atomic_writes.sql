begin;

alter table public.debts
  alter column interest_charged drop not null,
  alter column interest_charged_eur drop not null;

alter table public.credit_card_activities
  alter column activity_type drop not null,
  alter column description drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_eur drop not null,
  alter column exchange_rate_to_eur drop not null,
  alter column balance_effect drop not null,
  alter column balance_effect_eur drop not null;

alter table public.credit_card_monthly_records
  alter column currency drop not null,
  alter column statement_balance drop not null,
  alter column statement_balance_eur drop not null,
  alter column minimum_payment drop not null,
  alter column minimum_payment_eur drop not null,
  alter column interest_charged drop not null,
  alter column interest_charged_eur drop not null;

alter table public.credit_card_activities
  drop constraint if exists credit_card_activities_activity_type_check,
  drop constraint if exists credit_card_activities_amount_check,
  drop constraint if exists credit_card_activities_amount_eur_check,
  drop constraint if exists credit_card_activities_balance_effect_check,
  drop constraint if exists credit_card_activities_balance_effect_eur_check,
  drop constraint if exists credit_card_activities_currency_check,
  drop constraint if exists credit_card_activities_description_check,
  drop constraint if exists credit_card_activities_exchange_rate_to_eur_check;

alter table public.credit_card_activities
  add constraint credit_card_activities_activity_type_check check (encryption_version = 1 or activity_type = any (array['purchase','interest','fee','refund','adjustment_increase','adjustment_decrease','statement_adjustment'])),
  add constraint credit_card_activities_amount_check check (encryption_version = 1 or amount > 0),
  add constraint credit_card_activities_amount_eur_check check (encryption_version = 1 or amount_eur > 0),
  add constraint credit_card_activities_balance_effect_check check (encryption_version = 1 or balance_effect <> 0),
  add constraint credit_card_activities_balance_effect_eur_check check (encryption_version = 1 or balance_effect_eur <> 0),
  add constraint credit_card_activities_currency_check check (encryption_version = 1 or currency ~ '^[A-Z]{3}$'),
  add constraint credit_card_activities_description_check check (encryption_version = 1 or (char_length(btrim(description)) between 1 and 140)),
  add constraint credit_card_activities_exchange_rate_to_eur_check check (encryption_version = 1 or exchange_rate_to_eur > 0);

alter table public.credit_card_monthly_records
  drop constraint if exists credit_card_monthly_records_currency_check,
  drop constraint if exists credit_card_monthly_records_interest_charged_check,
  drop constraint if exists credit_card_monthly_records_interest_charged_eur_check,
  drop constraint if exists credit_card_monthly_records_minimum_check,
  drop constraint if exists credit_card_monthly_records_minimum_eur_check,
  drop constraint if exists credit_card_monthly_records_minimum_payment_check,
  drop constraint if exists credit_card_monthly_records_minimum_payment_eur_check,
  drop constraint if exists credit_card_monthly_records_statement_balance_check,
  drop constraint if exists credit_card_monthly_records_statement_balance_eur_check;

alter table public.credit_card_monthly_records
  add constraint credit_card_monthly_records_currency_check check (encryption_version = 1 or currency ~ '^[A-Z]{3}$'),
  add constraint credit_card_monthly_records_interest_charged_check check (encryption_version = 1 or interest_charged >= 0),
  add constraint credit_card_monthly_records_interest_charged_eur_check check (encryption_version = 1 or interest_charged_eur >= 0),
  add constraint credit_card_monthly_records_minimum_check check (encryption_version = 1 or minimum_payment <= statement_balance),
  add constraint credit_card_monthly_records_minimum_eur_check check (encryption_version = 1 or minimum_payment_eur <= statement_balance_eur),
  add constraint credit_card_monthly_records_minimum_payment_check check (encryption_version = 1 or minimum_payment >= 0),
  add constraint credit_card_monthly_records_minimum_payment_eur_check check (encryption_version = 1 or minimum_payment_eur >= 0),
  add constraint credit_card_monthly_records_statement_balance_check check (encryption_version = 1 or statement_balance >= 0),
  add constraint credit_card_monthly_records_statement_balance_eur_check check (encryption_version = 1 or statement_balance_eur >= 0);

create or replace function public.record_credit_card_activity_e2ee_atomic(
  p_debt_id uuid,
  p_expected_revision bigint,
  p_new_card_payload jsonb,
  p_activity_id uuid,
  p_activity_payload jsonb,
  p_occurred_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.debts%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_new_card_payload is null or p_activity_payload is null then raise exception 'Encrypted Credit Card payloads are required.' using errcode='22023'; end if;

  select d.* into v_card from public.debts d
  where d.id=p_debt_id and d.user_id=v_user_id and d.debt_kind='credit_card'
  for update;
  if not found then raise exception 'Credit card not found.' using errcode='P0002'; end if;
  if v_card.encryption_version<>1 or v_card.encrypted_payload is null then raise exception 'Credit card must be encrypted first.' using errcode='P0001'; end if;
  if v_card.e2ee_revision<>p_expected_revision then raise exception 'Credit card changed before activity could be committed.' using errcode='40001'; end if;

  insert into public.credit_card_activities(
    id,debt_id,user_id,activity_type,description,amount,currency,amount_eur,exchange_rate_to_eur,balance_effect,balance_effect_eur,occurred_at,notes,encrypted_payload,encryption_version,e2ee_revision
  ) values (
    p_activity_id,p_debt_id,v_user_id,null,null,null,null,null,null,null,null,coalesce(p_occurred_at,now()),null,p_activity_payload,1,0
  );

  update public.debts
  set encrypted_payload=p_new_card_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,status='active',updated_at=now()
  where id=p_debt_id and user_id=v_user_id;

  return jsonb_build_object('debt_id',p_debt_id,'activity_id',p_activity_id,'revision',p_expected_revision+1);
end;
$$;

create or replace function public.reverse_credit_card_activity_e2ee_atomic(
  p_activity_id uuid,
  p_expected_revision bigint,
  p_restored_card_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.credit_card_activities%rowtype;
  v_card public.debts%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_restored_card_payload is null then raise exception 'Encrypted restored card payload is required.' using errcode='22023'; end if;
  select a.* into v_activity from public.credit_card_activities a where a.id=p_activity_id and a.user_id=v_user_id for update;
  if not found then raise exception 'Credit-card activity not found.' using errcode='P0002'; end if;
  select d.* into v_card from public.debts d where d.id=v_activity.debt_id and d.user_id=v_user_id and d.debt_kind='credit_card' for update;
  if not found then raise exception 'Credit card not found.' using errcode='P0002'; end if;
  if v_card.e2ee_revision<>p_expected_revision then raise exception 'Credit card changed before activity reversal could be committed.' using errcode='40001'; end if;
  delete from public.credit_card_activities where id=p_activity_id and user_id=v_user_id;
  update public.debts set encrypted_payload=p_restored_card_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,status='active',updated_at=now() where id=v_card.id and user_id=v_user_id;
  return jsonb_build_object('debt_id',v_card.id,'activity_id',p_activity_id,'revision',p_expected_revision+1);
end;
$$;

create or replace function public.save_credit_card_monthly_record_e2ee_atomic(
  p_debt_id uuid,
  p_expected_revision bigint,
  p_record_id uuid,
  p_month_start date,
  p_statement_date date,
  p_payment_due_date date,
  p_record_payload jsonb,
  p_new_card_payload jsonb default null
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.debts%rowtype;
  v_revision bigint;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_record_payload is null then raise exception 'Encrypted monthly record payload is required.' using errcode='22023'; end if;
  if p_statement_date is null or p_payment_due_date is null or p_payment_due_date<p_statement_date then raise exception 'Invalid statement dates.' using errcode='22023'; end if;

  select d.* into v_card from public.debts d where d.id=p_debt_id and d.user_id=v_user_id and d.debt_kind='credit_card' for update;
  if not found then raise exception 'Credit card not found.' using errcode='P0002'; end if;
  if v_card.e2ee_revision<>p_expected_revision then raise exception 'Credit card changed before statement could be committed.' using errcode='40001'; end if;

  insert into public.credit_card_monthly_records(
    id,debt_id,user_id,month_start,currency,statement_balance,statement_balance_eur,minimum_payment,minimum_payment_eur,interest_charged,interest_charged_eur,statement_date,payment_due_date,encrypted_payload,encryption_version,e2ee_revision,updated_at
  ) values (
    p_record_id,p_debt_id,v_user_id,p_month_start,null,null,null,null,null,null,null,p_statement_date,p_payment_due_date,p_record_payload,1,0,now()
  )
  on conflict (debt_id,month_start) do update set
    statement_date=excluded.statement_date,
    payment_due_date=excluded.payment_due_date,
    encrypted_payload=excluded.encrypted_payload,
    encryption_version=1,
    e2ee_revision=credit_card_monthly_records.e2ee_revision+1,
    currency=null,statement_balance=null,statement_balance_eur=null,minimum_payment=null,minimum_payment_eur=null,interest_charged=null,interest_charged_eur=null,
    updated_at=now();

  v_revision := p_expected_revision;
  if p_new_card_payload is not null then
    update public.debts set encrypted_payload=p_new_card_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,statement_date=p_statement_date,payment_due_date=p_payment_due_date,payment_due_day=extract(day from p_payment_due_date)::integer,updated_at=now() where id=p_debt_id and user_id=v_user_id;
    v_revision := p_expected_revision+1;
  end if;

  return jsonb_build_object('debt_id',p_debt_id,'record_id',p_record_id,'revision',v_revision);
end;
$$;

create or replace function public.record_credit_card_payment_e2ee_atomic(
  p_debt_id uuid,
  p_expected_revision bigint,
  p_new_card_payload jsonb,
  p_payment_id uuid,
  p_payment_payload jsonb,
  p_transaction_id uuid,
  p_transaction_payload text,
  p_paid_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.debts%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_new_card_payload is null or p_payment_payload is null or nullif(btrim(p_transaction_payload),'') is null then raise exception 'Encrypted payment payloads are required.' using errcode='22023'; end if;
  select d.* into v_card from public.debts d where d.id=p_debt_id and d.user_id=v_user_id and d.debt_kind='credit_card' for update;
  if not found then raise exception 'Credit card not found.' using errcode='P0002'; end if;
  if v_card.e2ee_revision<>p_expected_revision then raise exception 'Credit card changed before payment could be committed.' using errcode='40001'; end if;

  insert into public.transactions(id,user_id,encrypted_payload,encryption_version) values (p_transaction_id,v_user_id,p_transaction_payload,1);
  insert into public.debt_payments(id,debt_id,user_id,amount,currency,amount_eur,exchange_rate_to_eur,paid_at,notes,transaction_id,encrypted_payload,encryption_version)
  values (p_payment_id,p_debt_id,v_user_id,null,null,null,null,p_paid_at,null,p_transaction_id,p_payment_payload,1);
  update public.debts set encrypted_payload=p_new_card_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,updated_at=now() where id=p_debt_id and user_id=v_user_id;
  return jsonb_build_object('debt_id',p_debt_id,'payment_id',p_payment_id,'transaction_id',p_transaction_id,'revision',p_expected_revision+1);
end;
$$;

create or replace function public.reverse_credit_card_payment_e2ee_atomic(
  p_payment_id uuid,
  p_expected_revision bigint,
  p_restored_card_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.debt_payments%rowtype;
  v_card public.debts%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_restored_card_payload is null then raise exception 'Encrypted restored card payload is required.' using errcode='22023'; end if;
  select p.* into v_payment from public.debt_payments p where p.id=p_payment_id and p.user_id=v_user_id for update;
  if not found then raise exception 'Payment not found.' using errcode='P0002'; end if;
  select d.* into v_card from public.debts d where d.id=v_payment.debt_id and d.user_id=v_user_id and d.debt_kind='credit_card' for update;
  if not found then raise exception 'Credit card not found.' using errcode='P0002'; end if;
  if v_card.e2ee_revision<>p_expected_revision then raise exception 'Credit card changed before payment reversal could be committed.' using errcode='40001'; end if;
  if v_payment.transaction_id is not null then delete from public.transactions where id=v_payment.transaction_id and user_id=v_user_id; end if;
  delete from public.debt_payments where id=p_payment_id and user_id=v_user_id;
  update public.debts set encrypted_payload=p_restored_card_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,status='active',updated_at=now() where id=v_card.id and user_id=v_user_id;
  return jsonb_build_object('debt_id',v_card.id,'payment_id',p_payment_id,'transaction_id',v_payment.transaction_id,'revision',p_expected_revision+1);
end;
$$;

revoke all on function public.record_credit_card_activity_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,timestamptz) from public,anon;
revoke all on function public.reverse_credit_card_activity_e2ee_atomic(uuid,bigint,jsonb) from public,anon;
revoke all on function public.save_credit_card_monthly_record_e2ee_atomic(uuid,bigint,uuid,date,date,date,jsonb,jsonb) from public,anon;
revoke all on function public.record_credit_card_payment_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,uuid,text,timestamptz) from public,anon;
revoke all on function public.reverse_credit_card_payment_e2ee_atomic(uuid,bigint,jsonb) from public,anon;
grant execute on function public.record_credit_card_activity_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,timestamptz) to authenticated;
grant execute on function public.reverse_credit_card_activity_e2ee_atomic(uuid,bigint,jsonb) to authenticated;
grant execute on function public.save_credit_card_monthly_record_e2ee_atomic(uuid,bigint,uuid,date,date,date,jsonb,jsonb) to authenticated;
grant execute on function public.record_credit_card_payment_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,uuid,text,timestamptz) to authenticated;
grant execute on function public.reverse_credit_card_payment_e2ee_atomic(uuid,bigint,jsonb) to authenticated;

commit;
