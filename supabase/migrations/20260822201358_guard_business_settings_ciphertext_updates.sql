create or replace function public.ficonter_protect_business_settings_ciphertext()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if new.encryption_version=1 and new.encrypted_payload is not null then
    new.default_timezone=null;
    new.date_format=null;
    new.number_format=null;
    new.default_payment_method=null;
    new.default_payment_terms_days=null;
    new.default_sales_tax_rate=null;
    new.invoice_prefix=null;
    new.next_invoice_number=null;
    new.default_low_stock_threshold=null;
    return new;
  end if;

  -- create_business_workspace inserts one operational default row before the
  -- browser creates the Business Vault. Any later update must be ciphertext.
  if tg_op='INSERT' then
    if coalesce(new.default_timezone,'UTC') <> 'UTC'
       and new.default_timezone is distinct from (select timezone from public.businesses where id=new.business_id) then
      raise exception 'Business settings must be encrypted after workspace creation.' using errcode='22023';
    end if;
    return new;
  end if;

  raise exception 'Business settings updates require ciphertext.' using errcode='22023';
end;$$;

drop trigger if exists ficonter_protect_business_settings_ciphertext on public.business_settings;
create trigger ficonter_protect_business_settings_ciphertext
before insert or update on public.business_settings
for each row execute function public.ficonter_protect_business_settings_ciphertext();

revoke all on function public.ficonter_protect_business_settings_ciphertext() from authenticated,anon,public;
