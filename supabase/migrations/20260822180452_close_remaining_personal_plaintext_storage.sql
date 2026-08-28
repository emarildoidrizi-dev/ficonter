begin;

update public.automatic_payment_runs
set amount = null, amount_eur = null, currency = null
where amount is not null or amount_eur is not null or currency is not null;

create or replace function public.ficonter_sanitize_automatic_payment_run()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.amount := null;
  new.amount_eur := null;
  new.currency := null;
  return new;
end;
$$;

drop trigger if exists automatic_payment_runs_sanitize_financial_values on public.automatic_payment_runs;
create trigger automatic_payment_runs_sanitize_financial_values
before insert or update on public.automatic_payment_runs
for each row execute function public.ficonter_sanitize_automatic_payment_run();

revoke all on table public.transaction_category_rules from authenticated;
revoke all on table public.statement_import_profiles from authenticated;
revoke all on table public.statement_import_batches from authenticated;
revoke all on table public.statement_import_items from authenticated;

commit;
