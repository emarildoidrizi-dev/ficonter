do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and (
      p.proname in (
        'create_business_inventory_item_e2ee',
        'record_business_inventory_movement_e2ee',
        'reverse_business_inventory_movement_e2ee'
      )
      or (
        p.proname='record_business_inventory_movement_e2ee_atomic'
        and position('p_reversal_of_id uuid' in pg_get_function_identity_arguments(p.oid))=0
      )
    )
  loop
    execute format(
      'revoke execute on function %s from authenticated,anon,public,service_role',
      r.signature
    );
  end loop;
end$$;
