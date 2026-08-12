-- FICONTER Currency Engine — Phase 2
-- Currency selection & UX persistence.
--
-- Safe/additive:
-- - does NOT rewrite transactions
-- - does NOT convert financial amounts
-- - does NOT change historical exchange-rate records
-- - adds signup persistence for the base currency chosen during registration

begin;

-- Keep Phase 2 independently deployable even if the Phase 1 SQL was not
-- executed yet. These columns are additive and idempotent.
alter table public.profiles
  add column if not exists base_currency text;

alter table public.profiles
  add column if not exists base_currency_updated_at timestamptz;

update public.profiles
set
  base_currency = coalesce(nullif(upper(btrim(base_currency)), ''), 'EUR'),
  base_currency_updated_at = coalesce(base_currency_updated_at, now())
where
  base_currency is null
  or btrim(base_currency) = ''
  or base_currency <> upper(btrim(base_currency))
  or base_currency_updated_at is null;

alter table public.profiles
  alter column base_currency set default 'EUR',
  alter column base_currency set not null,
  alter column base_currency_updated_at set default now(),
  alter column base_currency_updated_at set not null;

alter table public.profiles
  drop constraint if exists profiles_base_currency_check;

alter table public.profiles
  add constraint profiles_base_currency_check
  check (base_currency ~ '^[A-Z]{3}$');

create or replace function public.ficonter_apply_signup_base_currency()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  selected_currency text;
  selected_name text;
begin
  selected_currency := upper(
    btrim(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'ficonter_base_currency', ''),
        nullif(
          new.raw_user_meta_data -> 'ficonter_preferences' ->> 'currency',
          ''
        ),
        'EUR'
      )
    )
  );

  if selected_currency !~ '^[A-Z]{3}$' then
    selected_currency := 'EUR';
  end if;

  selected_name := nullif(
    btrim(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'display_name',
        ''
      )
    ),
    ''
  );

  insert into public.profiles (
    id,
    full_name,
    base_currency,
    base_currency_updated_at
  )
  values (
    new.id,
    selected_name,
    selected_currency,
    now()
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    base_currency = excluded.base_currency,
    base_currency_updated_at = now();

  return new;
end;
$$;

-- Separate trigger: it does not replace FICONTER's existing new-user trigger.
-- The "zz_" prefix intentionally makes this run after the ordinary
-- on_auth_user_created trigger when both fire for the same INSERT.
drop trigger if exists zz_ficonter_apply_signup_base_currency
on auth.users;

create trigger zz_ficonter_apply_signup_base_currency
after insert on auth.users
for each row
execute function public.ficonter_apply_signup_base_currency();

comment on function public.ficonter_apply_signup_base_currency() is
  'Persists the base currency chosen during FICONTER registration without altering any financial record.';

notify pgrst, 'reload schema';

commit;
