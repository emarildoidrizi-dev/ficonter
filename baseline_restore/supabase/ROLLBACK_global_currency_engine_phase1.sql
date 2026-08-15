-- FICONTER Currency Engine — Phase 1 rollback
-- Use ONLY if Phase 1 has already been applied to Supabase and you want to
-- remove the Phase 1 database foundation.
--
-- This rollback does NOT touch transactions, bills, debts, savings or any
-- financial amount.

begin;

drop trigger if exists profiles_touch_base_currency
on public.profiles;

drop function if exists public.ficonter_touch_profile_base_currency();

alter table public.profiles
  drop constraint if exists profiles_base_currency_check;

alter table public.profiles
  drop column if exists base_currency_updated_at,
  drop column if exists base_currency;

notify pgrst, 'reload schema';

commit;
