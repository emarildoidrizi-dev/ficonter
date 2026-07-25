-- Ficonter platform-wide realtime verification
-- Safe to run more than once.

alter table public.transactions replica identity full;
alter table public.bills replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bills;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
