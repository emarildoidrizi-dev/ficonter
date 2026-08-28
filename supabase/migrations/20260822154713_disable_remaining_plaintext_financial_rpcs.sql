begin;

revoke execute on function public.get_financial_health_inputs() from public, anon, authenticated;
grant execute on function public.get_financial_health_inputs() to postgres, service_role;

revoke execute on function public.import_statement_transactions(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.import_statement_transactions(text,jsonb,jsonb) to postgres, service_role;

revoke execute on function public.mark_bill_paid(uuid,timestamptz,date) from public, anon, authenticated;
grant execute on function public.mark_bill_paid(uuid,timestamptz,date) to postgres, service_role;

revoke execute on function public.record_bill_payment_and_advance(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.record_bill_payment_and_advance(uuid,timestamptz) to postgres, service_role;

commit;
