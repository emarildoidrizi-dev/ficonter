begin;

create or replace function public.enforce_financial_independence_settings_e2ee()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
    raise exception 'Financial Independence settings must be stored as encrypted v1 records.' using errcode = '23514';
  end if;
  new.target_monthly_spending := null;
  new.withdrawal_rate := null;
  new.annual_real_return_rate := null;
  return new;
end;
$$;

drop trigger if exists financial_independence_settings_e2ee_guard on public.financial_independence_settings;
create trigger financial_independence_settings_e2ee_guard
before insert or update on public.financial_independence_settings
for each row execute function public.enforce_financial_independence_settings_e2ee();

alter table public.financial_independence_settings
  drop constraint if exists financial_independence_settings_e2ee_required,
  add constraint financial_independence_settings_e2ee_required check (
    encryption_version = 1
    and encrypted_payload is not null
    and target_monthly_spending is null
    and withdrawal_rate is null
    and annual_real_return_rate is null
  );

revoke execute on function public.get_financial_independence_inputs() from authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'financial_independence_settings'
  ) then
    alter publication supabase_realtime add table public.financial_independence_settings;
  end if;
end;
$$;

commit;
