create or replace function public.enforce_manual_debt_payment_confirmation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Legacy manual-confirmation behavior must not disable encrypted standard Debt.
  if coalesce(new.debt_kind, 'standard') = 'standard'
     and new.encryption_version = 1
     and new.encrypted_payload is not null then
    return new;
  end if;

  if lower(coalesce(new.category, '')) <> 'credit card' then
    new.autopay := false;
    new.autopay_enabled_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.process_automatic_encrypted_debts()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, cron, pg_catalog, pg_temp
as $$
declare
  v_debt public.debts%rowtype;
  v_local_date date;
  v_enabled_local_date date;
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
    v_enabled_local_date := (v_debt.autopay_enabled_at at time zone public.ficonter_safe_timezone(v_debt.autopay_timezone))::date;
    v_due_date := public.ficonter_debt_due_date(v_local_date, v_debt.payment_due_day);
    v_scheduled := public.ficonter_scheduled_timestamp(v_due_date, v_debt.autopay_record_time, v_debt.autopay_timezone);
    v_occurrence_key := to_char(v_due_date,'YYYY-MM');

    if v_scheduled <= now()
       and v_due_date >= v_enabled_local_date
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

update public.debts
set autopay = true,
    autopay_enabled_at = coalesce(autopay_enabled_at, now()),
    updated_at = now()
where debt_kind = 'standard'
  and encryption_version = 1
  and encrypted_payload is not null
  and status = 'active'
  and payment_due_day is not null
  and (autopay is distinct from true or autopay_enabled_at is null);
