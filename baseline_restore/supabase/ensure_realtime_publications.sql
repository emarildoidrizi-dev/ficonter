do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bills;
exception
  when duplicate_object then null;
end $$;

alter table public.transactions replica identity full;
alter table public.bills replica identity full;
notify pgrst, 'reload schema';
