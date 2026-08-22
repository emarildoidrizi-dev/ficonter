create or replace function public.business_cost_category_after_update()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  -- Private category names are propagated by the unlocked Business Vault client.
  -- The database retains only the operational category id linkage.
  return new;
end;$$;

revoke execute on function public.business_cost_category_after_update()
  from authenticated,anon,public,service_role;
