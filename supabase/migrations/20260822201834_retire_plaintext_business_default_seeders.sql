create or replace function public.seed_business_cost_control_defaults(p_business_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  raise exception 'Legacy plaintext business default seeding is disabled.' using errcode='42501';
end;$$;

create or replace function public.seed_business_inventory_defaults(p_business_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  raise exception 'Legacy plaintext business default seeding is disabled.' using errcode='42501';
end;$$;

revoke execute on function public.seed_business_cost_control_defaults(uuid)
  from authenticated,anon,public,service_role;
revoke execute on function public.seed_business_inventory_defaults(uuid)
  from authenticated,anon,public,service_role;
