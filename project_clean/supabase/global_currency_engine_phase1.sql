-- FICONTER Currency Engine — Phase 1 Foundation
-- Safe/additive migration.
-- This migration DOES NOT convert, rewrite or delete any financial amount.
-- Existing transactions.amount + transactions.currency remain the immutable
-- source values used by future currency-display logic.

begin;

alter table public.profiles
  add column if not exists base_currency text;

alter table public.profiles
  add column if not exists base_currency_updated_at timestamptz;

-- Preserve an already selected Settings currency where one exists.
-- Otherwise use EUR, which is FICONTER's current calculation baseline.
update public.profiles as p
set
  base_currency = coalesce(
    case
      when upper(coalesce(
        u.raw_user_meta_data -> 'ficonter_preferences' ->> 'currency',
        ''
      )) ~ '^[A-Z]{3}$'
      then upper(
        u.raw_user_meta_data -> 'ficonter_preferences' ->> 'currency'
      )
      else null
    end,
    p.base_currency,
    'EUR'
  ),
  base_currency_updated_at = coalesce(
    p.base_currency_updated_at,
    now()
  )
from auth.users as u
where u.id = p.id
  and (
    p.base_currency is null
    or btrim(p.base_currency) = ''
    or p.base_currency_updated_at is null
  );

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

comment on column public.profiles.base_currency is
  'Personal workspace display/base currency. Changing this value must never rewrite original transaction amount/currency fields.';

comment on column public.profiles.base_currency_updated_at is
  'Timestamp of the latest personal base-currency preference change.';

create or replace function public.ficonter_touch_profile_base_currency()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.base_currency := upper(btrim(new.base_currency));

  if tg_op = 'INSERT'
     or new.base_currency is distinct from old.base_currency then
    new.base_currency_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_touch_base_currency
on public.profiles;

create trigger profiles_touch_base_currency
before insert or update of base_currency
on public.profiles
for each row
execute function public.ficonter_touch_profile_base_currency();

notify pgrst, 'reload schema';

commit;
