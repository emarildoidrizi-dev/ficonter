begin;
revoke execute on function public.get_cash_flow_intelligence_inputs_v2() from authenticated;
revoke execute on function public.get_cash_flow_intelligence_inputs_v2_base() from authenticated;
commit;
