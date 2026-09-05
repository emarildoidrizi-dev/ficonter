-- FICONTER · Admin identity authority hardening
--
-- Database authorization must be based on authenticated user ID + admin_users role.
-- Owner identity remains an application-level concern through FICONTER_OWNER_EMAIL,
-- while the production Owner account is already persisted as super_admin in admin_users.
-- This removes the historical JWT-email recovery bypass from database authorization.

begin;

-- Refuse to apply this hardening if the platform would be left without a
-- database super administrator. This is a safety guard, not a user seed.
do $$
begin
  if not exists (
    select 1
    from public.admin_users
    where role = 'super_admin'
  ) then
    raise exception 'Admin identity hardening requires at least one super_admin row.';
  end if;
end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.role = 'super_admin'
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_platform_super_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_platform_super_admin() to authenticated;

commit;
