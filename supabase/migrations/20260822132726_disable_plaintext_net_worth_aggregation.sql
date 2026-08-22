begin;

revoke all on function public.get_net_worth_growth_inputs() from public;
revoke all on function public.get_net_worth_growth_inputs() from anon;
revoke all on function public.get_net_worth_growth_inputs() from authenticated;

grant execute on function public.get_net_worth_growth_inputs() to postgres, service_role;

comment on function public.get_net_worth_growth_inputs() is
  'Legacy server-side Net Worth aggregation. Disabled for authenticated clients on the E2EE branch; Net Worth is derived from decrypted browser-vault sources.';

commit;
