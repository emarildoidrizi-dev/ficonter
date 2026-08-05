# FICONTER live schema reconciliation and hardening plan

**Reconciliation date:** 5 August 2026  
**Application source:** `ficonter-main(1).zip`  
**Live database source:** `ficonter-live-supabase-schema.zip`

## Reconciliation result

The live Supabase export is structurally complete for the current application:

- 45 RPC names are referenced by the audited source and every one exists live.
- 42 public table/view names are referenced by the source and every one exists live.
- Two additional `.from()` names are Storage buckets, not SQL relations.
- The live public schema contains 50 tables, 1 view and 109 functions.

The earlier audit finding was a **repository-source gap**, not a missing-live-database failure. The live database contains the Business, Inventory, Sales, Supplier, Usage and Administration objects that the legacy `supabase/*.sql` folder did not capture.

## Repository drift confirmed

Before this hardening package, the standalone SQL files were missing:

- 38 functions that exist in Production;
- 14 tables/views that exist in Production.

The missing source includes the Business document, inventory, sales, supplier, workspace and platform-usage database layers.

The repository also contained `mark_bill_unpaid`, but that function was not present in the live export. This package adds it as the first reviewed post-baseline migration.

## Changes prepared in this package

1. Adds the exact schema-only Production export as the ordered migration baseline.
2. Adds generated Supabase TypeScript database types.
3. Types the browser, server, proxy and service-role Supabase clients against the live database contract.
4. Adds a database-contract verifier that checks every literal `.from()` and `.rpc()` dependency.
5. Adds a GitHub quality gate for verification, lint and build.
6. Adds `.nvmrc` and `.env.example`.
7. Adds Bills **Mark unpaid** with an authenticated atomic RPC and a guarded fallback.
8. Preserves aggregate Cash Flow commitments when detailed commitment rows are temporarily absent.
9. Updates stale verification rules to match the current shared realtime and interface architecture.
10. Brings the complete release-candidate gate to **34 passing suites**.

## Safety boundaries

- The Production baseline must not be run against the existing live project.
- Only `20260805000100_bill_paid_unpaid_reversal.sql` is intended for the existing Production database in this stage.
- The installer pushes a Preview branch only and does not merge to `main`.
- No customer table data is included in the baseline or types export.
- No existing customer records are changed by installing the source package.

## Still outstanding

A dependency lockfile is still required for fully reproducible installs. It could not be generated in the isolated audit environment because its package registry did not contain `@supabase/ssr`. The included GitHub quality gate installs from the normal npm registry and will validate the Preview branch. A lockfile should be generated and committed after that first green CI run.

## Live functions recovered into source

- `admin_usage_directory`
- `admin_usage_overview`
- `archive_business_workspace`
- `business_capture_audit_change`
- `business_capture_document_audit`
- `business_documents_touch_updated_at`
- `business_inventory_item_before_write`
- `business_inventory_master_before_write`
- `business_inventory_seed_after_business`
- `business_sale_before_write`
- `business_supplier_before_write`
- `business_supplier_invoice_before_write`
- `business_user_preference_touch_updated_at`
- `business_workspace_has_financial_activity`
- `create_business_document`
- `create_business_inventory_item`
- `delete_business_document`
- `delete_business_sale`
- `delete_business_workspace`
- `get_business_profitability_report`
- `get_cash_flow_intelligence_inputs_v2_base`
- `platform_usage_is_admin`
- `record_business_inventory_movement`
- `record_business_sale`
- `record_business_supplier_invoice_payment`
- `record_debt_payment_with_transaction`
- `record_platform_usage_heartbeat`
- `refund_business_sale`
- `restore_business_sale`
- `restore_business_workspace`
- `reverse_business_inventory_movement`
- `reverse_business_supplier_invoice_payment`
- `seed_business_inventory_defaults`
- `set_active_business_workspace`
- `update_business_administration_settings`
- `update_business_document`
- `update_business_sale`
- `update_business_workspace`

## Live tables/views recovered into source

- `business_audit_log`
- `business_documents`
- `business_inventory_categories`
- `business_inventory_item_balances`
- `business_inventory_items`
- `business_inventory_locations`
- `business_inventory_movements`
- `business_sale_lines`
- `business_sales`
- `business_supplier_invoices`
- `business_suppliers`
- `business_user_preferences`
- `platform_usage_daily`
- `platform_usage_presence`
