-- FICONTER Currency Engine — Phase 2 rollback
-- Removes only the Phase 2 signup trigger/function.
-- It intentionally keeps the Phase 1 base_currency columns and does not touch
-- any financial record.

begin;

drop trigger if exists zz_ficonter_apply_signup_base_currency
on auth.users;

drop function if exists public.ficonter_apply_signup_base_currency();

notify pgrst, 'reload schema';

commit;
