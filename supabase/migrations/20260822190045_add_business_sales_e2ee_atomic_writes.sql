create or replace function public.record_business_sale_e2ee_atomic(
  p_business_id uuid,p_sale_id uuid,p_sale_payload jsonb,p_transaction_id uuid,p_transaction_payload jsonb,p_lines jsonb,p_movements jsonb
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid();v_op jsonb;v_line jsonb;v_item public.business_inventory_items%rowtype;v_item_id uuid;v_movement_id uuid;v_line_id uuid;v_inventory_item_id uuid;v_inventory_movement_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if not public.business_member_can_write(p_business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if not exists(select 1 from public.business_vault_member_keys where business_id=p_business_id and user_id=v_user_id) then raise exception 'Business Vault access is required.' using errcode='42501'; end if;
  if p_sale_id is null or p_sale_payload is null or p_transaction_id is null or p_transaction_payload is null then raise exception 'Encrypted Sale and Transaction payloads are required.' using errcode='22023'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 or jsonb_array_length(p_lines)>100 then raise exception 'A Sale requires between 1 and 100 encrypted lines.' using errcode='22023'; end if;
  if jsonb_typeof(p_movements)<>'array' then raise exception 'Encrypted movement list is required.' using errcode='22023'; end if;
  for v_item_id in select distinct (entry->>'item_id')::uuid from jsonb_array_elements(p_movements) entry where nullif(entry->>'item_id','') is not null order by 1 loop
    perform 1 from public.business_inventory_items where id=v_item_id and business_id=p_business_id for update;
    if not found then raise exception 'One selected inventory item was not found.' using errcode='P0002'; end if;
  end loop;
  insert into public.business_sales(id,business_id,created_by,status,transaction_id,completed_at,encrypted_payload,encryption_version,e2ee_revision)
  values(p_sale_id,p_business_id,v_user_id,'completed',null,now(),p_sale_payload,1,0);
  for v_op in select value from jsonb_array_elements(p_movements) loop
    v_item_id:=(v_op->>'item_id')::uuid;v_movement_id:=(v_op->>'id')::uuid;
    select * into v_item from public.business_inventory_items where id=v_item_id and business_id=p_business_id for update;
    if not found then raise exception 'Inventory item was not found.' using errcode='P0002'; end if;
    if v_item.status<>'active' or v_item.encryption_version is distinct from 1 or v_item.encrypted_payload is null then raise exception 'Encrypted active inventory item is required.' using errcode='22023'; end if;
    if v_item.e2ee_revision<>(v_op->>'expected_revision')::bigint then raise exception 'Inventory changed. Refresh and try again.' using errcode='40001'; end if;
    if v_op->'encrypted_payload' is null then raise exception 'Encrypted inventory movement is required.' using errcode='22023'; end if;
    insert into public.business_inventory_movements(id,business_id,item_id,created_by,encrypted_payload,encryption_version,e2ee_revision)
    values(v_movement_id,p_business_id,v_item_id,v_user_id,v_op->'encrypted_payload',1,0);
    update public.business_inventory_items set e2ee_revision=e2ee_revision+1,updated_at=now() where id=v_item_id;
  end loop;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_id:=(v_line->>'id')::uuid;v_inventory_item_id:=nullif(v_line->>'inventory_item_id','')::uuid;v_inventory_movement_id:=nullif(v_line->>'inventory_movement_id','')::uuid;
    if v_line->'encrypted_payload' is null then raise exception 'Encrypted Sale line is required.' using errcode='22023'; end if;
    if v_inventory_movement_id is not null and not exists(select 1 from public.business_inventory_movements where id=v_inventory_movement_id and business_id=p_business_id and item_id=v_inventory_item_id) then raise exception 'Sale line movement linkage is invalid.' using errcode='22023'; end if;
    insert into public.business_sale_lines(id,sale_id,business_id,inventory_item_id,inventory_movement_id,encrypted_payload,encryption_version,e2ee_revision)
    values(v_line_id,p_sale_id,p_business_id,v_inventory_item_id,v_inventory_movement_id,v_line->'encrypted_payload',1,0);
  end loop;
  insert into public.business_transactions(id,business_id,created_by,source_sale_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_transaction_id,p_business_id,v_user_id,p_sale_id,p_transaction_payload,1,0);
  update public.business_sales set transaction_id=p_transaction_id,updated_at=now() where id=p_sale_id;
  return jsonb_build_object('sale_id',p_sale_id,'transaction_id',p_transaction_id);
end;$$;

create or replace function public.update_business_sale_e2ee_atomic(
  p_sale_id uuid,p_expected_sale_revision bigint,p_sale_payload jsonb,p_transaction_id uuid,p_transaction_payload jsonb,p_reversals jsonb,p_lines jsonb,p_movements jsonb
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid();v_sale public.business_sales%rowtype;v_op jsonb;v_line jsonb;v_item public.business_inventory_items%rowtype;v_original public.business_inventory_movements%rowtype;v_item_id uuid;v_id uuid;v_original_id uuid;v_line_id uuid;v_inventory_item_id uuid;v_inventory_movement_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into v_sale from public.business_sales where id=p_sale_id for update;
  if not found then raise exception 'Sale was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_sale.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_sale.status<>'completed' then raise exception 'Only a completed Sale can be edited.' using errcode='22023'; end if;
  if v_sale.encryption_version is distinct from 1 or v_sale.encrypted_payload is null then raise exception 'Encrypted Sale is required.' using errcode='22023'; end if;
  if v_sale.e2ee_revision<>p_expected_sale_revision then raise exception 'Sale changed. Refresh and try again.' using errcode='40001'; end if;
  if p_sale_payload is null or p_transaction_id is null or p_transaction_payload is null or jsonb_typeof(p_reversals)<>'array' or jsonb_typeof(p_lines)<>'array' or jsonb_typeof(p_movements)<>'array' or jsonb_array_length(p_lines)=0 or jsonb_array_length(p_lines)>100 then raise exception 'Encrypted Sale operation lists are invalid.' using errcode='22023'; end if;
  for v_item_id in select distinct item_id from (
    select (entry->>'item_id')::uuid item_id from jsonb_array_elements(p_reversals) entry where nullif(entry->>'item_id','') is not null
    union select (entry->>'item_id')::uuid from jsonb_array_elements(p_movements) entry where nullif(entry->>'item_id','') is not null
  ) ids order by item_id loop
    perform 1 from public.business_inventory_items where id=v_item_id and business_id=v_sale.business_id for update;
    if not found then raise exception 'One selected inventory item was not found.' using errcode='P0002'; end if;
  end loop;
  for v_op in select value from jsonb_array_elements(p_reversals) loop
    v_item_id:=(v_op->>'item_id')::uuid;v_id:=(v_op->>'id')::uuid;v_original_id:=(v_op->>'original_movement_id')::uuid;
    select * into v_item from public.business_inventory_items where id=v_item_id and business_id=v_sale.business_id for update;
    if v_item.e2ee_revision<>(v_op->>'expected_revision')::bigint then raise exception 'Inventory changed. Refresh and try again.' using errcode='40001'; end if;
    select * into v_original from public.business_inventory_movements where id=v_original_id and item_id=v_item_id and business_id=v_sale.business_id for update;
    if not found or not exists(select 1 from public.business_sale_lines where sale_id=p_sale_id and inventory_movement_id=v_original_id) then raise exception 'Sale reversal linkage is invalid.' using errcode='22023'; end if;
    if exists(select 1 from public.business_inventory_movements where reversal_of_id=v_original_id) then raise exception 'Sale inventory has already been restored.' using errcode='23505'; end if;
    insert into public.business_inventory_movements(id,business_id,item_id,created_by,reversal_of_id,encrypted_payload,encryption_version,e2ee_revision)
    values(v_id,v_sale.business_id,v_item_id,v_user_id,v_original_id,v_op->'encrypted_payload',1,0);
    update public.business_inventory_items set e2ee_revision=e2ee_revision+1,updated_at=now() where id=v_item_id;
  end loop;
  if v_sale.transaction_id is not null then delete from public.business_transactions where id=v_sale.transaction_id and business_id=v_sale.business_id and source_sale_id=p_sale_id; end if;
  delete from public.business_sale_lines where sale_id=p_sale_id and business_id=v_sale.business_id;
  update public.business_sales set encrypted_payload=p_sale_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,transaction_id=null,refunded_at=null,deleted_at=null,updated_at=now() where id=p_sale_id;
  for v_op in select value from jsonb_array_elements(p_movements) loop
    v_item_id:=(v_op->>'item_id')::uuid;v_id:=(v_op->>'id')::uuid;
    select * into v_item from public.business_inventory_items where id=v_item_id and business_id=v_sale.business_id for update;
    if v_item.e2ee_revision<>(v_op->>'expected_revision')::bigint then raise exception 'Inventory changed. Refresh and try again.' using errcode='40001'; end if;
    insert into public.business_inventory_movements(id,business_id,item_id,created_by,encrypted_payload,encryption_version,e2ee_revision)
    values(v_id,v_sale.business_id,v_item_id,v_user_id,v_op->'encrypted_payload',1,0);
    update public.business_inventory_items set e2ee_revision=e2ee_revision+1,updated_at=now() where id=v_item_id;
  end loop;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_id:=(v_line->>'id')::uuid;v_inventory_item_id:=nullif(v_line->>'inventory_item_id','')::uuid;v_inventory_movement_id:=nullif(v_line->>'inventory_movement_id','')::uuid;
    if v_inventory_movement_id is not null and not exists(select 1 from public.business_inventory_movements where id=v_inventory_movement_id and item_id=v_inventory_item_id and business_id=v_sale.business_id) then raise exception 'Sale line movement linkage is invalid.' using errcode='22023'; end if;
    insert into public.business_sale_lines(id,sale_id,business_id,inventory_item_id,inventory_movement_id,encrypted_payload,encryption_version,e2ee_revision)
    values(v_line_id,p_sale_id,v_sale.business_id,v_inventory_item_id,v_inventory_movement_id,v_line->'encrypted_payload',1,0);
  end loop;
  insert into public.business_transactions(id,business_id,created_by,source_sale_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_transaction_id,v_sale.business_id,v_user_id,p_sale_id,p_transaction_payload,1,0);
  update public.business_sales set transaction_id=p_transaction_id,updated_at=now() where id=p_sale_id;
  return jsonb_build_object('sale_id',p_sale_id,'transaction_id',p_transaction_id,'sale_revision',p_expected_sale_revision+1);
end;$$;

create or replace function public.close_business_sale_e2ee_atomic(
  p_sale_id uuid,p_expected_sale_revision bigint,p_target_status text,p_reversals jsonb
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid();v_sale public.business_sales%rowtype;v_op jsonb;v_item public.business_inventory_items%rowtype;v_original public.business_inventory_movements%rowtype;v_item_id uuid;v_id uuid;v_original_id uuid;v_deleted_transaction_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_target_status not in ('refunded','deleted') then raise exception 'Invalid Sale close status.' using errcode='22023'; end if;
  select * into v_sale from public.business_sales where id=p_sale_id for update;
  if not found then raise exception 'Sale was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_sale.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_sale.status<>'completed' then raise exception 'Only a completed Sale can be closed.' using errcode='22023'; end if;
  if v_sale.e2ee_revision<>p_expected_sale_revision then raise exception 'Sale changed. Refresh and try again.' using errcode='40001'; end if;
  if jsonb_typeof(p_reversals)<>'array' then raise exception 'Encrypted reversal list is required.' using errcode='22023'; end if;
  for v_item_id in select distinct (entry->>'item_id')::uuid from jsonb_array_elements(p_reversals) entry where nullif(entry->>'item_id','') is not null order by 1 loop
    perform 1 from public.business_inventory_items where id=v_item_id and business_id=v_sale.business_id for update;
    if not found then raise exception 'One inventory item was not found.' using errcode='P0002'; end if;
  end loop;
  for v_op in select value from jsonb_array_elements(p_reversals) loop
    v_item_id:=(v_op->>'item_id')::uuid;v_id:=(v_op->>'id')::uuid;v_original_id:=(v_op->>'original_movement_id')::uuid;
    select * into v_item from public.business_inventory_items where id=v_item_id and business_id=v_sale.business_id for update;
    if v_item.e2ee_revision<>(v_op->>'expected_revision')::bigint then raise exception 'Inventory changed. Refresh and try again.' using errcode='40001'; end if;
    select * into v_original from public.business_inventory_movements where id=v_original_id and item_id=v_item_id and business_id=v_sale.business_id for update;
    if not found or not exists(select 1 from public.business_sale_lines where sale_id=p_sale_id and inventory_movement_id=v_original_id) then raise exception 'Sale reversal linkage is invalid.' using errcode='22023'; end if;
    if exists(select 1 from public.business_inventory_movements where reversal_of_id=v_original_id) then raise exception 'Sale inventory has already been restored.' using errcode='23505'; end if;
    insert into public.business_inventory_movements(id,business_id,item_id,created_by,reversal_of_id,encrypted_payload,encryption_version,e2ee_revision)
    values(v_id,v_sale.business_id,v_item_id,v_user_id,v_original_id,v_op->'encrypted_payload',1,0);
    update public.business_inventory_items set e2ee_revision=e2ee_revision+1,updated_at=now() where id=v_item_id;
  end loop;
  v_deleted_transaction_id:=v_sale.transaction_id;
  if v_deleted_transaction_id is not null then delete from public.business_transactions where id=v_deleted_transaction_id and business_id=v_sale.business_id and source_sale_id=p_sale_id; end if;
  update public.business_sales set status=p_target_status,transaction_id=null,e2ee_revision=e2ee_revision+1,refunded_at=case when p_target_status='refunded' then now() else refunded_at end,deleted_at=case when p_target_status='deleted' then now() else deleted_at end,updated_at=now() where id=p_sale_id;
  return jsonb_build_object('sale_id',p_sale_id,'status',p_target_status,'deleted_transaction_id',v_deleted_transaction_id,'sale_revision',p_expected_sale_revision+1);
end;$$;

create or replace function public.restore_business_sale_e2ee_atomic(
  p_sale_id uuid,p_expected_sale_revision bigint,p_sale_payload jsonb,p_transaction_id uuid,p_transaction_payload jsonb,p_lines jsonb,p_movements jsonb
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_user_id uuid:=auth.uid();v_sale public.business_sales%rowtype;v_op jsonb;v_line jsonb;v_item public.business_inventory_items%rowtype;v_item_id uuid;v_id uuid;v_line_id uuid;v_inventory_item_id uuid;v_inventory_movement_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into v_sale from public.business_sales where id=p_sale_id for update;
  if not found then raise exception 'Sale was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_sale.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_sale.status not in ('refunded','deleted') then raise exception 'Only a refunded or deleted Sale can be restored.' using errcode='22023'; end if;
  if v_sale.e2ee_revision<>p_expected_sale_revision then raise exception 'Sale changed. Refresh and try again.' using errcode='40001'; end if;
  if p_sale_payload is null or p_transaction_id is null or p_transaction_payload is null or jsonb_typeof(p_lines)<>'array' or jsonb_typeof(p_movements)<>'array' then raise exception 'Encrypted Sale restore payloads are required.' using errcode='22023'; end if;
  if jsonb_array_length(p_lines)<>(select count(*) from public.business_sale_lines where sale_id=p_sale_id) then raise exception 'Saved Sale lines changed. Refresh and try again.' using errcode='40001'; end if;
  for v_item_id in select distinct (entry->>'item_id')::uuid from jsonb_array_elements(p_movements) entry where nullif(entry->>'item_id','') is not null order by 1 loop
    perform 1 from public.business_inventory_items where id=v_item_id and business_id=v_sale.business_id for update;
    if not found then raise exception 'One inventory item was not found.' using errcode='P0002'; end if;
  end loop;
  for v_op in select value from jsonb_array_elements(p_movements) loop
    v_item_id:=(v_op->>'item_id')::uuid;v_id:=(v_op->>'id')::uuid;
    select * into v_item from public.business_inventory_items where id=v_item_id and business_id=v_sale.business_id for update;
    if v_item.status<>'active' then raise exception 'A discontinued inventory item cannot be restored into a Sale.' using errcode='22023'; end if;
    if v_item.e2ee_revision<>(v_op->>'expected_revision')::bigint then raise exception 'Inventory changed. Refresh and try again.' using errcode='40001'; end if;
    insert into public.business_inventory_movements(id,business_id,item_id,created_by,encrypted_payload,encryption_version,e2ee_revision)
    values(v_id,v_sale.business_id,v_item_id,v_user_id,v_op->'encrypted_payload',1,0);
    update public.business_inventory_items set e2ee_revision=e2ee_revision+1,updated_at=now() where id=v_item_id;
  end loop;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_id:=(v_line->>'id')::uuid;v_inventory_item_id:=nullif(v_line->>'inventory_item_id','')::uuid;v_inventory_movement_id:=nullif(v_line->>'inventory_movement_id','')::uuid;
    if not exists(select 1 from public.business_sale_lines where id=v_line_id and sale_id=p_sale_id and business_id=v_sale.business_id) then raise exception 'Saved Sale line was not found.' using errcode='P0002'; end if;
    if v_inventory_movement_id is not null and not exists(select 1 from public.business_inventory_movements where id=v_inventory_movement_id and item_id=v_inventory_item_id and business_id=v_sale.business_id) then raise exception 'Sale line movement linkage is invalid.' using errcode='22023'; end if;
    update public.business_sale_lines set inventory_item_id=v_inventory_item_id,inventory_movement_id=v_inventory_movement_id,encrypted_payload=v_line->'encrypted_payload',encryption_version=1,e2ee_revision=e2ee_revision+1 where id=v_line_id;
  end loop;
  insert into public.business_transactions(id,business_id,created_by,source_sale_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_transaction_id,v_sale.business_id,v_user_id,p_sale_id,p_transaction_payload,1,0);
  update public.business_sales set status='completed',transaction_id=p_transaction_id,encrypted_payload=p_sale_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,completed_at=now(),refunded_at=null,deleted_at=null,updated_at=now() where id=p_sale_id;
  return jsonb_build_object('sale_id',p_sale_id,'transaction_id',p_transaction_id,'sale_revision',p_expected_sale_revision+1);
end;$$;

do $$ declare r record; begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['record_business_sale_e2ee_atomic','update_business_sale_e2ee_atomic','close_business_sale_e2ee_atomic','restore_business_sale_e2ee_atomic']) loop
  execute format('revoke all on function %s from public,anon',r.oid::regprocedure);
  execute format('grant execute on function %s to authenticated',r.oid::regprocedure);
 end loop;
end $$;
