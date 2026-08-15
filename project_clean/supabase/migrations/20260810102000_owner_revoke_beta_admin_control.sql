-- FICONTER — Owner-only Beta revocation support.
-- Application authorization verifies that only the configured Owner may call
-- this RPC through the trusted server route. The RPC itself is service_role-only.
--
-- EFFECT FOR A NORMAL BETA CUSTOMER:
--   1) remove permanent Beta invitation entitlement proof
--   2) invalidate every active Beta browser/login session
--   3) return the subscription to Ficonter Free
--   4) create the admin audit record in the SAME transaction
--
-- Owner / Super Admin / Admin subscription exemptions are not changed here.

begin;

create or replace function public.owner_revoke_ficonter_beta_access(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_audit_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
  audit_id uuid;
begin
  if p_user_id is null or p_actor_user_id is null then
    raise exception 'INVALID_ARGUMENT' using errcode = 'P0001';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception 'ACTOR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select plan_code
    into current_plan
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if current_plan is distinct from 'beta' then
    raise exception 'TARGET_NOT_BETA' using errcode = 'P0001';
  end if;

  delete from public.beta_user_entitlements
  where user_id = p_user_id;

  delete from public.beta_login_sessions
  where user_id = p_user_id;

  update public.subscriptions
  set plan_code = 'free',
      status = 'active',
      billing_interval = null,
      provider = 'internal',
      current_period_start = null,
      current_period_end = null,
      cancel_at_period_end = false,
      updated_at = now()
  where user_id = p_user_id
    and plan_code = 'beta';

  if not found then
    raise exception 'BETA_REVOKE_RACE' using errcode = 'P0001';
  end if;

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_user_id,
    details
  )
  values (
    p_actor_user_id,
    'revoke_beta',
    p_user_id,
    coalesce(p_audit_details, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.owner_revoke_ficonter_beta_access(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.owner_revoke_ficonter_beta_access(uuid, uuid, jsonb)
  to service_role;

comment on function public.owner_revoke_ficonter_beta_access(uuid, uuid, jsonb) is
  'Trusted server RPC for Owner-approved Beta revocation. Atomically removes verified Beta entitlement/session state, restores Free, and audits the action.';

commit;
