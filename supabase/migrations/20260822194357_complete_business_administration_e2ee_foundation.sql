alter table public.business_settings
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0,
  alter column default_timezone drop not null,
  alter column date_format drop not null,
  alter column number_format drop not null,
  alter column default_payment_method drop not null,
  alter column default_payment_terms_days drop not null,
  alter column default_sales_tax_rate drop not null,
  alter column invoice_prefix drop not null,
  alter column next_invoice_number drop not null,
  alter column default_low_stock_threshold drop not null;

alter table public.business_documents
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0,
  alter column title drop not null,
  alter column category drop not null,
  alter column original_filename drop not null,
  alter column mime_type drop not null,
  alter column file_size drop not null;

alter table public.business_audit_log
  add column if not exists encrypted_payload jsonb,
  add column if not exists encryption_version smallint,
  add column if not exists e2ee_revision bigint not null default 0,
  alter column actor_label drop not null,
  alter column summary drop not null,
  alter column metadata drop not null;

create or replace function public.update_business_workspace_e2ee(
  p_business_id uuid,p_name text,p_business_type text,p_country_code text,p_base_currency text,
  p_fiscal_year_start_month smallint,p_timezone text,p_logo_path text,p_cover_image_path text,
  p_encrypted_payload jsonb,p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_row public.businesses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if not public.business_member_can_manage(p_business_id) then raise exception 'Business management access is required.' using errcode='42501'; end if;
  if p_encrypted_payload is null then raise exception 'Encrypted business profile payload is required.' using errcode='22023'; end if;
  select * into v_row from public.businesses where id=p_business_id for update;
  if not found then raise exception 'Business was not found.' using errcode='P0002'; end if;
  if v_row.e2ee_revision<>p_expected_revision then raise exception 'Business profile changed. Refresh and try again.' using errcode='40001'; end if;
  update public.businesses set name=p_name,business_type=p_business_type,country_code=upper(p_country_code),base_currency=upper(p_base_currency),
    fiscal_year_start_month=p_fiscal_year_start_month,timezone=p_timezone,logo_path=p_logo_path,cover_image_path=p_cover_image_path,
    legal_name=null,tax_id=null,contact_email=null,contact_phone=null,website=null,address_line1=null,address_line2=null,city=null,postal_code=null,
    encrypted_payload=p_encrypted_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,updated_at=now()
  where id=p_business_id returning * into v_row;
  return to_jsonb(v_row);
end;$$;

create or replace function public.update_business_administration_settings_e2ee(
  p_business_id uuid,p_encrypted_payload jsonb,p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_row public.business_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if not public.business_member_can_manage(p_business_id) then raise exception 'Business management access is required.' using errcode='42501'; end if;
  if p_encrypted_payload is null then raise exception 'Encrypted settings payload is required.' using errcode='22023'; end if;
  select * into v_row from public.business_settings where business_id=p_business_id for update;
  if not found then
    insert into public.business_settings(business_id,encrypted_payload,encryption_version,e2ee_revision) values(p_business_id,p_encrypted_payload,1,0) returning * into v_row;
  else
    if v_row.e2ee_revision<>p_expected_revision then raise exception 'Business settings changed. Refresh and try again.' using errcode='40001'; end if;
    update public.business_settings set default_timezone=null,date_format=null,number_format=null,default_payment_method=null,default_payment_terms_days=null,
      default_sales_tax_rate=null,invoice_prefix=null,next_invoice_number=null,default_low_stock_threshold=null,
      encrypted_payload=p_encrypted_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,updated_at=now()
    where business_id=p_business_id returning * into v_row;
  end if;
  return to_jsonb(v_row);
end;$$;

create or replace function public.create_business_document_e2ee(
  p_document_id uuid,p_business_id uuid,p_file_path text,p_ciphertext_size bigint,p_encrypted_payload jsonb
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_row public.business_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if not public.business_member_can_write(p_business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if p_document_id is null or p_encrypted_payload is null or nullif(trim(p_file_path),'') is null then raise exception 'Encrypted document data is required.' using errcode='22023'; end if;
  insert into public.business_documents(id,business_id,uploaded_by,file_path,file_size,encrypted_payload,encryption_version,e2ee_revision)
  values(p_document_id,p_business_id,auth.uid(),p_file_path,p_ciphertext_size,p_encrypted_payload,1,0) returning * into v_row;
  return to_jsonb(v_row);
end;$$;

create or replace function public.update_business_document_e2ee(
  p_document_id uuid,p_encrypted_payload jsonb,p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_row public.business_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into v_row from public.business_documents where id=p_document_id for update;
  if not found then raise exception 'Business document was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_row.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  if v_row.e2ee_revision<>p_expected_revision then raise exception 'Business document changed. Refresh and try again.' using errcode='40001'; end if;
  update public.business_documents set title=null,category=null,description=null,original_filename=null,mime_type=null,expires_on=null,
    encrypted_payload=p_encrypted_payload,encryption_version=1,e2ee_revision=e2ee_revision+1,updated_at=now()
  where id=p_document_id returning * into v_row;
  return to_jsonb(v_row);
end;$$;

create or replace function public.delete_business_document_e2ee(p_document_id uuid)
returns jsonb language plpgsql security definer set search_path='public','auth','pg_temp' as $$
declare v_row public.business_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into v_row from public.business_documents where id=p_document_id for update;
  if not found then raise exception 'Business document was not found.' using errcode='P0002'; end if;
  if not public.business_member_can_write(v_row.business_id) then raise exception 'Business write access is required.' using errcode='42501'; end if;
  delete from public.business_documents where id=p_document_id;
  return jsonb_build_object('id',v_row.id,'file_path',v_row.file_path,'encrypted_payload',v_row.encrypted_payload,'encryption_version',v_row.encryption_version);
end;$$;

create or replace function public.ficonter_sanitize_business_audit_log()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if new.encryption_version=1 and new.encrypted_payload is not null then
    new.actor_label=null;new.summary=null;new.metadata=null;
  else
    new.actor_label='System';new.summary='Business activity';new.metadata='{}'::jsonb;
  end if;
  return new;
end;$$;
drop trigger if exists ficonter_sanitize_business_audit_log on public.business_audit_log;
create trigger ficonter_sanitize_business_audit_log before insert or update on public.business_audit_log for each row execute function public.ficonter_sanitize_business_audit_log();

do $$ declare r record; begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['update_business_workspace_e2ee','update_business_administration_settings_e2ee','create_business_document_e2ee','update_business_document_e2ee','delete_business_document_e2ee']) loop
   execute format('revoke all on function %s from public,anon',r.oid::regprocedure);
   execute format('grant execute on function %s to authenticated',r.oid::regprocedure);
 end loop;
end $$;
