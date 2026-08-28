alter table public.automatic_payment_runs drop constraint if exists automatic_payment_runs_status_check;
alter table public.automatic_payment_runs add constraint automatic_payment_runs_status_check check (status = any (array['pending'::text,'completed'::text,'failed'::text]));

alter table public.automatic_payment_runs drop constraint if exists automatic_payment_runs_debt_ciphertext_privacy_check;
alter table public.automatic_payment_runs add constraint automatic_payment_runs_debt_ciphertext_privacy_check check (source_type <> 'debt' or (amount is null and currency is null and amount_eur is null));

create or replace function public.process_automatic_encrypted_debts()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, cron, pg_catalog, pg_temp
as $$
declare
  v_debt public.debts%rowtype;
  v_local_date date;
  v_due_date date;
  v_scheduled timestamptz;
  v_occurrence_key text;
  v_pending integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('ficonter:e2ee-debt-scheduler',0)) then
    return jsonb_build_object('status','already_running','pending_created',0);
  end if;

  for v_debt in
    select d.*
    from public.debts d
    where d.debt_kind = 'standard'
      and d.encryption_version = 1
      and d.encrypted_payload is not null
      and d.autopay = true
      and d.autopay_enabled_at is not null
      and d.status = 'active'
      and d.payment_due_day is not null
  loop
    v_local_date := (now() at time zone public.ficonter_safe_timezone(v_debt.autopay_timezone))::date;
    v_due_date := public.ficonter_debt_due_date(v_local_date, v_debt.payment_due_day);
    v_scheduled := public.ficonter_scheduled_timestamp(v_due_date, v_debt.autopay_record_time, v_debt.autopay_timezone);
    v_occurrence_key := to_char(v_due_date,'YYYY-MM');

    if v_scheduled <= now()
       and v_scheduled >= v_debt.autopay_enabled_at
       and (v_debt.start_date is null or v_due_date >= v_debt.start_date)
       and (v_debt.maturity_date is null or v_due_date <= v_debt.maturity_date) then
      insert into public.automatic_payment_runs(
        user_id,source_type,source_id,occurrence_key,scheduled_for,
        amount,currency,amount_eur,transaction_id,debt_payment_id,
        trigger_mode,status,error_message,processed_at
      ) values (
        v_debt.user_id,'debt',v_debt.id,v_occurrence_key,v_scheduled,
        null,null,null,null,null,'automatic','pending',null,now()
      )
      on conflict (source_type,source_id,occurrence_key) do nothing;
      if found then v_pending := v_pending + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('status','completed','pending_created',v_pending,'processed_at',now());
end;
$$;

create or replace function public.record_automatic_debt_payment_e2ee_atomic(
  p_run_id uuid,
  p_expected_revision bigint,
  p_new_debt_payload jsonb,
  p_new_status text,
  p_payment_id uuid,
  p_payment_payload jsonb,
  p_transaction_id uuid,
  p_transaction_payload text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.automatic_payment_runs%rowtype;
  v_debt public.debts%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_new_debt_payload is null or p_payment_payload is null or nullif(btrim(p_transaction_payload),'') is null then
    raise exception 'Encrypted payment payloads are required.' using errcode='22023';
  end if;
  if p_new_status not in ('active','paused','paid_off') then raise exception 'Invalid Debt status.' using errcode='22023'; end if;

  select r.* into v_run from public.automatic_payment_runs r
  where r.id=p_run_id and r.user_id=v_user_id for update;
  if not found then raise exception 'Automatic Debt occurrence not found.' using errcode='P0002'; end if;
  if v_run.source_type <> 'debt' or v_run.trigger_mode <> 'automatic' then raise exception 'Invalid automatic Debt occurrence.' using errcode='22023'; end if;
  if v_run.status = 'completed' then
    return jsonb_build_object('already_recorded',true,'debt_id',v_run.source_id,'payment_id',v_run.debt_payment_id,'transaction_id',v_run.transaction_id);
  end if;
  if v_run.status <> 'pending' or v_run.scheduled_for > now() then raise exception 'Automatic Debt occurrence is not ready.' using errcode='22023'; end if;

  select d.* into v_debt from public.debts d
  where d.id=v_run.source_id and d.user_id=v_user_id for update;
  if not found then raise exception 'Debt not found.' using errcode='P0002'; end if;
  if v_debt.debt_kind <> 'standard' or v_debt.encryption_version <> 1 or v_debt.encrypted_payload is null then raise exception 'Debt is not an encrypted standard Debt.' using errcode='P0001'; end if;
  if v_debt.e2ee_revision <> p_expected_revision then raise exception 'Debt changed before automatic payment could be committed. Refresh and try again.' using errcode='40001'; end if;

  insert into public.transactions(id,user_id,encrypted_payload,encryption_version)
  values(p_transaction_id,v_user_id,p_transaction_payload,1);

  insert into public.debt_payments(
    id,debt_id,user_id,amount,currency,amount_eur,exchange_rate_to_eur,
    paid_at,notes,transaction_id,encrypted_payload,encryption_version
  ) values(
    p_payment_id,v_debt.id,v_user_id,null,null,null,null,
    v_run.scheduled_for,null,p_transaction_id,p_payment_payload,1
  );

  update public.debts set
    encrypted_payload=p_new_debt_payload,
    encryption_version=1,
    status=p_new_status,
    e2ee_revision=e2ee_revision+1,
    updated_at=now()
  where id=v_debt.id and user_id=v_user_id;

  update public.automatic_payment_runs set
    status='completed',transaction_id=p_transaction_id,debt_payment_id=p_payment_id,
    amount=null,currency=null,amount_eur=null,error_message=null,processed_at=now()
  where id=v_run.id;

  return jsonb_build_object('already_recorded',false,'debt_id',v_debt.id,'payment_id',p_payment_id,'transaction_id',p_transaction_id,'revision',p_expected_revision+1);
end;
$$;

revoke all on function public.process_automatic_encrypted_debts() from public,anon,authenticated;
revoke all on function public.record_automatic_debt_payment_e2ee_atomic(uuid,bigint,jsonb,text,uuid,jsonb,uuid,text) from public,anon;
grant execute on function public.record_automatic_debt_payment_e2ee_atomic(uuid,bigint,jsonb,text,uuid,jsonb,uuid,text) to authenticated;

select cron.unschedule(jobid) from cron.job where command ilike '%process_automatic_encrypted_debts%';
select cron.schedule('ficonter-e2ee-debts','* * * * *','select public.process_automatic_encrypted_debts();');
