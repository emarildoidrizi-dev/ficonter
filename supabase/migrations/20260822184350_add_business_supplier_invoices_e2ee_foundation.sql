alter table public.business_supplier_invoices
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0;

alter table public.business_supplier_invoices
  alter column invoice_number drop not null,
  alter column description drop not null,
  alter column category_name drop not null,
  alter column cost_nature drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  alter column amount_base drop not null,
  alter column exchange_rate_to_base drop not null,
  alter column issue_date drop not null,
  alter column due_date drop not null;

create or replace function public.record_business_supplier_invoice_payment_e2ee(
  p_invoice_id uuid,
  p_expected_revision bigint,
  p_invoice_payload jsonb,
  p_paid_at timestamptz,
  p_transaction_id uuid,
  p_transaction_payload jsonb
) returns jsonb
language plpgsql security definer
set search_path='public','auth','pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.business_supplier_invoices%rowtype;
  v_transaction public.business_transactions%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if p_invoice_payload is null or p_transaction_payload is null or p_transaction_id is null then raise exception 'Encrypted payment payloads are required.' using errcode='22023'; end if;
  select * into v_invoice from public.business_supplier_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Supplier invoice was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_invoice.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_invoice.encryption_version is distinct from 1 or v_invoice.encrypted_payload is null then raise exception 'Encrypted supplier invoice is required.' using errcode='22023'; end if;
  if v_invoice.e2ee_revision <> p_expected_revision then raise exception 'Supplier invoice changed. Refresh and try again.' using errcode='40001'; end if;
  if v_invoice.status='paid' then raise exception 'This supplier invoice is already paid.' using errcode='22023'; end if;
  if v_invoice.status='cancelled' then raise exception 'A cancelled supplier invoice cannot be paid.' using errcode='22023'; end if;
  insert into public.business_transactions(id,business_id,created_by,supplier_id,cost_category_id,cost_centre_id,source_supplier_invoice_id,encrypted_payload,encryption_version,e2ee_revision)
  values(p_transaction_id,v_invoice.business_id,v_user_id,v_invoice.supplier_id,v_invoice.category_id,v_invoice.cost_centre_id,v_invoice.id,p_transaction_payload,1,0)
  returning * into v_transaction;
  update public.business_supplier_invoices set encrypted_payload=p_invoice_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,status='paid',paid_at=coalesce(p_paid_at,now()),transaction_id=p_transaction_id,updated_at=now()
  where id=v_invoice.id returning * into v_invoice;
  return jsonb_build_object('invoice',to_jsonb(v_invoice),'transaction',to_jsonb(v_transaction));
end;$$;

create or replace function public.reverse_business_supplier_invoice_payment_e2ee(
  p_invoice_id uuid,
  p_expected_revision bigint
) returns jsonb
language plpgsql security definer
set search_path='public','auth','pg_temp'
as $$
declare v_user_id uuid:=auth.uid(); v_invoice public.business_supplier_invoices%rowtype; v_transaction_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into v_invoice from public.business_supplier_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Supplier invoice was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_invoice.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_invoice.encryption_version is distinct from 1 or v_invoice.encrypted_payload is null then raise exception 'Encrypted supplier invoice is required.' using errcode='22023'; end if;
  if v_invoice.e2ee_revision <> p_expected_revision then raise exception 'Supplier invoice changed. Refresh and try again.' using errcode='40001'; end if;
  if v_invoice.status <> 'paid' then raise exception 'Only a paid supplier invoice can be reversed.' using errcode='22023'; end if;
  v_transaction_id:=v_invoice.transaction_id;
  if v_transaction_id is not null then delete from public.business_transactions where id=v_transaction_id and business_id=v_invoice.business_id; end if;
  update public.business_supplier_invoices set status='open',paid_at=null,transaction_id=null,e2ee_revision=e2ee_revision+1,updated_at=now() where id=v_invoice.id returning * into v_invoice;
  return jsonb_build_object('invoice',to_jsonb(v_invoice),'deleted_transaction_id',v_transaction_id);
end;$$;

revoke all on function public.record_business_supplier_invoice_payment_e2ee(uuid,bigint,jsonb,timestamptz,uuid,jsonb) from public,anon;
grant execute on function public.record_business_supplier_invoice_payment_e2ee(uuid,bigint,jsonb,timestamptz,uuid,jsonb) to authenticated;
revoke all on function public.reverse_business_supplier_invoice_payment_e2ee(uuid,bigint) from public,anon;
grant execute on function public.reverse_business_supplier_invoice_payment_e2ee(uuid,bigint) to authenticated;
