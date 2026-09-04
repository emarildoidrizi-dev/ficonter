-- FICONTER portable customer backup restore v2
-- Restores client-side re-encrypted financial records into a fresh authenticated account.
-- The function never accepts or restores authentication, subscription, admin, support,
-- analytics, vault-key, or billing state.

create or replace function public.restore_portable_backup_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid restore payload.' using errcode = '22023';
  end if;

  -- First release intentionally restores only into an empty financial workspace.
  -- This prevents accidental merges, duplicate histories, and ambiguous ownership.
  if exists (select 1 from public.transactions where user_id = v_user_id)
     or exists (select 1 from public.bills where user_id = v_user_id)
     or exists (select 1 from public.goals where user_id = v_user_id)
     or exists (select 1 from public.goal_investments where user_id = v_user_id)
     or exists (select 1 from public.debts where user_id = v_user_id)
     or exists (select 1 from public.debt_payments where user_id = v_user_id)
     or exists (select 1 from public.credit_card_activities where user_id = v_user_id)
     or exists (select 1 from public.credit_card_monthly_records where user_id = v_user_id)
     or exists (select 1 from public.monthly_budget_plans where user_id = v_user_id)
     or exists (select 1 from public.monthly_budget_items where user_id = v_user_id)
  then
    raise exception 'Restore requires an empty FICONTER financial workspace.' using errcode = '23505';
  end if;

  -- TRANSACTIONS ------------------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'transactions', '[]'::jsonb))
  loop
    insert into public.transactions (
      id, user_id, encrypted_payload, encryption_version, created_at
    ) values (
      (v_row->>'id')::uuid,
      v_user_id,
      v_row->>'encrypted_payload',
      1,
      coalesce((v_row->>'created_at')::timestamptz, now())
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('transactions', v_count);

  -- GOALS -------------------------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'goals', '[]'::jsonb))
  loop
    insert into public.goals (
      id, user_id, name, target_amount, current_amount, target_date, status,
      created_at, updated_at, encrypted_payload, encryption_version, e2ee_revision
    ) values (
      (v_row->>'id')::uuid, v_user_id,
      null, null, null, null, null,
      coalesce((v_row->>'created_at')::timestamptz, now()),
      coalesce((v_row->>'updated_at')::timestamptz, now()),
      (v_row->'encrypted_payload'), 1, 0
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('goals', v_count);

  -- DEBTS / CREDIT CARDS ----------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'debts', '[]'::jsonb))
  loop
    insert into public.debts (
      id, user_id,
      name, lender, description, category,
      original_balance, current_balance, currency,
      original_balance_eur, current_balance_eur, exchange_rate_to_eur,
      annual_interest_rate, minimum_payment, minimum_payment_eur,
      payment_due_day, start_date, maturity_date, status,
      created_at, updated_at,
      autopay, autopay_record_time, autopay_timezone, autopay_enabled_at,
      card_last_four, credit_limit, credit_limit_eur,
      statement_balance, statement_balance_eur, statement_date, payment_due_date,
      interest_charged, interest_charged_eur,
      encrypted_payload, encryption_version, e2ee_revision, debt_kind
    ) values (
      (v_row->>'id')::uuid, v_user_id,
      null, null, null, null,
      null, null, null,
      null, null, null,
      null, null, null,
      case when nullif(v_row->>'payment_due_day','') is null then null else (v_row->>'payment_due_day')::integer end,
      nullif(v_row->>'start_date','')::date,
      nullif(v_row->>'maturity_date','')::date,
      coalesce(nullif(v_row->>'status',''), 'active'),
      coalesce((v_row->>'created_at')::timestamptz, now()),
      coalesce((v_row->>'updated_at')::timestamptz, now()),
      coalesce((v_row->>'autopay')::boolean, false),
      coalesce(nullif(v_row->>'autopay_record_time','')::time, '09:00:00'::time),
      coalesce(nullif(v_row->>'autopay_timezone',''), 'UTC'),
      nullif(v_row->>'autopay_enabled_at','')::timestamptz,
      null, null, null,
      null, null,
      nullif(v_row->>'statement_date','')::date,
      nullif(v_row->>'payment_due_date','')::date,
      null, null,
      (v_row->'encrypted_payload'), 1, 0,
      case when v_row->>'debt_kind' = 'credit_card' then 'credit_card' else 'standard' end
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('debts', v_count);

  -- BILLS -------------------------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'bills', '[]'::jsonb))
  loop
    insert into public.bills (
      id, user_id,
      name, company, category, amount, currency, amount_eur, exchange_rate_to_eur,
      due_date, recurrence, payment_method, autopay, reminder_days, status, notes,
      paid_at, transaction_id, created_at, updated_at,
      autopay_record_time, autopay_timezone, autopay_enabled_at,
      recurrence_anchor_day, recurrence_anchor_month_end,
      encrypted_payload, encryption_version
    ) values (
      (v_row->>'id')::uuid, v_user_id,
      null, null, null, null, null, null, null,
      (v_row->>'due_date')::date,
      coalesce(nullif(v_row->>'recurrence',''), 'none'),
      null,
      coalesce((v_row->>'autopay')::boolean, false),
      coalesce((v_row->>'reminder_days')::integer, 3),
      coalesce(nullif(v_row->>'status',''), 'pending'),
      null,
      nullif(v_row->>'paid_at','')::timestamptz,
      nullif(v_row->>'transaction_id','')::uuid,
      coalesce((v_row->>'created_at')::timestamptz, now()),
      coalesce((v_row->>'updated_at')::timestamptz, now()),
      coalesce(nullif(v_row->>'autopay_record_time','')::time, '09:00:00'::time),
      coalesce(nullif(v_row->>'autopay_timezone',''), 'UTC'),
      nullif(v_row->>'autopay_enabled_at','')::timestamptz,
      case when nullif(v_row->>'recurrence_anchor_day','') is null then null else (v_row->>'recurrence_anchor_day')::smallint end,
      coalesce((v_row->>'recurrence_anchor_month_end')::boolean, false),
      (v_row->'encrypted_payload'), 1
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('bills', v_count);

  -- GOAL INVESTMENTS --------------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'goal_investments', '[]'::jsonb))
  loop
    insert into public.goal_investments (
      id, goal_id, user_id,
      amount, invested_at, notes, transaction_id, created_at,
      original_amount, currency, exchange_rate_to_eur, exchange_rate_date,
      encrypted_payload, encryption_version, e2ee_revision
    ) values (
      (v_row->>'id')::uuid,
      (v_row->>'goal_id')::uuid,
      v_user_id,
      null,
      (v_row->>'invested_at')::timestamptz,
      null,
      (v_row->>'transaction_id')::uuid,
      coalesce((v_row->>'created_at')::timestamptz, now()),
      null, null, null, null,
      (v_row->'encrypted_payload'), 1, 0
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('goal_investments', v_count);

  -- DEBT PAYMENTS -----------------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'debt_payments', '[]'::jsonb))
  loop
    insert into public.debt_payments (
      id, debt_id, user_id,
      amount, currency, amount_eur, exchange_rate_to_eur,
      paid_at, notes, transaction_id, created_at,
      encrypted_payload, encryption_version
    ) values (
      (v_row->>'id')::uuid,
      (v_row->>'debt_id')::uuid,
      v_user_id,
      null, null, null, null,
      (v_row->>'paid_at')::timestamptz,
      null,
      nullif(v_row->>'transaction_id','')::uuid,
      coalesce((v_row->>'created_at')::timestamptz, now()),
      (v_row->'encrypted_payload'), 1
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('debt_payments', v_count);

  -- CREDIT CARD ACTIVITIES --------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'credit_card_activities', '[]'::jsonb))
  loop
    insert into public.credit_card_activities (
      id, debt_id, user_id,
      activity_type, description, amount, currency, amount_eur, exchange_rate_to_eur,
      balance_effect, balance_effect_eur, occurred_at, notes, created_at,
      encrypted_payload, encryption_version, e2ee_revision
    ) values (
      (v_row->>'id')::uuid,
      (v_row->>'debt_id')::uuid,
      v_user_id,
      null, null, null, null, null, null,
      null, null,
      (v_row->>'occurred_at')::timestamptz,
      null,
      coalesce((v_row->>'created_at')::timestamptz, now()),
      (v_row->'encrypted_payload'), 1, 0
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('credit_card_activities', v_count);

  -- CREDIT CARD MONTHLY RECORDS --------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'credit_card_monthly_records', '[]'::jsonb))
  loop
    insert into public.credit_card_monthly_records (
      id, debt_id, user_id, month_start,
      currency, statement_balance, statement_balance_eur,
      minimum_payment, minimum_payment_eur,
      interest_charged, interest_charged_eur,
      statement_date, payment_due_date,
      created_at, updated_at, encrypted_payload, encryption_version, e2ee_revision
    ) values (
      (v_row->>'id')::uuid,
      (v_row->>'debt_id')::uuid,
      v_user_id,
      (v_row->>'month_start')::date,
      null, null, null, null, null, null, null,
      (v_row->>'statement_date')::date,
      (v_row->>'payment_due_date')::date,
      coalesce((v_row->>'created_at')::timestamptz, now()),
      coalesce((v_row->>'updated_at')::timestamptz, now()),
      (v_row->'encrypted_payload'), 1, 0
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('credit_card_monthly_records', v_count);

  -- MONTHLY PLANS -----------------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'monthly_budget_plans', '[]'::jsonb))
  loop
    insert into public.monthly_budget_plans (
      id, user_id, month, start_balance, spending_budget,
      created_at, updated_at, encrypted_payload, encryption_version, e2ee_revision
    ) values (
      (v_row->>'id')::uuid, v_user_id, v_row->>'month',
      null, null,
      coalesce((v_row->>'created_at')::timestamptz, now()),
      coalesce((v_row->>'updated_at')::timestamptz, now()),
      (v_row->'encrypted_payload'), 1, 0
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('monthly_budget_plans', v_count);

  -- MONTHLY PLAN ITEMS ------------------------------------------------------
  v_count := 0;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload->'monthly_budget_items', '[]'::jsonb))
  loop
    insert into public.monthly_budget_items (
      id, user_id, month, section, label, planned_amount, position,
      created_at, updated_at, encrypted_payload, encryption_version, e2ee_revision
    ) values (
      (v_row->>'id')::uuid, v_user_id, v_row->>'month',
      null, null, null,
      coalesce((v_row->>'position')::integer, 0),
      coalesce((v_row->>'created_at')::timestamptz, now()),
      coalesce((v_row->>'updated_at')::timestamptz, now()),
      (v_row->'encrypted_payload'), 1, 0
    );
    v_count := v_count + 1;
  end loop;
  v_counts := v_counts || jsonb_build_object('monthly_budget_items', v_count);

  return jsonb_build_object(
    'ok', true,
    'restored_for_user', v_user_id,
    'counts', v_counts
  );
end;
$$;

revoke all on function public.restore_portable_backup_v2(jsonb) from public;
revoke all on function public.restore_portable_backup_v2(jsonb) from anon;
grant execute on function public.restore_portable_backup_v2(jsonb) to authenticated;

comment on function public.restore_portable_backup_v2(jsonb) is
'Atomically restores a FICONTER v2 portable backup after client-side re-encryption to the currently authenticated user. Requires an empty target financial workspace.';
