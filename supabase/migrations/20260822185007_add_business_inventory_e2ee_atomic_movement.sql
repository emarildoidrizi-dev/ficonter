create or replace function public.create_business_inventory_item_e2ee(
  p_business_id uuid,p_item_id uuid,p_item_payload jsonb,p_category_id uuid,p_supplier_id uuid,p_location_id uuid,
  p_opening_movement_id uuid default null,p_opening_movement_payload jsonb default null
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid(); v_item public.business_inventory_items%rowtype; v_movement public.business_inventory_movements%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if not public.business_member_can_write(p_business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if p_item_id is null or p_item_payload is null then raise exception 'Encrypted inventory item payload is required.' using errcode='22023'; end if;
  insert into public.business_inventory_items(id,business_id,created_by,category_id,supplier_id,location_id,status,encrypted_payload,encryption_version,e2ee_revision)
  values(p_item_id,p_business_id,v_user_id,p_category_id,p_supplier_id,p_location_id,'active',p_item_payload,1,0) returning * into v_item;
  if p_opening_movement_id is not null and p_opening_movement_payload is not null then
    insert into public.business_inventory_movements(id,business_id,item_id,created_by,supplier_id,encrypted_payload,encryption_version,e2ee_revision)
    values(p_opening_movement_id,p_business_id,p_item_id,v_user_id,p_supplier_id,p_opening_movement_payload,1,0) returning * into v_movement;
  end if;
  return jsonb_build_object('item',to_jsonb(v_item),'movement',case when v_movement.id is null then null else to_jsonb(v_movement) end);
end;$$;

create or replace function public.record_business_inventory_movement_e2ee(
  p_item_id uuid,p_movement_id uuid,p_movement_payload jsonb,p_supplier_id uuid default null,
  p_transaction_id uuid default null,p_transaction_payload jsonb default null,p_cost_category_id uuid default null,p_cost_centre_id uuid default null
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid(); v_item public.business_inventory_items%rowtype; v_movement public.business_inventory_movements%rowtype; v_transaction public.business_transactions%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_movement_id is null or p_movement_payload is null then raise exception 'Encrypted inventory movement payload is required.' using errcode='22023'; end if;
  select * into v_item from public.business_inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_item.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  insert into public.business_inventory_movements(id,business_id,item_id,created_by,supplier_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_movement_id,v_item.business_id,p_item_id,v_user_id,p_supplier_id,p_movement_payload,1,0) returning * into v_movement;
  if p_transaction_id is not null and p_transaction_payload is not null then
    insert into public.business_transactions(id,business_id,created_by,supplier_id,cost_category_id,cost_centre_id,source_inventory_movement_id,encrypted_payload,encryption_version,e2ee_revision)
    values(p_transaction_id,v_item.business_id,v_user_id,p_supplier_id,p_cost_category_id,p_cost_centre_id,p_movement_id,p_transaction_payload,1,0) returning * into v_transaction;
    update public.business_inventory_movements set transaction_id=p_transaction_id where id=p_movement_id returning * into v_movement;
  end if;
  return jsonb_build_object('movement',to_jsonb(v_movement),'transaction',case when v_transaction.id is null then null else to_jsonb(v_transaction) end);
end;$$;

revoke all on function public.create_business_inventory_item_e2ee(uuid,uuid,jsonb,uuid,uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.create_business_inventory_item_e2ee(uuid,uuid,jsonb,uuid,uuid,uuid,uuid,jsonb) to authenticated;
revoke all on function public.record_business_inventory_movement_e2ee(uuid,uuid,jsonb,uuid,uuid,jsonb,uuid,uuid) from public,anon;
grant execute on function public.record_business_inventory_movement_e2ee(uuid,uuid,jsonb,uuid,uuid,jsonb,uuid,uuid) to authenticated;
