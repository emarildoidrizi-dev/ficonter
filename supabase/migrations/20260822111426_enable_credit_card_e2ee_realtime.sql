do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='debts'
  ) then execute 'alter publication supabase_realtime add table public.debts'; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='credit_card_activities'
  ) then execute 'alter publication supabase_realtime add table public.credit_card_activities'; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='debt_payments'
  ) then execute 'alter publication supabase_realtime add table public.debt_payments'; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='credit_card_monthly_records'
  ) then execute 'alter publication supabase_realtime add table public.credit_card_monthly_records'; end if;
end $$;
