-- FICONTER Currency Engine — Phase 3 rollback
-- Removes ONLY the shared FX cache. It does not touch user financial data,
-- profile base currencies, original amounts, or original currencies.

begin;

drop table if exists public.fx_rate_cache;

notify pgrst, 'reload schema';

commit;
