-- Account deletion hardening
-- Customer-owned records continue to cascade through auth.users/business ownership.
-- Shared business and recovery audit attribution is anonymized instead of
-- blocking deletion of the referenced user account.

alter table public.business_documents alter column uploaded_by drop not null;
alter table public.business_documents drop constraint if exists business_documents_uploaded_by_fkey;
alter table public.business_documents add constraint business_documents_uploaded_by_fkey foreign key (uploaded_by) references auth.users(id) on delete set null;

alter table public.business_inventory_items alter column created_by drop not null;
alter table public.business_inventory_items drop constraint if exists business_inventory_items_created_by_fkey;
alter table public.business_inventory_items add constraint business_inventory_items_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.business_inventory_movements alter column created_by drop not null;
alter table public.business_inventory_movements drop constraint if exists business_inventory_movements_created_by_fkey;
alter table public.business_inventory_movements add constraint business_inventory_movements_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.business_recurring_costs alter column created_by drop not null;
alter table public.business_recurring_costs drop constraint if exists business_recurring_costs_created_by_fkey;
alter table public.business_recurring_costs add constraint business_recurring_costs_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.business_sales alter column created_by drop not null;
alter table public.business_sales drop constraint if exists business_sales_created_by_fkey;
alter table public.business_sales add constraint business_sales_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.business_supplier_invoices alter column created_by drop not null;
alter table public.business_supplier_invoices drop constraint if exists business_supplier_invoices_created_by_fkey;
alter table public.business_supplier_invoices add constraint business_supplier_invoices_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.business_suppliers alter column created_by drop not null;
alter table public.business_suppliers drop constraint if exists business_suppliers_created_by_fkey;
alter table public.business_suppliers add constraint business_suppliers_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.business_transactions alter column created_by drop not null;
alter table public.business_transactions drop constraint if exists business_transactions_created_by_fkey;
alter table public.business_transactions add constraint business_transactions_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.vault_recovery_access_grants alter column issued_by drop not null;
alter table public.vault_recovery_access_grants drop constraint if exists vault_recovery_access_grants_issued_by_fkey;
alter table public.vault_recovery_access_grants add constraint vault_recovery_access_grants_issued_by_fkey foreign key (issued_by) references auth.users(id) on delete set null;

alter table public.vault_recovery_documents alter column generated_by drop not null;
alter table public.vault_recovery_documents drop constraint if exists vault_recovery_documents_generated_by_fkey;
alter table public.vault_recovery_documents add constraint vault_recovery_documents_generated_by_fkey foreign key (generated_by) references auth.users(id) on delete set null;

alter table public.vault_recovery_documents drop constraint if exists vault_recovery_documents_signed_uploaded_by_fkey;
alter table public.vault_recovery_documents add constraint vault_recovery_documents_signed_uploaded_by_fkey foreign key (signed_uploaded_by) references auth.users(id) on delete set null;

alter table public.vault_recovery_requests alter column created_by drop not null;
alter table public.vault_recovery_requests drop constraint if exists vault_recovery_requests_created_by_fkey;
alter table public.vault_recovery_requests add constraint vault_recovery_requests_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.vault_recovery_requests drop constraint if exists vault_recovery_requests_approved_by_fkey;
alter table public.vault_recovery_requests add constraint vault_recovery_requests_approved_by_fkey foreign key (approved_by) references auth.users(id) on delete set null;

alter table public.vault_recovery_requests drop constraint if exists vault_recovery_requests_verification_started_by_fkey;
alter table public.vault_recovery_requests add constraint vault_recovery_requests_verification_started_by_fkey foreign key (verification_started_by) references auth.users(id) on delete set null;

alter table public.vault_recovery_requests drop constraint if exists vault_recovery_requests_verified_by_fkey;
alter table public.vault_recovery_requests add constraint vault_recovery_requests_verified_by_fkey foreign key (verified_by) references auth.users(id) on delete set null;
