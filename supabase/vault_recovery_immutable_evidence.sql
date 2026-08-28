-- FICONTER Vault recovery evidence hardening
-- Signed consent evidence and recovery audit history are immutable.

create or replace function public.protect_vault_recovery_audit_append_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Vault recovery audit records are append-only and cannot be modified or deleted.';
end;
$$;

drop trigger if exists trg_vault_recovery_audit_append_only on public.vault_recovery_case_audit;
create trigger trg_vault_recovery_audit_append_only
before update or delete on public.vault_recovery_case_audit
for each row execute function public.protect_vault_recovery_audit_append_only();

create or replace function public.protect_signed_vault_recovery_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(old.customer_signed_at, old.signed_at, old.signed_uploaded_at) is not null then
      raise exception 'Signed Vault recovery consent evidence cannot be deleted.';
    end if;
    return old;
  end if;

  if coalesce(old.customer_signed_at, old.signed_at, old.signed_uploaded_at) is not null
     and new is distinct from old then
    raise exception 'Signed Vault recovery consent evidence is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_signed_vault_recovery_document on public.vault_recovery_documents;
create trigger trg_protect_signed_vault_recovery_document
before update or delete on public.vault_recovery_documents
for each row execute function public.protect_signed_vault_recovery_document();

create or replace function public.protect_vault_recovery_request_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved','recovery_issued','completed')
       or exists (
         select 1 from public.vault_recovery_documents d
         where d.recovery_request_id = old.id
           and coalesce(d.customer_signed_at, d.signed_at, d.signed_uploaded_at) is not null
       ) then
      raise exception 'Signed, approved, or completed Vault recovery records cannot be deleted.';
    end if;
    return old;
  end if;

  if old.status = 'completed' and new.status is distinct from old.status then
    raise exception 'Completed Vault recovery status is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_vault_recovery_request_record on public.vault_recovery_requests;
create trigger trg_protect_vault_recovery_request_record
before update or delete on public.vault_recovery_requests
for each row execute function public.protect_vault_recovery_request_record();
