create or replace function public.ficonter_require_business_cost_category_ciphertext()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if new.encryption_version=1 and new.encrypted_payload is not null then
    new.name=null; new.description=null; new.default_nature=null; return new;
  end if;
  if new.name = any(array['Materials','Inventory purchases','Rent','Utilities','Payroll','Contractors','Marketing','Software','Insurance','Transport','Shipping','Equipment','Professional services','Taxes and fees','Bank fees','Travel','Other expense']) then
    new.description=null; return new;
  end if;
  raise exception 'Business cost category ciphertext is required.' using errcode='22023';
end;$$;

create or replace function public.ficonter_require_business_cost_centre_ciphertext()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if new.encryption_version=1 and new.encrypted_payload is not null then
    new.name=null; new.description=null; return new;
  end if;
  if new.name = any(array['General Operations','Administration','Sales & Marketing','Production / Delivery']) then
    new.description=null; return new;
  end if;
  raise exception 'Business cost centre ciphertext is required.' using errcode='22023';
end;$$;

create or replace function public.ficonter_require_business_inventory_category_ciphertext()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if new.encryption_version=1 and new.encrypted_payload is not null then
    new.name=null; new.description=null; return new;
  end if;
  if new.name = any(array['Finished goods','Raw materials','Components','Packaging','Business supplies','Other']) then
    new.description=null; return new;
  end if;
  raise exception 'Business inventory category ciphertext is required.' using errcode='22023';
end;$$;

create or replace function public.ficonter_require_business_inventory_location_ciphertext()
returns trigger language plpgsql set search_path='public','pg_temp' as $$
begin
  if new.encryption_version=1 and new.encrypted_payload is not null then
    new.name=null; new.description=null; return new;
  end if;
  if new.name='Main storage' then
    new.description=null; return new;
  end if;
  raise exception 'Business inventory location ciphertext is required.' using errcode='22023';
end;$$;

create or replace function public.business_seed_zero_knowledge_defaults_after_insert()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  insert into public.business_cost_categories (business_id,name,default_nature,is_active)
  select new.id, v.name, v.nature, true from (values
    ('Materials','variable'),('Inventory purchases','variable'),('Rent','fixed'),('Utilities','fixed'),('Payroll','fixed'),('Contractors','variable'),('Marketing','variable'),('Software','fixed'),('Insurance','fixed'),('Transport','variable'),('Shipping','variable'),('Equipment','variable'),('Professional services','variable'),('Taxes and fees','variable'),('Bank fees','variable'),('Travel','variable'),('Other expense','variable')) as v(name,nature);
  insert into public.business_cost_centres (business_id,name,is_active)
  select new.id, v.name, true from (values ('General Operations'),('Administration'),('Sales & Marketing'),('Production / Delivery')) as v(name);
  insert into public.business_inventory_categories (business_id,name,is_active)
  select new.id, v.name, true from (values ('Finished goods'),('Raw materials'),('Components'),('Packaging'),('Business supplies'),('Other')) as v(name);
  insert into public.business_inventory_locations (business_id,name,is_active) values(new.id,'Main storage',true);
  return new;
end;$$;

revoke execute on function public.business_seed_zero_knowledge_defaults_after_insert() from authenticated,anon,public,service_role;
drop trigger if exists business_zero_knowledge_defaults_after_insert on public.businesses;
create trigger business_zero_knowledge_defaults_after_insert after insert on public.businesses for each row execute function public.business_seed_zero_knowledge_defaults_after_insert();

insert into public.business_cost_categories (business_id,name,default_nature,is_active)
select b.id, v.name, v.nature, true from public.businesses b cross join (values
('Materials','variable'),('Inventory purchases','variable'),('Rent','fixed'),('Utilities','fixed'),('Payroll','fixed'),('Contractors','variable'),('Marketing','variable'),('Software','fixed'),('Insurance','fixed'),('Transport','variable'),('Shipping','variable'),('Equipment','variable'),('Professional services','variable'),('Taxes and fees','variable'),('Bank fees','variable'),('Travel','variable'),('Other expense','variable')) as v(name,nature)
where not exists (select 1 from public.business_cost_categories c where c.business_id=b.id and c.name=v.name);

insert into public.business_cost_centres (business_id,name,is_active)
select b.id,v.name,true from public.businesses b cross join (values ('General Operations'),('Administration'),('Sales & Marketing'),('Production / Delivery')) as v(name)
where not exists (select 1 from public.business_cost_centres c where c.business_id=b.id and c.name=v.name);

insert into public.business_inventory_categories (business_id,name,is_active)
select b.id,v.name,true from public.businesses b cross join (values ('Finished goods'),('Raw materials'),('Components'),('Packaging'),('Business supplies'),('Other')) as v(name)
where not exists (select 1 from public.business_inventory_categories c where c.business_id=b.id and c.name=v.name);

insert into public.business_inventory_locations (business_id,name,is_active)
select b.id,'Main storage',true from public.businesses b
where not exists (select 1 from public.business_inventory_locations l where l.business_id=b.id and l.name='Main storage');
