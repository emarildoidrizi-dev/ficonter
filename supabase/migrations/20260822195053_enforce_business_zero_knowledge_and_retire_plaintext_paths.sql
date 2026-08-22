create or replace function public.ficonter_enforce_business_private_row()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if tg_table_name='businesses' then
    if new.encryption_version=1 and new.encrypted_payload is not null then
      new.legal_name=null;new.tax_id=null;new.contact_email=null;new.contact_phone=null;new.website=null;new.address_line1=null;new.address_line2=null;new.city=null;new.postal_code=null;
    elsif new.legal_name is not null or new.tax_id is not null or new.contact_email is not null or new.contact_phone is not null or new.website is not null or new.address_line1 is not null or new.address_line2 is not null or new.city is not null or new.postal_code is not null then
      raise exception 'Private business profile fields require Business Vault ciphertext.' using errcode='22023';
    end if;
    return new;
  end if;
  if tg_table_name='business_settings' then
    if new.encryption_version=1 and new.encrypted_payload is not null then
      new.default_timezone=null;new.date_format=null;new.number_format=null;new.default_payment_method=null;new.default_payment_terms_days=null;new.default_sales_tax_rate=null;new.invoice_prefix=null;new.next_invoice_number=null;new.default_low_stock_threshold=null;
    else
      new.date_format='DD/MM/YYYY';new.number_format='de-DE';new.default_payment_method='Card';new.default_payment_terms_days=14;new.default_sales_tax_rate=0;new.invoice_prefix='INV';new.next_invoice_number=1;new.default_low_stock_threshold=0;
    end if;
    return new;
  end if;
  if tg_table_name='business_cost_categories' then
    if new.encryption_version=1 and new.encrypted_payload is not null then new.name=null;new.description=null;new.default_nature=null;
    elsif new.name=any(array['Materials','Inventory purchases','Rent','Utilities','Payroll','Contractors','Marketing','Software','Insurance','Transport','Shipping','Equipment','Professional services','Taxes and fees','Bank fees','Travel','Other expense']) then new.description=null;
    else raise exception 'Custom business cost categories require Business Vault ciphertext.' using errcode='22023'; end if; return new;
  end if;
  if tg_table_name='business_cost_centres' then
    if new.encryption_version=1 and new.encrypted_payload is not null then new.name=null;new.description=null;
    elsif new.name=any(array['General Operations','Administration','Sales & Marketing','Production / Delivery']) then new.description=null;
    else raise exception 'Custom business cost centres require Business Vault ciphertext.' using errcode='22023'; end if; return new;
  end if;
  if tg_table_name='business_inventory_categories' then
    if new.encryption_version=1 and new.encrypted_payload is not null then new.name=null;new.description=null;
    elsif new.name=any(array['Finished goods','Raw materials','Components','Packaging','Business supplies','Other']) then new.description=null;
    else raise exception 'Custom inventory categories require Business Vault ciphertext.' using errcode='22023'; end if; return new;
  end if;
  if tg_table_name='business_inventory_locations' then
    if new.encryption_version=1 and new.encrypted_payload is not null then new.name=null;new.description=null;
    elsif new.name='Main storage' then new.description=null;
    else raise exception 'Custom inventory locations require Business Vault ciphertext.' using errcode='22023'; end if; return new;
  end if;

  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then raise exception 'Business Vault ciphertext is required for %.',tg_table_name using errcode='22023'; end if;
  if tg_table_name='business_transactions' then
    new.description=null;new.counterparty=null;new.type=null;new.category=null;new.cost_nature=null;new.amount=null;new.currency=null;new.amount_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;new.exchange_rate_source=null;new.transaction_date=null;new.occurred_at=null;new.payment_method=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_suppliers' then
    new.name=null;new.legal_name=null;new.supplier_code=null;new.category=null;new.contact_name=null;new.email=null;new.phone=null;new.website=null;new.tax_id=null;new.payment_terms_days=null;new.default_currency=null;new.address_line1=null;new.address_line2=null;new.city=null;new.postal_code=null;new.country_code=null;new.notes=null;
  elsif tg_table_name='business_cost_budgets' then new.amount_base=null;new.notes=null;
  elsif tg_table_name='business_recurring_costs' then
    new.name=null;new.supplier=null;new.category_name=null;new.cost_nature=null;new.amount=null;new.currency=null;new.amount_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;new.exchange_rate_source=null;new.payment_method=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_supplier_invoices' then
    new.invoice_number=null;new.description=null;new.category_name=null;new.cost_nature=null;new.amount=null;new.currency=null;new.amount_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;new.exchange_rate_source=null;new.issue_date=null;new.due_date=null;new.payment_method=null;new.notes=null;
  elsif tg_table_name='business_inventory_items' then
    new.name=null;new.sku=null;new.barcode=null;new.unit=null;new.low_stock_threshold=null;new.default_purchase_cost=null;new.default_purchase_currency=null;new.default_purchase_cost_base=null;new.default_exchange_rate_to_base=null;new.selling_price_base=null;new.notes=null;
  elsif tg_table_name='business_inventory_movements' then
    new.item_name=null;new.item_sku=null;new.movement_type=null;new.quantity_delta=null;new.unit_cost=null;new.currency=null;new.unit_cost_base=null;new.inventory_value_delta_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;new.exchange_rate_source=null;new.supplier_name=null;new.movement_date=null;new.occurred_at=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_sales' then
    new.sale_number=null;new.customer_name=null;new.customer_email=null;new.currency=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;new.exchange_rate_source=null;new.subtotal=null;new.discount=null;new.tax=null;new.total=null;new.subtotal_base=null;new.discount_base=null;new.tax_base=null;new.total_base=null;new.net_sales_base=null;new.cogs_base=null;new.gross_profit_base=null;new.line_count=null;new.units_sold=null;new.sale_date=null;new.occurred_at=null;new.payment_method=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_sale_lines' then new.item_name=null;new.item_sku=null;new.quantity=null;new.unit_price=null;new.line_subtotal=null;new.line_subtotal_base=null;new.unit_cost_base=null;new.cogs_base=null;new.gross_profit_base=null;
  elsif tg_table_name='business_documents' then new.title=null;new.category=null;new.description=null;new.original_filename=null;new.mime_type=null;new.expires_on=null;
  end if;
  return new;
end;$$;

do $$ declare t text; begin
  foreach t in array array['business_transactions','business_suppliers','business_cost_budgets','business_recurring_costs','business_supplier_invoices','business_inventory_items','business_inventory_movements','business_sales','business_sale_lines','business_documents','businesses','business_settings','business_cost_categories','business_cost_centres','business_inventory_categories','business_inventory_locations'] loop
    execute format('drop trigger if exists ficonter_business_zero_knowledge on public.%I',t);
    execute format('create trigger ficonter_business_zero_knowledge before insert or update on public.%I for each row execute function public.ficonter_enforce_business_private_row()',t);
  end loop;
end $$;

create or replace function public.create_business_workspace(p_name text,p_legal_name text default null,p_business_type text default 'Sole trader',p_country_code text default 'DE',p_base_currency text default 'EUR',p_fiscal_year_start_month integer default 1,p_timezone text default 'UTC')
returns uuid language plpgsql security definer set search_path='public' as $$
declare v_user_id uuid:=auth.uid();v_business_id uuid;v_timezone text:=coalesce(nullif(trim(p_timezone),''),'UTC');
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if char_length(trim(coalesce(p_name,'')))<2 then raise exception 'Enter a valid business name.'; end if;
  if char_length(upper(trim(coalesce(p_country_code,''))))<>2 then raise exception 'Country code must contain two letters.'; end if;
  if char_length(upper(trim(coalesce(p_base_currency,''))))<>3 then raise exception 'Base currency must contain three letters.'; end if;
  if p_fiscal_year_start_month not between 1 and 12 then raise exception 'Fiscal year start month must be between 1 and 12.'; end if;
  perform 1 from pg_timezone_names where name=v_timezone; if not found then raise exception 'Enter a valid timezone.'; end if;
  insert into public.businesses(owner_id,name,legal_name,business_type,country_code,base_currency,fiscal_year_start_month,status,timezone)
  values(v_user_id,trim(p_name),null,coalesce(nullif(trim(p_business_type),''),'Sole trader'),upper(coalesce(nullif(trim(p_country_code),''),'DE')),upper(coalesce(nullif(trim(p_base_currency),''),'EUR')),p_fiscal_year_start_month,'active',v_timezone)
  returning id into v_business_id;
  insert into public.business_members(business_id,user_id,role,status) values(v_business_id,v_user_id,'owner','active');
  insert into public.business_settings(business_id,default_timezone) values(v_business_id,v_timezone);
  insert into public.business_user_preferences(user_id,active_business_id) values(v_user_id,v_business_id)
  on conflict(user_id) do update set active_business_id=excluded.active_business_id,updated_at=now();
  return v_business_id;
end;$$;

create or replace function public.process_business_recurring_costs()
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
begin raise exception 'Legacy plaintext business recurring-cost processing is disabled.' using errcode='42501'; end;$$;

revoke all on public.business_inventory_item_balances from authenticated,anon;

do $$ declare r record; begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname=any(array[
    'create_business_document','update_business_document','delete_business_document','create_business_inventory_item','record_business_inventory_movement','reverse_business_inventory_movement',
    'record_business_sale','update_business_sale','refund_business_sale','delete_business_sale','restore_business_sale','record_business_supplier_invoice_payment','reverse_business_supplier_invoice_payment',
    'get_business_overview','get_business_profitability_report','update_business_administration_settings','update_business_workspace',
    'create_business_inventory_item_e2ee','record_business_inventory_movement_e2ee','reverse_business_inventory_movement_e2ee'])
  loop execute format('revoke all on function %s from authenticated,anon,public',r.oid::regprocedure); end loop;
end $$;

do $$ declare r record; begin
  for r in select p.oid,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_business_inventory_movement_e2ee_atomic' and p.prokind='f'
  loop if position('p_reversal_of_id uuid' in r.args)=0 then execute format('revoke all on function %s from authenticated,anon,public',r.oid::regprocedure); end if; end loop;
end $$;

revoke all on function public.ficonter_enforce_business_private_row() from authenticated,anon,public;
revoke all on function public.ficonter_sanitize_business_audit_log() from authenticated,anon,public;
