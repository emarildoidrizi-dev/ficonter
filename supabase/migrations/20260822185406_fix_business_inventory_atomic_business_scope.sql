create or replace function public.create_business_inventory_item_e2ee_atomic(
  p_business_id uuid,p_item_id uuid,p_item_payload jsonb,p_category_id uuid,p_supplier_id uuid,p_location_id uuid,p_status text,
  p_opening_movement_id uuid default null,p_opening_movement_payload jsonb default null
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_business_id is null or p_item_id is null or p_item_payload is null then raise exception 'Business and encrypted inventory item payload are required.' using errcode='22023'; end if;
  if not public.business_member_can_write(p_business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if not exists(select 1 from public.business_vault_member_keys where business_id=p_business_id and user_id=v_user_id) then raise exception 'This Business Vault has not been shared with your account.' using errcode='42501'; end if;
  if p_status not in ('active','discontinued') then raise exception 'Invalid inventory item status.' using errcode='22023'; end if;
  if p_category_id is not null and not exists(select 1 from public.business_inventory_categories where id=p_category_id and business_id=p_business_id) then raise exception 'The selected inventory category does not belong to this business.' using errcode='22023'; end if;
  if p_supplier_id is not null and not exists(select 1 from public.business_suppliers where id=p_supplier_id and business_id=p_business_id) then raise exception 'The selected supplier does not belong to this business.' using errcode='22023'; end if;
  if p_location_id is not null and not exists(select 1 from public.business_inventory_locations where id=p_location_id and business_id=p_business_id) then raise exception 'The selected location does not belong to this business.' using errcode='22023'; end if;
  insert into public.business_inventory_items(id,business_id,created_by,category_id,supplier_id,location_id,status,encrypted_payload,encryption_version,e2ee_revision)
  values(p_item_id,p_business_id,v_user_id,p_category_id,p_supplier_id,p_location_id,p_status,p_item_payload,1,0);
  if p_opening_movement_id is not null or p_opening_movement_payload is not null then
    if p_opening_movement_id is null or p_opening_movement_payload is null then raise exception 'Opening movement id and ciphertext must be provided together.' using errcode='22023'; end if;
    insert into public.business_inventory_movements(id,business_id,item_id,created_by,supplier_id,encrypted_payload,encryption_version,e2ee_revision)
    values(p_opening_movement_id,p_business_id,p_item_id,v_user_id,p_supplier_id,p_opening_movement_payload,1,0);
    update public.business_inventory_items set e2ee_revision=1,updated_at=now() where id=p_item_id;
  end if;
  return jsonb_build_object('item_id',p_item_id,'opening_movement_id',p_opening_movement_id,'item_revision',case when p_opening_movement_id is null then 0 else 1 end);
end;$$;

create or replace function public.record_business_inventory_movement_e2ee_atomic(
  p_item_id uuid,p_expected_revision bigint,p_movement_id uuid,p_movement_payload jsonb,p_supplier_id uuid default null,
  p_reversal_of_id uuid default null,p_transaction_id uuid default null,p_transaction_payload jsonb default null,
  p_cost_category_id uuid default null,p_cost_centre_id uuid default null,p_new_item_payload jsonb default null,p_new_supplier_id uuid default null
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid(); v_item public.business_inventory_items%rowtype; v_movement public.business_inventory_movements%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_movement_id is null or p_movement_payload is null then raise exception 'Encrypted inventory movement payload is required.' using errcode='22023'; end if;
  select * into v_item from public.business_inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_item.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_item.status<>'active' then raise exception 'Archived inventory items cannot receive new movements.' using errcode='22023'; end if;
  if v_item.encryption_version is distinct from 1 or v_item.encrypted_payload is null then raise exception 'Encrypted inventory item is unavailable.' using errcode='22023'; end if;
  if v_item.e2ee_revision<>coalesce(p_expected_revision,-1) then raise exception 'Inventory changed. Refresh and try again.' using errcode='40001'; end if;
  if p_supplier_id is not null and not exists(select 1 from public.business_suppliers where id=p_supplier_id and business_id=v_item.business_id) then raise exception 'The selected supplier does not belong to this business.' using errcode='22023'; end if;
  if p_cost_category_id is not null and not exists(select 1 from public.business_cost_categories where id=p_cost_category_id and business_id=v_item.business_id) then raise exception 'The selected cost category does not belong to this business.' using errcode='22023'; end if;
  if p_cost_centre_id is not null and not exists(select 1 from public.business_cost_centres where id=p_cost_centre_id and business_id=v_item.business_id) then raise exception 'The selected cost centre does not belong to this business.' using errcode='22023'; end if;
  if p_reversal_of_id is not null then
    select * into v_movement from public.business_inventory_movements where id=p_reversal_of_id and item_id=p_item_id and business_id=v_item.business_id for update;
    if not found then raise exception 'Original inventory movement was not found.' using errcode='P0002'; end if;
    if exists(select 1 from public.business_inventory_movements where reversal_of_id=p_reversal_of_id) then raise exception 'This movement has already been reversed.' using errcode='23505'; end if;
  end if;
  insert into public.business_inventory_movements(id,business_id,item_id,created_by,supplier_id,reversal_of_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_movement_id,v_item.business_id,p_item_id,v_user_id,p_supplier_id,p_reversal_of_id,p_movement_payload,1,0);
  if p_transaction_id is not null or p_transaction_payload is not null then
    if p_transaction_id is null or p_transaction_payload is null then raise exception 'Transaction id and ciphertext must be provided together.' using errcode='22023'; end if;
    insert into public.business_transactions(id,business_id,created_by,cost_category_id,cost_centre_id,source_inventory_movement_id,supplier_id,encrypted_payload,encryption_version,e2ee_revision)
    values(p_transaction_id,v_item.business_id,v_user_id,p_cost_category_id,p_cost_centre_id,p_movement_id,p_supplier_id,p_transaction_payload,1,0);
    update public.business_inventory_movements set transaction_id=p_transaction_id where id=p_movement_id;
  end if;
  if p_reversal_of_id is not null then delete from public.business_transactions where id=(select transaction_id from public.business_inventory_movements where id=p_reversal_of_id) and business_id=v_item.business_id; end if;
  update public.business_inventory_items set encrypted_payload=coalesce(p_new_item_payload,encrypted_payload),supplier_id=coalesce(p_new_supplier_id,supplier_id),encryption_version=1,e2ee_revision=e2ee_revision+1,updated_at=now() where id=p_item_id;
  return jsonb_build_object('movement_id',p_movement_id,'transaction_id',p_transaction_id,'item_revision',v_item.e2ee_revision+1);
end;$$;

revoke all on function public.create_business_inventory_item_e2ee_atomic(uuid,uuid,jsonb,uuid,uuid,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.create_business_inventory_item_e2ee_atomic(uuid,uuid,jsonb,uuid,uuid,uuid,text,uuid,jsonb) to authenticated;
revoke all on function public.record_business_inventory_movement_e2ee_atomic(uuid,bigint,uuid,jsonb,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.record_business_inventory_movement_e2ee_atomic(uuid,bigint,uuid,jsonb,uuid,uuid,uuid,jsonb,uuid,uuid,jsonb,uuid) to authenticated;
