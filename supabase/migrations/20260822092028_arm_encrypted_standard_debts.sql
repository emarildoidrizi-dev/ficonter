create or replace function public.ficonter_arm_encrypted_standard_debt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.debt_kind = 'standard'
     and new.encryption_version = 1
     and new.encrypted_payload is not null
     and new.status = 'active'
     and new.payment_due_day is not null then
    new.autopay := true;
    new.autopay_enabled_at := coalesce(new.autopay_enabled_at, now());
    new.autopay_record_time := coalesce(new.autopay_record_time, time '09:00');
    new.autopay_timezone := coalesce(nullif(btrim(new.autopay_timezone),''), 'UTC');
  elsif new.debt_kind = 'standard' then
    new.autopay := false;
  end if;
  return new;
end;
$$;

drop trigger if exists debts_arm_encrypted_standard_debt on public.debts;
create trigger debts_arm_encrypted_standard_debt
before insert or update of encrypted_payload,encryption_version,debt_kind,status,payment_due_day,autopay,autopay_enabled_at,autopay_record_time,autopay_timezone
on public.debts
for each row execute function public.ficonter_arm_encrypted_standard_debt();

revoke all on function public.ficonter_arm_encrypted_standard_debt() from public,anon,authenticated;
