begin;

revoke execute on function public.record_credit_card_activity(uuid,text,text,numeric,numeric,numeric,timestamptz,text) from public, anon, authenticated;
revoke execute on function public.record_credit_card_payment(uuid,numeric,numeric,numeric,timestamptz,text,date) from public, anon, authenticated;
revoke execute on function public.record_debt_payment(uuid,numeric,numeric,numeric,timestamptz,text,uuid) from public, anon, authenticated;
revoke execute on function public.record_debt_payment_atomic(uuid,numeric,numeric,numeric,timestamptz,text,date) from public, anon, authenticated;
revoke execute on function public.record_debt_payment_with_transaction(uuid,numeric,numeric,numeric,timestamptz,date,text) from public, anon, authenticated;
revoke execute on function public.reverse_credit_card_activity(uuid) from public, anon, authenticated;
revoke execute on function public.reverse_debt_payment(uuid) from public, anon, authenticated;
revoke execute on function public.save_credit_card_monthly_record(uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric) from public, anon, authenticated;
revoke execute on function public.update_credit_card_statement(uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric) from public, anon, authenticated;

grant execute on function public.record_credit_card_activity(uuid,text,text,numeric,numeric,numeric,timestamptz,text) to postgres, service_role;
grant execute on function public.record_credit_card_payment(uuid,numeric,numeric,numeric,timestamptz,text,date) to postgres, service_role;
grant execute on function public.record_debt_payment(uuid,numeric,numeric,numeric,timestamptz,text,uuid) to postgres, service_role;
grant execute on function public.record_debt_payment_atomic(uuid,numeric,numeric,numeric,timestamptz,text,date) to postgres, service_role;
grant execute on function public.record_debt_payment_with_transaction(uuid,numeric,numeric,numeric,timestamptz,date,text) to postgres, service_role;
grant execute on function public.reverse_credit_card_activity(uuid) to postgres, service_role;
grant execute on function public.reverse_debt_payment(uuid) to postgres, service_role;
grant execute on function public.save_credit_card_monthly_record(uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric) to postgres, service_role;
grant execute on function public.update_credit_card_statement(uuid,numeric,numeric,numeric,date,date,numeric,numeric,numeric,numeric,numeric) to postgres, service_role;

commit;
