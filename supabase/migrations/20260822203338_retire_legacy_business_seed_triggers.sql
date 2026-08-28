drop trigger if exists business_inventory_seed_after_business on public.businesses;
drop trigger if exists business_seed_cost_control_after_insert on public.businesses;
drop function if exists public.business_inventory_seed_after_business();
drop function if exists public.business_seed_cost_control_after_insert();
