-- FICONTER role-boundary hardening
-- 1) Remove anonymous/public policy exposure from private customer data tables.
-- 2) Move portable backup restore behind a short-lived Owner authorization ticket.
-- 3) Keep the large restore payload on the Supabase RPC path while making the
--    authorization decision on the trusted FICONTER server.

begin;

-- Private application data is never intended for anonymous sessions. Existing
-- ownership predicates are preserved; only the policy target role is narrowed.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and roles = array['public']::name[]
      and tablename = any (array[
        'transactions',
        'bills',
        'goals',
        'goal_investments',
        'debts',
        'debt_payments',
        'credit_card_activities',
        'credit_card_monthly_records',
        'monthly_budget_plans',
        'monthly_budget_items',
        'profiles',
        'automatic_payment_runs',
        'money_entry_preferences',
        'statement_import_batches',
        'statement_import_items',
        'statement_import_profiles',
        'transaction_category_rules',
        'transaction_template_postings',
        'transaction_templates',
        'user_business_keypairs',
        'business_recurring_cost_runs',
        'business_vault_member_keys',
        'business_vaults'
      ])
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end;
$$;

-- Short-lived, one-time authorization tickets are issued only by the trusted
-- server after it has verified the configured FICONTER Owner account.
create table if not exists public.owner_backup_restore_authorizations (
  token uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint owner_backup_restore_authorizations_expiry_check
    check (expires_at > created_at)
);

create index if not exists owner_backup_restore_authorizations_user_expiry_idx
  on public.owner_backup_restore_authorizations(user_id, expires_at);

alter table public.owner_backup_restore_authorizations enable row level security;
alter table public.owner_backup_restore_authorizations force row level security;

revoke all on table public.owner_backup_restore_authorizations from public, anon, authenticated;

-- The original one-argument restore function remains the internal atomic restore
-- implementation, but normal authenticated clients can no longer execute it.
revoke all on function public.restore_portable_backup_v2(jsonb) from public, anon, authenticated;

-- Public RPC surface used by the Owner client. A valid one-time ticket must have
-- been issued by the trusted server for the same authenticated user. The ticket
-- is consumed before the atomic restore is invoked, in the same transaction.
create or replace function public.restore_portable_backup_v2_owner(
  p_payload jsonb,
  p_authorization uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_authorized_user uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_authorization is null then
    raise exception 'Owner restore authorization is required.' using errcode = '42501';
  end if;

  delete from public.owner_backup_restore_authorizations
  where token = p_authorization
    and user_id = v_user_id
    and expires_at > now()
  returning user_id into v_authorized_user;

  if v_authorized_user is null then
    raise exception 'Owner restore authorization is invalid or expired.' using errcode = '42501';
  end if;

  return public.restore_portable_backup_v2(p_payload);
end;
$$;

revoke all on function public.restore_portable_backup_v2_owner(jsonb, uuid)
  from public, anon;
grant execute on function public.restore_portable_backup_v2_owner(jsonb, uuid)
  to authenticated;

comment on function public.restore_portable_backup_v2_owner(jsonb, uuid) is
'Owner-only portable backup restore entry point. Requires a short-lived one-time authorization ticket issued by the trusted FICONTER server.';

commit;
