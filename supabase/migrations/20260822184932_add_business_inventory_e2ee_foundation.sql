alter table public.business_inventory_categories
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_inventory_locations
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_inventory_items
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_inventory_movements
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_inventory_categories alter column name drop not null;
alter table public.business_inventory_locations alter column name drop not null;
alter table public.business_inventory_items
  alter column name drop not null,
  alter column sku drop not null,
  alter column unit drop not null,
  alter column low_stock_threshold drop not null,
  alter column default_purchase_cost drop not null,
  alter column default_purchase_currency drop not null,
  alter column default_purchase_cost_base drop not null,
  alter column default_exchange_rate_to_base drop not null,
  alter column selling_price_base drop not null;
alter table public.business_inventory_movements
  alter column item_name drop not null,
  alter column item_sku drop not null,
  alter column movement_type drop not null,
  alter column quantity_delta drop not null,
  alter column unit_cost drop not null,
  alter column currency drop not null,
  alter column unit_cost_base drop not null,
  alter column inventory_value_delta_base drop not null,
  alter column exchange_rate_to_base drop not null,
  alter column movement_date drop not null,
  alter column occurred_at drop not null;
