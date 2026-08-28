-- Final Business Workspace zero-knowledge enforcement.
-- Operational linkage/status fields remain readable; private content must be Business Vault ciphertext.

alter table public.business_transactions
  alter column description drop not null, alter column type drop not null,
  alter column category drop not null, alter column amount drop not null,
  alter column currency drop not null, alter column amount_base drop not null,
  alter column transaction_date drop not null, alter column occurred_at drop not null;
alter table public.business_cost_categories alter column name drop not null;
alter table public.business_cost_centres alter column name drop not null;
alter table public.business_suppliers alter column name drop not null;
alter table public.business_cost_budgets alter column amount_base drop not null;
alter table public.business_recurring_costs
  alter column name drop not null, alter column category_name drop not null,
  alter column cost_nature drop not null, alter column amount drop not null,
  alter column currency drop not null, alter column amount_base drop not null;
alter table public.business_supplier_invoices
  alter column invoice_number drop not null, alter column description drop not null,
  alter column category_name drop not null, alter column cost_nature drop not null,
  alter column amount drop not null, alter column currency drop not null,
  alter column amount_base drop not null, alter column issue_date drop not null,
  alter column due_date drop not null;
alter table public.business_inventory_categories alter column name drop not null;
alter table public.business_inventory_locations alter column name drop not null;
alter table public.business_inventory_items
  alter column name drop not null, alter column sku drop not null, alter column unit drop not null,
  alter column low_stock_threshold drop not null, alter column default_purchase_cost drop not null,
  alter column default_purchase_currency drop not null, alter column default_purchase_cost_base drop not null,
  alter column default_exchange_rate_to_base drop not null, alter column selling_price_base drop not null;
alter table public.business_inventory_movements
  alter column item_name drop not null, alter column item_sku drop not null,
  alter column movement_type drop not null, alter column quantity_delta drop not null,
  alter column unit_cost drop not null, alter column currency drop not null,
  alter column unit_cost_base drop not null, alter column inventory_value_delta_base drop not null,
  alter column exchange_rate_to_base drop not null, alter column movement_date drop not null,
  alter column occurred_at drop not null;
alter table public.business_sales
  alter column sale_number drop not null, alter column currency drop not null,
  alter column exchange_rate_to_base drop not null, alter column subtotal drop not null,
  alter column discount drop not null, alter column tax drop not null, alter column total drop not null,
  alter column subtotal_base drop not null, alter column discount_base drop not null,
  alter column tax_base drop not null, alter column total_base drop not null,
  alter column net_sales_base drop not null, alter column cogs_base drop not null,
  alter column gross_profit_base drop not null, alter column line_count drop not null,
  alter column units_sold drop not null, alter column sale_date drop not null,
  alter column occurred_at drop not null;
alter table public.business_sale_lines
  alter column item_name drop not null, alter column quantity drop not null,
  alter column unit_price drop not null, alter column line_subtotal drop not null,
  alter column line_subtotal_base drop not null, alter column unit_cost_base drop not null,
  alter column cogs_base drop not null, alter column gross_profit_base drop not null;

create or replace function public.ficonter_enforce_business_private_row()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if tg_table_name='businesses' then
    if new.encryption_version=1 and new.encrypted_payload is not null then
      new.legal_name=null; new.tax_id=null; new.contact_email=null; new.contact_phone=null;
      new.website=null; new.address_line1=null; new.address_line2=null; new.city=null; new.postal_code=null;
    elsif new.legal_name is not null or new.tax_id is not null or new.contact_email is not null
       or new.contact_phone is not null or new.website is not null or new.address_line1 is not null
       or new.address_line2 is not null or new.city is not null or new.postal_code is not null then
      raise exception 'Private business profile fields require Business Vault ciphertext.' using errcode='22023';
    end if;
    return new;
  end if;

  if tg_table_name='business_settings' then
    if new.encryption_version=1 and new.encrypted_payload is not null then
      new.default_timezone=null; new.date_format=null; new.number_format=null;
      new.default_payment_method=null; new.default_payment_terms_days=null;
      new.default_sales_tax_rate=null; new.invoice_prefix=null; new.next_invoice_number=null;
      new.default_low_stock_threshold=null;
    end if;
    return new;
  end if;

  if new.encryption_version is distinct from 1 or new.encrypted_payload is null then
    raise exception 'Business Vault ciphertext is required for %.',tg_table_name using errcode='22023';
  end if;

  if tg_table_name='business_transactions' then
    new.description=null;new.counterparty=null;new.type=null;new.category=null;new.cost_nature=null;
    new.amount=null;new.currency=null;new.amount_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;
    new.exchange_rate_source=null;new.transaction_date=null;new.occurred_at=null;new.payment_method=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_cost_categories' then
    new.name=null;new.description=null;new.default_nature=null;
  elsif tg_table_name='business_cost_centres' then
    new.name=null;new.description=null;
  elsif tg_table_name='business_suppliers' then
    new.name=null;new.legal_name=null;new.supplier_code=null;new.category=null;new.contact_name=null;
    new.email=null;new.phone=null;new.website=null;new.tax_id=null;new.payment_terms_days=null;new.default_currency=null;
    new.address_line1=null;new.address_line2=null;new.city=null;new.postal_code=null;new.country_code=null;new.notes=null;
  elsif tg_table_name='business_cost_budgets' then
    new.amount_base=null;new.notes=null;
  elsif tg_table_name='business_recurring_costs' then
    new.name=null;new.supplier=null;new.category_name=null;new.cost_nature=null;new.amount=null;new.currency=null;
    new.amount_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;new.exchange_rate_source=null;
    new.payment_method=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_supplier_invoices' then
    new.invoice_number=null;new.description=null;new.category_name=null;new.cost_nature=null;new.amount=null;new.currency=null;
    new.amount_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;new.exchange_rate_source=null;
    new.issue_date=null;new.due_date=null;new.payment_method=null;new.notes=null;
  elsif tg_table_name='business_inventory_categories' then
    new.name=null;new.description=null;
  elsif tg_table_name='business_inventory_locations' then
    new.name=null;new.description=null;
  elsif tg_table_name='business_inventory_items' then
    new.name=null;new.sku=null;new.barcode=null;new.unit=null;new.low_stock_threshold=null;new.default_purchase_cost=null;
    new.default_purchase_currency=null;new.default_purchase_cost_base=null;new.default_exchange_rate_to_base=null;
    new.selling_price_base=null;new.notes=null;
  elsif tg_table_name='business_inventory_movements' then
    new.item_name=null;new.item_sku=null;new.movement_type=null;new.quantity_delta=null;new.unit_cost=null;new.currency=null;
    new.unit_cost_base=null;new.inventory_value_delta_base=null;new.exchange_rate_to_base=null;new.exchange_rate_date=null;
    new.exchange_rate_source=null;new.supplier_name=null;new.movement_date=null;new.occurred_at=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_sales' then
    new.sale_number=null;new.customer_name=null;new.customer_email=null;new.currency=null;new.exchange_rate_to_base=null;
    new.exchange_rate_date=null;new.exchange_rate_source=null;new.subtotal=null;new.discount=null;new.tax=null;new.total=null;
    new.subtotal_base=null;new.discount_base=null;new.tax_base=null;new.total_base=null;new.net_sales_base=null;
    new.cogs_base=null;new.gross_profit_base=null;new.line_count=null;new.units_sold=null;new.sale_date=null;
    new.occurred_at=null;new.payment_method=null;new.reference=null;new.notes=null;
  elsif tg_table_name='business_sale_lines' then
    new.item_name=null;new.item_sku=null;new.quantity=null;new.unit_price=null;new.line_subtotal=null;
    new.line_subtotal_base=null;new.unit_cost_base=null;new.cogs_base=null;new.gross_profit_base=null;
  elsif tg_table_name='business_documents' then
    new.title=null;new.category=null;new.description=null;new.original_filename=null;new.mime_type=null;new.expires_on=null;
  end if;
  return new;
end;$$;

-- Existing ficonter_business_zero_knowledge triggers from the prior hardening migration
-- now use the stricter function above. Also remove direct access to the obsolete plaintext view.
revoke all on public.business_inventory_item_balances from authenticated,anon;

-- Retire every plaintext business RPC for every role, including service_role.
do $$ declare r record; begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.proname=any(array[
      'get_business_profitability_report','record_business_sale','update_business_sale','refund_business_sale',
      'delete_business_sale','restore_business_sale','create_business_inventory_item','record_business_inventory_movement',
      'reverse_business_inventory_movement','record_business_supplier_invoice_payment','reverse_business_supplier_invoice_payment',
      'process_business_recurring_costs','update_business_workspace','update_business_administration_settings',
      'create_business_document','update_business_document','delete_business_document'])
  loop
    execute format('revoke execute on function %s from authenticated,anon,public,service_role',r.signature);
  end loop;
end$$;
