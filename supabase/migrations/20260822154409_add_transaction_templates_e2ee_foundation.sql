begin;

alter table public.transaction_templates
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.transaction_templates
  alter column label drop not null,
  alter column description drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column type drop not null,
  alter column category drop not null;

create or replace function public.ficonter_enforce_transaction_template_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
    raise exception 'Transaction template must be stored as encrypted v1 ciphertext.' using errcode = '23514';
  end if;

  new.label := null;
  new.description := null;
  new.amount := null;
  new.currency := null;
  new.amount_eur := null;
  new.exchange_rate_to_eur := null;
  new.exchange_rate_date := null;
  new.exchange_rate_source := null;
  new.type := null;
  new.category := null;
  return new;
end;
$$;

drop trigger if exists transaction_templates_enforce_ciphertext_only on public.transaction_templates;
create trigger transaction_templates_enforce_ciphertext_only
before insert or update on public.transaction_templates
for each row execute function public.ficonter_enforce_transaction_template_ciphertext_only();

create or replace function public.post_monthly_transaction_template_e2ee_atomic(
  p_template_id uuid,
  p_period_key date,
  p_transaction_id uuid,
  p_transaction_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_template public.transaction_templates%rowtype;
  v_period date := date_trunc('month', coalesce(p_period_key, current_date))::date;
  v_last_day integer;
  v_transaction_date date;
  v_existing_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_transaction_id is null or p_transaction_payload is null then
    raise exception 'Encrypted recurring transaction payload is required.' using errcode = '22023';
  end if;

  select * into v_template
  from public.transaction_templates
  where id = p_template_id
    and user_id = v_user_id
    and is_active = true
    and is_recurring = true
    and encryption_version = 1
    and encrypted_payload is not null
  for update;

  if not found then
    raise exception 'The recurring entry could not be found.' using errcode = 'P0002';
  end if;

  select transaction_id into v_existing_transaction_id
  from public.transaction_template_postings
  where template_id = v_template.id
    and user_id = v_user_id
    and period_key = v_period;

  if v_existing_transaction_id is not null then
    return jsonb_build_object('id', v_existing_transaction_id, 'existing', true);
  end if;

  if v_template.day_of_month is null then
    raise exception 'The recurring entry day is not configured.' using errcode = '22023';
  end if;

  v_last_day := extract(day from (v_period + interval '1 month - 1 day'))::integer;
  v_transaction_date := v_period + (least(v_template.day_of_month, v_last_day) - 1);

  insert into public.transactions (
    id, user_id, encrypted_payload, encryption_version
  ) values (
    p_transaction_id, v_user_id, p_transaction_payload, 1
  );

  begin
    insert into public.transaction_template_postings (
      template_id, user_id, period_key, transaction_id
    ) values (
      v_template.id, v_user_id, v_period, p_transaction_id
    );
  exception when unique_violation then
    delete from public.transactions where id = p_transaction_id and user_id = v_user_id;
    select transaction_id into v_existing_transaction_id
    from public.transaction_template_postings
    where template_id = v_template.id and user_id = v_user_id and period_key = v_period;
    return jsonb_build_object('id', v_existing_transaction_id, 'existing', true);
  end;

  return jsonb_build_object('id', p_transaction_id, 'existing', false, 'transactionDate', v_transaction_date);
end;
$$;

revoke all on function public.post_monthly_transaction_template_e2ee_atomic(uuid,date,uuid,jsonb) from public, anon;
grant execute on function public.post_monthly_transaction_template_e2ee_atomic(uuid,date,uuid,jsonb) to authenticated, service_role;
revoke execute on function public.post_monthly_transaction_template(uuid,date) from public, anon, authenticated;
grant execute on function public.post_monthly_transaction_template(uuid,date) to postgres, service_role;

alter publication supabase_realtime add table public.transaction_templates;

commit;
