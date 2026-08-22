create or replace function public.record_business_inventory_movement_e2ee_atomic(
  p_item_id uuid,p_expected_revision bigint,p_item_payload jsonb,p_movement_id uuid,p_movement_payload jsonb,p_supplier_id uuid default null,
  p_transaction_id uuid default null,p_transaction_payload jsonb default null,p_cost_category_id uuid default null,p_cost_centre_id uuid default null
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid(); v_item public.business_inventory_items%rowtype; v_movement public.business_inventory_movements%rowtype; v_transaction public.business_transactions%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_movement_id is null or p_movement_payload is null or p_item_payload is null then raise exception 'Encrypted inventory payloads are required.' using errcode='22023'; end if;
  select * into v_item from public.business_inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_item.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_item.status<>'active' then raise exception 'Archived inventory items cannot receive new movements.' using errcode='22023'; end if;
  if v_item.encryption_version is distinct from 1 or v_item.encrypted_payload is null then raise exception 'Encrypted inventory item is required.' using errcode='22023'; end if;
  if v_item.e2ee_revision<>p_expected_revision then raise exception 'Inventory item changed. Refresh and try again.' using errcode='40001'; end if;
  insert into public.business_inventory_movements(id,business_id,item_id,created_by,supplier_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_movement_id,v_item.business_id,p_item_id,v_user_id,p_supplier_id,p_movement_payload,1,0) returning * into v_movement;
  if p_transaction_id is not null and p_transaction_payload is not null then
    insert into public.business_transactions(id,business_id,created_by,supplier_id,cost_category_id,cost_centre_id,source_inventory_movement_id,encrypted_payload,encryption_version,e2ee_revision)
    values(p_transaction_id,v_item.business_id,v_user_id,p_supplier_id,p_cost_category_id,p_cost_centre_id,p_movement_id,p_transaction_payload,1,0) returning * into v_transaction;
    update public.business_inventory_movements set transaction_id=p_transaction_id where id=p_movement_id returning * into v_movement;
  end if;
  update public.business_inventory_items set encrypted_payload=p_item_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,supplier_id=coalesce(p_supplier_id,supplier_id),updated_at=now() where id=v_item.id returning * into v_item;
  return jsonb_build_object('item',to_jsonb(v_item),'movement',to_jsonb(v_movement),'transaction',case when v_transaction.id is null then null else to_jsonb(v_transaction) end);
end;$$;

create or replace function public.reverse_business_inventory_movement_e2ee(
  p_movement_id uuid,p_reversal_id uuid,p_reversal_payload jsonb
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid(); v_original public.business_inventory_movements%rowtype; v_reversal public.business_inventory_movements%rowtype; v_transaction_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_reversal_id is null or p_reversal_payload is null then raise exception 'Encrypted reversal payload is required.' using errcode='22023'; end if;
  select * into v_original from public.business_inventory_movements where id=p_movement_id for update;
  if not found then raise exception 'Inventory movement was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_original.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if exists(select 1 from public.business_inventory_movements where reversal_of_id=v_original.id) then raise exception 'This movement has already been reversed.' using errcode='22023'; end if;
  v_transaction_id:=v_original.transaction_id;
  if v_transaction_id is not null then delete from public.business_transactions where id=v_transaction_id and business_id=v_original.business_id; end if;
  insert into public.business_inventory_movements(id,business_id,item_id,created_by,supplier_id,reversal_of_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_reversal_id,v_original.business_id,v_original.item_id,v_user_id,v_original.supplier_id,v_original.id,p_reversal_payload,1,0) returning * into v_reversal;
  return jsonb_build_object('movement',to_jsonb(v_reversal),'deleted_transaction_id',v_transaction_id);
end;$$;

revoke all on function public.record_business_inventory_movement_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,uuid,uuid,jsonb,uuid,uuid) from public,anon;
grant execute on function public.record_business_inventory_movement_e2ee_atomic(uuid,bigint,jsonb,uuid,jsonb,uuid,uuid,jsonb,uuid,uuid) to authenticated;
revoke all on function public.reverse_business_inventory_movement_e2ee(uuid,uuid,jsonb) from public,anon;
grant execute on function public.reverse_business_inventory_movement_e2ee(uuid,uuid,jsonb) to authenticated;
