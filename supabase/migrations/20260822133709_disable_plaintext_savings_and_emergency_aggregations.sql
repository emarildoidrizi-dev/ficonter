begin;

revoke all on function public.get_savings_intelligence_inputs() from public, anon, authenticated;
revoke all on function public.get_emergency_fund_intelligence_inputs() from public, anon, authenticated;
grant execute on function public.get_savings_intelligence_inputs() to postgres, service_role;
grant execute on function public.get_emergency_fund_intelligence_inputs() to postgres, service_role;

comment on function public.get_savings_intelligence_inputs() is
  'Legacy server-side Savings aggregation. Disabled for authenticated clients on the E2EE branch; Savings Intelligence is derived from decrypted browser-vault sources.';
comment on function public.get_emergency_fund_intelligence_inputs() is
  'Legacy server-side Emergency Fund aggregation. Disabled for authenticated clients on the E2EE branch; Emergency Fund Intelligence is derived from decrypted browser-vault sources.';

commit;
