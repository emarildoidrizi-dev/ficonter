begin;

do $$
begin
  if exists (
    select 1 from public.goals
    where encryption_version is distinct from 1 or encrypted_payload is null
  ) then
    raise exception 'Cannot enforce Goals ciphertext-only while legacy plaintext Goal rows remain.';
  end if;
  if exists (
    select 1 from public.goal_investments
    where encryption_version is distinct from 1 or encrypted_payload is null
  ) then
    raise exception 'Cannot enforce Goals ciphertext-only while legacy plaintext Goal investment rows remain.';
  end if;
end;
$$;

create or replace function public.ficonter_enforce_goal_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
    raise exception 'Goals must be stored as Financial Vault ciphertext.' using errcode='23514';
  end if;
  new.name := null;
  new.target_amount := null;
  new.current_amount := null;
  new.target_date := null;
  new.status := null;
  return new;
end;
$$;

create or replace function public.ficonter_enforce_goal_investment_ciphertext_only()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
    raise exception 'Goal investments must be stored as Financial Vault ciphertext.' using errcode='23514';
  end if;
  new.amount := null;
  new.original_amount := null;
  new.currency := null;
  new.exchange_rate_to_eur := null;
  new.exchange_rate_date := null;
  new.notes := null;
  return new;
end;
$$;

drop trigger if exists goals_ciphertext_only on public.goals;
create trigger goals_ciphertext_only before insert or update on public.goals
for each row execute function public.ficonter_enforce_goal_ciphertext_only();

drop trigger if exists goal_investments_ciphertext_only on public.goal_investments;
create trigger goal_investments_ciphertext_only before insert or update on public.goal_investments
for each row execute function public.ficonter_enforce_goal_investment_ciphertext_only();

revoke all on function public.ficonter_enforce_goal_ciphertext_only() from public,anon,authenticated;
revoke all on function public.ficonter_enforce_goal_investment_ciphertext_only() from public,anon,authenticated;
revoke execute on function public.record_goal_investment(uuid,numeric,timestamptz,text) from public,anon,authenticated;
revoke execute on function public.record_goal_investment(uuid,numeric,numeric,text,numeric,timestamptz,text,date) from public,anon,authenticated;
revoke execute on function public.reverse_goal_investment(uuid) from public,anon,authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='goals'
  ) then alter publication supabase_realtime add table public.goals; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='goal_investments'
  ) then alter publication supabase_realtime add table public.goal_investments; end if;
end;
$$;

commit;
