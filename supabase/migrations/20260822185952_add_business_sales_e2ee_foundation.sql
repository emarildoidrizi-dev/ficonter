alter table public.business_sales
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_sale_lines
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_sales
  alter column sale_number drop not null,
  alter column currency drop not null,
  alter column exchange_rate_to_base drop not null,
  alter column subtotal drop not null,
  alter column discount drop not null,
  alter column tax drop not null,
  alter column total drop not null,
  alter column subtotal_base drop not null,
  alter column discount_base drop not null,
  alter column tax_base drop not null,
  alter column total_base drop not null,
  alter column net_sales_base drop not null,
  alter column cogs_base drop not null,
  alter column gross_profit_base drop not null,
  alter column line_count drop not null,
  alter column units_sold drop not null,
  alter column sale_date drop not null,
  alter column occurred_at drop not null;

alter table public.business_sale_lines
  alter column item_name drop not null,
  alter column quantity drop not null,
  alter column unit_price drop not null,
  alter column line_subtotal drop not null,
  alter column line_subtotal_base drop not null,
  alter column unit_cost_base drop not null,
  alter column cogs_base drop not null,
  alter column gross_profit_base drop not null;
