do $$ declare r record; begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname=any(array[
      'business_cost_budget_before_write','business_cost_category_after_update','business_documents_touch_updated_at',
      'business_inventory_item_before_write','business_inventory_master_before_write','business_inventory_seed_after_business',
      'business_recurring_cost_before_write','business_sale_before_write','business_seed_cost_control_after_insert',
      'business_supplier_before_write','business_supplier_invoice_before_write','business_touch_updated_at',
      'business_transaction_before_write','business_user_preference_touch_updated_at'
    ])
  loop execute format('revoke all on function %s from authenticated,anon,public',r.oid::regprocedure); end loop;
end $$;
