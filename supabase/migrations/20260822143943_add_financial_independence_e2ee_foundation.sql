begin;

alter table public.financial_independence_settings
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version integer,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.financial_independence_settings
  alter column withdrawal_rate drop not null,
  alter column withdrawal_rate drop default,
  alter column annual_real_return_rate drop not null,
  alter column annual_real_return_rate drop default;

create or replace function public.save_financial_independence_settings_e2ee_atomic(
  p_expected_revision bigint,
  p_encrypted_payload jsonb
)
returns public.financial_independence_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.financial_independence_settings;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_encrypted_payload is null then
    raise exception 'Encrypted Financial Independence payload is required.' using errcode = '23514';
  end if;

  select * into v_row
  from public.financial_independence_settings
  where user_id = v_user_id
  for update;

  if not found then
    if p_expected_revision <> -1 then
      raise exception 'Financial Independence settings revision conflict.' using errcode = '40001';
    end if;

    insert into public.financial_independence_settings (
      user_id,
      target_monthly_spending,
      withdrawal_rate,
      annual_real_return_rate,
      encrypted_payload,
      encryption_version,
      e2ee_revision,
      updated_at
    ) values (
      v_user_id,
      null,
      null,
      null,
      p_encrypted_payload,
      1,
      0,
      now()
    )
    returning * into v_row;
  else
    if v_row.e2ee_revision <> p_expected_revision then
      raise exception 'Financial Independence settings revision conflict.' using errcode = '40001';
    end if;

    update public.financial_independence_settings
    set target_monthly_spending = null,
        withdrawal_rate = null,
        annual_real_return_rate = null,
        encrypted_payload = p_encrypted_payload,
        encryption_version = 1,
        e2ee_revision = e2ee_revision + 1,
        updated_at = now()
    where user_id = v_user_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.save_financial_independence_settings_e2ee_atomic(bigint,jsonb) from public, anon;
grant execute on function public.save_financial_independence_settings_e2ee_atomic(bigint,jsonb) to authenticated, service_role;

commit;
