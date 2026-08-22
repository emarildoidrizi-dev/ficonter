begin;

alter table public.businesses add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_audit_log add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_cost_budgets add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_documents add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_inventory_categories add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_inventory_items add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_inventory_locations add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_inventory_movements add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_recurring_costs add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_sale_lines add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_sales add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_settings add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;
alter table public.business_supplier_invoices add column if not exists encrypted_payload jsonb, add column if not exists encryption_version smallint, add column if not exists e2ee_revision bigint not null default 0;

commit;
