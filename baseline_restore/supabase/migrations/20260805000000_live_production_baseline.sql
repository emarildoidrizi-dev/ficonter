


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_account_directory"() RETURNS TABLE("user_id" "uuid", "email" "text", "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "banned_until" timestamp with time zone, "display_name" "text", "role" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  return query
  select
    users.id,
    coalesce(users.email, '')::text,
    users.created_at,
    users.last_sign_in_at,
    users.banned_until,
    coalesce(
      nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(profiles.full_name), ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      'Unnamed user'
    )::text,
    admins.role::text
  from auth.users as users
  left join public.profiles as profiles on profiles.id = users.id
  left join public.admin_users as admins on admins.user_id = users.id
  order by
    case admins.role
      when 'super_admin' then 0
      when 'admin' then 1
      else 2
    end,
    lower(coalesce(users.email, '')),
    users.created_at;
end;
$$;


ALTER FUNCTION "public"."admin_account_directory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_platform_overview"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'storage'
    AS $$
declare
  registered_users bigint := 0;
  active_7_days bigint := 0;
  active_30_days bigint := 0;
  new_7_days bigint := 0;
  new_30_days bigint := 0;
  transaction_count bigint := 0;
  bill_count bigint := 0;
  goal_count bigint := 0;
  debt_count bigint := 0;
  planner_count bigint := 0;
  storage_count bigint := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  select
    count(*)::bigint,
    count(*) filter (
      where last_sign_in_at >= now() - interval '7 days'
        and (banned_until is null or banned_until <= now())
    )::bigint,
    count(*) filter (
      where last_sign_in_at >= now() - interval '30 days'
        and (banned_until is null or banned_until <= now())
    )::bigint,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint,
    count(*) filter (where created_at >= now() - interval '30 days')::bigint
  into
    registered_users,
    active_7_days,
    active_30_days,
    new_7_days,
    new_30_days
  from auth.users;

  transaction_count := public.admin_safe_relation_count('public.transactions');
  bill_count := public.admin_safe_relation_count('public.bills');
  goal_count := public.admin_safe_relation_count('public.goals');
  debt_count := public.admin_safe_relation_count('public.debts');
  planner_count :=
    public.admin_safe_relation_count('public.monthly_budget_plans') +
    public.admin_safe_relation_count('public.monthly_budget_items');
  storage_count := public.admin_safe_relation_count('storage.objects');

  return jsonb_build_object(
    'users', registered_users,
    'active_7_days', active_7_days,
    'active_30_days', active_30_days,
    'new_7_days', new_7_days,
    'new_30_days', new_30_days,
    'transactions', transaction_count,
    'bills', bill_count,
    'goals', goal_count,
    'debts', debt_count,
    'planner_records', planner_count,
    'storage_objects', storage_count
  );
end;
$$;


ALTER FUNCTION "public"."admin_platform_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_safe_relation_count"("relation_name" "text") RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'storage'
    AS $$
declare
  relation regclass;
  result bigint := 0;
begin
  relation := to_regclass(relation_name);
  if relation is null then
    return 0;
  end if;

  execute format('select count(*)::bigint from %s', relation) into result;
  return coalesce(result, 0);
end;
$$;


ALTER FUNCTION "public"."admin_safe_relation_count"("relation_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_usage_directory"("p_scope" "text" DEFAULT 'personal'::"text") RETURNS TABLE("user_id" "uuid", "user_name" "text", "email" "text", "account_status" "text", "business_count" bigint, "owned_business_count" bigint, "business_names" "text"[], "roles" "text"[], "is_live" boolean, "current_workspace" "text", "current_module" "text", "time_used_today_seconds" bigint, "sessions_today" bigint, "last_active_at" timestamp with time zone, "first_business_created_at" timestamp with time zone, "account_created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.platform_usage_is_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  if p_scope not in ('personal', 'business') then
    raise exception 'Scope must be personal or business.';
  end if;

  return query
  with memberships as (
    select
      member.user_id,
      count(distinct member.business_id)::bigint as business_count,
      count(distinct member.business_id)
        filter (where member.role = 'owner')::bigint
        as owned_business_count,
      array_agg(distinct business.name)
        filter (where business.name is not null)
        as business_names,
      array_agg(
        distinct case member.role
          when 'owner' then 'Owner'
          when 'admin' then 'Administrator'
          when 'manager' then 'Manager'
          when 'member' then 'Manager'
          when 'accountant' then 'Accountant'
          when 'viewer' then 'Viewer'
          else initcap(replace(member.role, '_', ' '))
        end
      ) as roles,
      coalesce(
        min(business.created_at) filter (where member.role = 'owner'),
        min(member.created_at)
      ) as first_business_created_at
    from public.business_members member
    join public.businesses business
      on business.id = member.business_id
    where member.status = 'active'
    group by member.user_id
  ),
  latest_presence as (
    select distinct on (presence.user_id)
      presence.user_id,
      presence.workspace,
      presence.module,
      presence.is_visible,
      presence.last_seen_at
    from public.platform_usage_presence presence
    order by
      presence.user_id,
      (
        presence.is_visible
        and presence.last_seen_at >= now() - interval '2 minutes'
      ) desc,
      presence.last_seen_at desc
  ),
  scoped_daily as (
    select
      daily.user_id,
      sum(daily.active_seconds)::bigint
        as time_used_today_seconds,
      sum(daily.sessions_count)::bigint
        as sessions_today,
      max(daily.last_seen_at) as last_active_at
    from public.platform_usage_daily daily
    where daily.usage_date =
      (now() at time zone 'UTC')::date
      and daily.workspace = p_scope
    group by daily.user_id
  )
  select
    account.id as user_id,
    coalesce(
      nullif(account.raw_user_meta_data ->> 'display_name', ''),
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(account.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(account.email, ''), '@', 1),
      'Unnamed user'
    )::text as user_name,
    coalesce(account.email, 'Email unavailable')::text as email,
    case
      when account.banned_until is not null
        and account.banned_until > now()
        then 'Suspended'
      else 'Active'
    end::text as account_status,
    coalesce(membership.business_count, 0)::bigint
      as business_count,
    coalesce(membership.owned_business_count, 0)::bigint
      as owned_business_count,
    coalesce(
      membership.business_names,
      array[]::text[]
    ) as business_names,
    coalesce(
      membership.roles,
      array[]::text[]
    ) as roles,
    (
      presence.workspace = p_scope
      and presence.is_visible
      and presence.last_seen_at >= now() - interval '2 minutes'
    )::boolean as is_live,
    presence.workspace::text as current_workspace,
    presence.module::text as current_module,
    coalesce(daily.time_used_today_seconds, 0)::bigint
      as time_used_today_seconds,
    coalesce(daily.sessions_today, 0)::bigint
      as sessions_today,
    daily.last_active_at,
    membership.first_business_created_at,
    account.created_at as account_created_at
  from auth.users account
  left join memberships membership
    on membership.user_id = account.id
  left join latest_presence presence
    on presence.user_id = account.id
  left join scoped_daily daily
    on daily.user_id = account.id
  where
    p_scope = 'personal'
    or membership.user_id is not null
  order by
    (
      presence.workspace = p_scope
      and presence.is_visible
      and presence.last_seen_at >= now() - interval '2 minutes'
    ) desc,
    daily.last_active_at desc nulls last,
    account.created_at desc;
end;
$$;


ALTER FUNCTION "public"."admin_usage_directory"("p_scope" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_usage_overview"("p_scope" "text" DEFAULT 'personal'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_result jsonb;
begin
  if not public.platform_usage_is_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  if p_scope not in ('personal', 'business') then
    raise exception 'Scope must be personal or business.';
  end if;

  select jsonb_build_object(
    'total_users', count(*),
    'live_now', count(*) filter (where directory.is_live),
    'active_today', count(*) filter (
      where directory.time_used_today_seconds > 0
    ),
    'total_seconds_today',
      coalesce(sum(directory.time_used_today_seconds), 0),
    'average_seconds_today',
      coalesce(
        round(
          avg(directory.time_used_today_seconds)
          filter (where directory.time_used_today_seconds > 0)
        ),
        0
      ),
    'sessions_today',
      coalesce(sum(directory.sessions_today), 0)
  )
  into v_result
  from public.admin_usage_directory(p_scope) directory;

  return coalesce(
    v_result,
    jsonb_build_object(
      'total_users', 0,
      'live_now', 0,
      'active_today', 0,
      'total_seconds_today', 0,
      'average_seconds_today', 0,
      'sessions_today', 0
    )
  );
end;
$$;


ALTER FUNCTION "public"."admin_usage_overview"("p_scope" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_business_workspace"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business public.businesses%rowtype;
  v_next_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_business
  from public.businesses business
  where business.id = p_business_id
  for update;

  if v_business.id is null then
    raise exception 'Business workspace was not found.';
  end if;

  if v_business.owner_id <> v_user_id then
    raise exception 'Only the business owner can archive this workspace.';
  end if;

  if v_business.status = 'archived' then
    raise exception 'This business is already archived.';
  end if;

  update public.businesses
  set
    status = 'archived',
    archived_at = now(),
    updated_at = now()
  where id = p_business_id
  returning * into v_business;

  select business.id
    into v_next_business_id
  from public.businesses business
  join public.business_members member
    on member.business_id = business.id
  where member.user_id = v_user_id
    and member.status = 'active'
    and business.status = 'active'
    and business.id <> p_business_id
  order by business.created_at asc
  limit 1;

  if exists (
    select 1
    from public.business_user_preferences preference
    where preference.user_id = v_user_id
      and preference.active_business_id = p_business_id
  ) then
    insert into public.business_user_preferences (
      user_id,
      active_business_id
    ) values (
      v_user_id,
      v_next_business_id
    )
    on conflict (user_id)
    do update set
      active_business_id = excluded.active_business_id,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'business', to_jsonb(v_business),
    'active_business_id', v_next_business_id
  );
end;
$$;


ALTER FUNCTION "public"."archive_business_workspace"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_capture_audit_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row jsonb;
  v_old jsonb;
  v_business_id uuid;
  v_entity_id uuid;
  v_action text;
  v_summary text;
  v_label text;
  v_actor_id uuid := auth.uid();
  v_actor_label text := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    case when auth.uid() is null then 'System' else 'Business member' end
  );
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;

  if tg_table_name = 'businesses' then
    v_business_id := nullif(v_row ->> 'id', '')::uuid;
  else
    v_business_id := nullif(v_row ->> 'business_id', '')::uuid;
  end if;

  if v_business_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- A permanent workspace deletion cascades through its child tables.
  -- At that point the parent business no longer exists, so writing a new
  -- audit row would violate business_audit_log_business_id_fkey.
  if not exists (
    select 1
    from public.businesses business
    where business.id = v_business_id
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_entity_id := coalesce(
    nullif(v_row ->> 'id', '')::uuid,
    v_business_id
  );
  v_action := case tg_op
    when 'INSERT' then 'created'
    when 'UPDATE' then 'updated'
    else 'deleted'
  end;

  v_label := coalesce(
    nullif(v_row ->> 'name', ''),
    nullif(v_row ->> 'description', ''),
    nullif(v_row ->> 'sale_number', ''),
    nullif(v_row ->> 'invoice_number', ''),
    nullif(v_row ->> 'item_name', ''),
    nullif(v_row ->> 'sku', ''),
    'record'
  );

  if tg_table_name = 'businesses' then
    if tg_op = 'UPDATE'
       and coalesce(v_old ->> 'status', '') <> coalesce(v_row ->> 'status', '')
       and v_row ->> 'status' = 'archived' then
      v_action := 'archived';
      v_summary := 'Business archived: ' || v_label;
    elsif tg_op = 'UPDATE'
       and coalesce(v_old ->> 'status', '') <> coalesce(v_row ->> 'status', '')
       and v_row ->> 'status' = 'active' then
      v_action := 'restored';
      v_summary := 'Business restored: ' || v_label;
    elsif tg_op = 'INSERT' then
      v_summary := 'Business workspace created: ' || v_label;
    else
      v_summary := 'Business profile updated: ' || v_label;
    end if;
  elsif tg_table_name = 'business_settings' then
    v_summary := 'Financial setup updated';
  elsif tg_table_name = 'business_transactions' then
    v_summary := 'Transaction ' || lower(v_action) || ': ' || v_label;
  elsif tg_table_name = 'business_cost_categories' then
    v_summary := 'Cost category ' || lower(v_action) || ': ' || v_label;
  elsif tg_table_name = 'business_cost_centres' then
    v_summary := 'Cost centre ' || lower(v_action) || ': ' || v_label;
  elsif tg_table_name = 'business_suppliers' then
    v_summary := 'Supplier ' || lower(v_action) || ': ' || v_label;
  elsif tg_table_name = 'business_supplier_invoices' then
    v_summary := 'Supplier invoice ' || lower(v_action) || ': ' || v_label;
  elsif tg_table_name = 'business_inventory_items' then
    v_summary := 'Inventory item ' || lower(v_action) || ': ' || v_label;
  elsif tg_table_name = 'business_inventory_movements' then
    v_summary := 'Inventory movement ' || lower(v_action) || ': ' || v_label;
  elsif tg_table_name = 'business_sales' then
    if tg_op = 'UPDATE'
       and coalesce(v_old ->> 'status', '') <> coalesce(v_row ->> 'status', '')
       and v_row ->> 'status' = 'refunded' then
      v_summary := 'Sale refunded: ' || v_label;
    else
      v_summary := 'Sale ' || lower(v_action) || ': ' || v_label;
    end if;
  else
    v_summary := initcap(replace(tg_table_name, '_', ' '))
      || ' ' || lower(v_action) || ': ' || v_label;
  end if;

  insert into public.business_audit_log (
    business_id,
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  ) values (
    v_business_id,
    v_actor_id,
    v_actor_label,
    v_action,
    tg_table_name,
    v_entity_id,
    v_summary,
    jsonb_build_object('source_table', tg_table_name)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."business_capture_audit_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_capture_document_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_document record;
  v_action text;
  v_summary text;
  v_actor_id uuid := auth.uid();
  v_actor_label text := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    case when auth.uid() is null then 'System' else 'Business member' end
  );
begin
  v_document := case when tg_op = 'DELETE' then old else new end;

  -- Skip audit creation while the whole business workspace is being
  -- permanently removed. The parent business is already gone.
  if not exists (
    select 1
    from public.businesses business
    where business.id = v_document.business_id
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_action := case tg_op
    when 'INSERT' then 'created'
    when 'UPDATE' then 'updated'
    else 'deleted'
  end;

  v_summary := case tg_op
    when 'INSERT' then 'Document uploaded: ' || v_document.title
    when 'UPDATE' then 'Document details updated: ' || v_document.title
    else 'Document deleted: ' || v_document.title
  end;

  insert into public.business_audit_log (
    business_id,
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  ) values (
    v_document.business_id,
    v_actor_id,
    v_actor_label,
    v_action,
    'business_documents',
    v_document.id,
    v_summary,
    jsonb_build_object(
      'category', v_document.category,
      'original_filename', v_document.original_filename
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."business_capture_document_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_cost_budget_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1
    from public.business_cost_categories category
    where category.id = new.category_id
      and category.business_id = new.business_id
  ) then
    raise exception 'The selected budget category does not belong to this business.';
  end if;

  new.budget_month := date_trunc('month', new.budget_month)::date;
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_cost_budget_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_cost_category_after_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.name is distinct from old.name then
    update public.business_transactions
    set category = new.name
    where cost_category_id = new.id;

    update public.business_recurring_costs
    set category_name = new.name
    where category_id = new.id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."business_cost_category_after_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_documents_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_documents_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_inventory_item_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is null then
      raise exception 'A creator is required.';
    end if;
  end if;

  if new.category_id is not null and not exists (
    select 1 from public.business_inventory_categories category
    where category.id = new.category_id and category.business_id = new.business_id
  ) then raise exception 'The selected inventory category does not belong to this business.'; end if;

  if new.location_id is not null and not exists (
    select 1 from public.business_inventory_locations location
    where location.id = new.location_id and location.business_id = new.business_id
  ) then raise exception 'The selected inventory location does not belong to this business.'; end if;

  if new.supplier_id is not null and not exists (
    select 1 from public.business_suppliers supplier
    where supplier.id = new.supplier_id and supplier.business_id = new.business_id
  ) then raise exception 'The selected supplier does not belong to this business.'; end if;

  new.name := trim(new.name);
  new.sku := upper(trim(new.sku));
  new.barcode := nullif(trim(coalesce(new.barcode, '')), '');
  new.unit := lower(trim(new.unit));
  new.default_purchase_currency := upper(new.default_purchase_currency);
  new.notes := nullif(trim(coalesce(new.notes, '')), '');
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_inventory_item_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_inventory_master_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.name := trim(new.name);
  new.description := nullif(trim(coalesce(new.description, '')), '');
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_inventory_master_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_inventory_seed_after_business"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.seed_business_inventory_defaults(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."business_inventory_seed_after_business"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_member_can_manage"("p_business_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  );
$$;


ALTER FUNCTION "public"."business_member_can_manage"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_member_can_write"("p_business_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin', 'member')
  );
$$;


ALTER FUNCTION "public"."business_member_can_write"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_member_has_access"("p_business_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.business_members member
    where member.business_id = p_business_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;


ALTER FUNCTION "public"."business_member_has_access"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_next_recurring_timestamp"("p_start_date" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text", "p_after" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_after_local timestamp without time zone;
  v_month date;
  v_candidate timestamptz;
  v_candidate_local_date date;
begin
  v_after_local := p_after at time zone p_timezone;
  v_month := date_trunc(
    'month',
    greatest(v_after_local::date, p_start_date)
  )::date;

  for v_attempt in 1..36 loop
    v_candidate := public.business_scheduled_timestamp(
      v_month,
      p_due_day,
      p_record_time,
      p_timezone
    );
    v_candidate_local_date := (v_candidate at time zone p_timezone)::date;

    if v_candidate >= p_after
       and v_candidate_local_date >= p_start_date then
      return v_candidate;
    end if;

    v_month := (v_month + interval '1 month')::date;
  end loop;

  raise exception 'The next recurring cost date could not be calculated.';
end;
$$;


ALTER FUNCTION "public"."business_next_recurring_timestamp"("p_start_date" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text", "p_after" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_recurring_cost_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_category_name text;
  v_default_nature text;
  v_supplier_name text;
  v_recalculate boolean := false;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is null then
      raise exception 'A creator is required.';
    end if;
    v_recalculate := true;
  else
    v_recalculate :=
      new.status is distinct from old.status
      or new.due_day is distinct from old.due_day
      or new.record_time is distinct from old.record_time
      or new.timezone is distinct from old.timezone
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
      or new.next_run_at is null;
  end if;

  new.name := trim(new.name);
  new.currency := upper(new.currency);
  new.category_name := trim(new.category_name);
  new.timezone := coalesce(nullif(trim(new.timezone), ''), 'UTC');

  if new.supplier_id is not null then
    select supplier.name
      into v_supplier_name
    from public.business_suppliers supplier
    where supplier.id = new.supplier_id
      and supplier.business_id = new.business_id;

    if v_supplier_name is null then
      raise exception 'The selected supplier does not belong to this business.';
    end if;
    new.supplier := v_supplier_name;
  end if;

  if new.category_id is not null then
    select category.name, category.default_nature
      into v_category_name, v_default_nature
    from public.business_cost_categories category
    where category.id = new.category_id
      and category.business_id = new.business_id;

    if v_category_name is null then
      raise exception 'The selected cost category does not belong to this business.';
    end if;

    new.category_name := v_category_name;
    if new.cost_nature is null then
      new.cost_nature := v_default_nature;
    end if;
  end if;

  if new.cost_centre_id is not null and not exists (
    select 1
    from public.business_cost_centres centre
    where centre.id = new.cost_centre_id
      and centre.business_id = new.business_id
  ) then
    raise exception 'The selected cost centre does not belong to this business.';
  end if;

  if new.status = 'active' then
    if v_recalculate then
      new.next_run_at := public.business_next_recurring_timestamp(
        new.start_date,
        new.due_day,
        new.record_time,
        new.timezone,
        now()
      );
    end if;

    if new.end_date is not null
       and (new.next_run_at at time zone new.timezone)::date > new.end_date then
      new.status := 'ended';
      new.next_run_at := null;
    end if;
  else
    new.next_run_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_recurring_cost_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_sale_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.sale_number:=upper(trim(new.sale_number));
  new.customer_name:=nullif(trim(coalesce(new.customer_name,'')),'');
  new.customer_email:=nullif(trim(coalesce(new.customer_email,'')),'');
  new.currency:=upper(new.currency);
  new.payment_method:=nullif(trim(coalesce(new.payment_method,'')),'');
  new.reference:=nullif(trim(coalesce(new.reference,'')),'');
  new.notes:=nullif(trim(coalesce(new.notes,'')),'');
  new.updated_at:=now();
  return new;
end;$$;


ALTER FUNCTION "public"."business_sale_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_scheduled_timestamp"("p_month" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_day integer;
  v_date date;
begin
  if p_due_day not between 1 and 31 then
    raise exception 'Due day must be between 1 and 31.';
  end if;

  v_day := least(p_due_day, extract(day from v_month_end)::integer);
  v_date := make_date(
    extract(year from v_month_start)::integer,
    extract(month from v_month_start)::integer,
    v_day
  );

  return (v_date + p_record_time) at time zone p_timezone;
exception
  when invalid_parameter_value then
    raise exception 'Invalid time zone: %', p_timezone;
end;
$$;


ALTER FUNCTION "public"."business_scheduled_timestamp"("p_month" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_seed_cost_control_after_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.seed_business_cost_control_defaults(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."business_seed_cost_control_after_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_supplier_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is null then
      raise exception 'A creator is required.';
    end if;
  end if;

  new.name := trim(new.name);
  new.legal_name := nullif(trim(coalesce(new.legal_name, '')), '');
  new.supplier_code := nullif(trim(coalesce(new.supplier_code, '')), '');
  new.category := coalesce(nullif(trim(new.category), ''), 'Other');
  new.contact_name := nullif(trim(coalesce(new.contact_name, '')), '');
  new.email := nullif(trim(coalesce(new.email, '')), '');
  new.phone := nullif(trim(coalesce(new.phone, '')), '');
  new.website := nullif(trim(coalesce(new.website, '')), '');
  new.tax_id := nullif(trim(coalesce(new.tax_id, '')), '');
  new.default_currency := upper(new.default_currency);
  new.country_code := nullif(upper(trim(coalesce(new.country_code, ''))), '');
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_supplier_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_supplier_invoice_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_category_name text;
  v_default_nature text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is null then
      raise exception 'A creator is required.';
    end if;
  end if;

  if not exists (
    select 1
    from public.business_suppliers supplier
    where supplier.id = new.supplier_id
      and supplier.business_id = new.business_id
  ) then
    raise exception 'The selected supplier does not belong to this business.';
  end if;

  if new.category_id is not null then
    select category.name, category.default_nature
      into v_category_name, v_default_nature
    from public.business_cost_categories category
    where category.id = new.category_id
      and category.business_id = new.business_id;

    if v_category_name is null then
      raise exception 'The selected cost category does not belong to this business.';
    end if;

    new.category_name := v_category_name;
    new.cost_nature := coalesce(new.cost_nature, v_default_nature);
  else
    new.category_name := trim(new.category_name);
  end if;

  if new.cost_centre_id is not null and not exists (
    select 1
    from public.business_cost_centres centre
    where centre.id = new.cost_centre_id
      and centre.business_id = new.business_id
  ) then
    raise exception 'The selected cost centre does not belong to this business.';
  end if;

  if new.due_date < new.issue_date then
    raise exception 'The invoice due date cannot be earlier than the issue date.';
  end if;

  new.invoice_number := trim(new.invoice_number);
  new.description := trim(new.description);
  new.currency := upper(new.currency);
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_supplier_invoice_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_transaction_before_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_category_name text;
  v_default_nature text;
  v_supplier_name text;
  v_invoice_supplier_id uuid;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif new.created_by is null then
      raise exception 'A creator is required.';
    end if;
  end if;

  new.currency := upper(new.currency);

  if new.type = 'income' then
    new.cost_nature := null;
    new.cost_category_id := null;
    new.cost_centre_id := null;
    new.supplier_id := null;
    new.source_supplier_invoice_id := null;
  else
    if new.cost_category_id is not null then
      select category.name, category.default_nature
        into v_category_name, v_default_nature
      from public.business_cost_categories category
      where category.id = new.cost_category_id
        and category.business_id = new.business_id;

      if v_category_name is null then
        raise exception 'The selected cost category does not belong to this business.';
      end if;

      new.category := v_category_name;
      new.cost_nature := coalesce(new.cost_nature, v_default_nature);
    end if;

    if new.cost_centre_id is not null and not exists (
      select 1
      from public.business_cost_centres centre
      where centre.id = new.cost_centre_id
        and centre.business_id = new.business_id
    ) then
      raise exception 'The selected cost centre does not belong to this business.';
    end if;

    if new.source_supplier_invoice_id is not null then
      select invoice.supplier_id
        into v_invoice_supplier_id
      from public.business_supplier_invoices invoice
      where invoice.id = new.source_supplier_invoice_id
        and invoice.business_id = new.business_id;

      if v_invoice_supplier_id is null then
        raise exception 'The linked supplier invoice does not belong to this business.';
      end if;
      new.supplier_id := v_invoice_supplier_id;
    end if;

    if new.supplier_id is not null then
      select supplier.name
        into v_supplier_name
      from public.business_suppliers supplier
      where supplier.id = new.supplier_id
        and supplier.business_id = new.business_id;

      if v_supplier_name is null then
        raise exception 'The selected supplier does not belong to this business.';
      end if;
      new.counterparty := v_supplier_name;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_transaction_before_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_user_preference_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."business_user_preference_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_workspace_has_financial_activity"("p_business_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_has_activity boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.business_member_has_access(p_business_id) then
    raise exception 'You do not have access to this business.';
  end if;

  select
    exists (
      select 1
      from public.business_transactions transaction
      where transaction.business_id = p_business_id
      limit 1
    )
    or exists (
      select 1
      from public.business_inventory_movements movement
      where movement.business_id = p_business_id
      limit 1
    )
    or exists (
      select 1
      from public.business_sales sale
      where sale.business_id = p_business_id
      limit 1
    )
    or exists (
      select 1
      from public.business_supplier_invoices invoice
      where invoice.business_id = p_business_id
      limit 1
    )
  into v_has_activity;

  return v_has_activity;
end;
$$;


ALTER FUNCTION "public"."business_workspace_has_financial_activity"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_support_request_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.user_notifications notification
  where notification.user_id = old.user_id
    and notification.metadata ->> 'request_id' = old.id::text;

  return old;
end;
$$;


ALTER FUNCTION "public"."cleanup_support_request_notifications"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_support_request_notifications"() IS 'Deletes notifications linked to a support conversation before that conversation is permanently removed.';



CREATE OR REPLACE FUNCTION "public"."create_business_document"("p_document_id" "uuid", "p_business_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_file_path" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size" bigint, "p_expires_on" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_document public.business_documents%rowtype;
  v_expected_prefix text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.business_member_can_manage(p_business_id) then
    raise exception 'Owner or administrator access is required.';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 2 and 160 then
    raise exception 'Document title must contain 2 to 160 characters.';
  end if;

  if p_category not in (
    'Company registration',
    'Tax & VAT',
    'Licences & permits',
    'Contracts',
    'Supplier documents',
    'Insurance',
    'Banking & finance',
    'Receipts & invoices',
    'Employment',
    'Other'
  ) then
    raise exception 'Select a supported document category.';
  end if;

  if p_file_size not between 1 and 15728640 then
    raise exception 'Document size must be 15 MB or smaller.';
  end if;

  if p_mime_type not in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ) then
    raise exception 'This document type is not supported.';
  end if;

  v_expected_prefix :=
    v_user_id::text || '/' ||
    p_business_id::text || '/' ||
    p_document_id::text || '/';

  if left(p_file_path, char_length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'The document storage path is invalid.';
  end if;

  insert into public.business_documents (
    id,
    business_id,
    uploaded_by,
    title,
    category,
    description,
    file_path,
    original_filename,
    mime_type,
    file_size,
    expires_on
  ) values (
    p_document_id,
    p_business_id,
    v_user_id,
    trim(p_title),
    p_category,
    nullif(trim(coalesce(p_description, '')), ''),
    p_file_path,
    trim(p_original_filename),
    p_mime_type,
    p_file_size,
    p_expires_on
  )
  returning * into v_document;

  return to_jsonb(v_document);
end;
$$;


ALTER FUNCTION "public"."create_business_document"("p_document_id" "uuid", "p_business_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_file_path" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size" bigint, "p_expires_on" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_business_inventory_item"("p_business_id" "uuid", "p_name" "text", "p_sku" "text", "p_barcode" "text" DEFAULT NULL::"text", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_supplier_id" "uuid" DEFAULT NULL::"uuid", "p_location_id" "uuid" DEFAULT NULL::"uuid", "p_unit" "text" DEFAULT 'unit'::"text", "p_low_stock_threshold" numeric DEFAULT 0, "p_default_purchase_cost" numeric DEFAULT 0, "p_default_purchase_currency" "text" DEFAULT 'EUR'::"text", "p_default_purchase_cost_base" numeric DEFAULT 0, "p_default_exchange_rate_to_base" numeric DEFAULT 1, "p_selling_price_base" numeric DEFAULT 0, "p_opening_quantity" numeric DEFAULT 0, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_item public.business_inventory_items%rowtype;
  v_movement public.business_inventory_movements%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if not public.business_member_can_write(p_business_id) then raise exception 'Business write access is required.'; end if;
  if coalesce(p_opening_quantity, 0) < 0 then raise exception 'Opening quantity cannot be negative.'; end if;

  insert into public.business_inventory_items (
    business_id, created_by, name, sku, barcode, category_id, supplier_id, location_id,
    unit, low_stock_threshold, default_purchase_cost, default_purchase_currency,
    default_purchase_cost_base, default_exchange_rate_to_base, selling_price_base, notes
  ) values (
    p_business_id, v_user_id, p_name, p_sku, p_barcode, p_category_id, p_supplier_id, p_location_id,
    p_unit, coalesce(p_low_stock_threshold,0), coalesce(p_default_purchase_cost,0), upper(p_default_purchase_currency),
    coalesce(p_default_purchase_cost_base,0), coalesce(p_default_exchange_rate_to_base,1), coalesce(p_selling_price_base,0), p_notes
  ) returning * into v_item;

  if coalesce(p_opening_quantity, 0) > 0 then
    insert into public.business_inventory_movements (
      business_id, item_id, item_name, item_sku, created_by, movement_type,
      quantity_delta, unit_cost, currency, unit_cost_base, inventory_value_delta_base,
      exchange_rate_to_base, exchange_rate_date, exchange_rate_source,
      supplier_id, supplier_name, movement_date, occurred_at, notes
    ) values (
      p_business_id, v_item.id, v_item.name, v_item.sku, v_user_id, 'opening_stock',
      round(p_opening_quantity,4), round(coalesce(p_default_purchase_cost,0),4), upper(p_default_purchase_currency),
      round(coalesce(p_default_purchase_cost_base,0),4),
      round(p_opening_quantity * coalesce(p_default_purchase_cost_base,0),4),
      coalesce(p_default_exchange_rate_to_base,1), current_date, 'Opening inventory value',
      p_supplier_id,
      (select supplier.name from public.business_suppliers supplier where supplier.id = p_supplier_id),
      current_date, now(), 'Opening stock created with inventory item'
    ) returning * into v_movement;
  end if;

  return jsonb_build_object(
    'item', (select to_jsonb(snapshot) from public.business_inventory_item_balances snapshot where snapshot.id = v_item.id),
    'movement', case when v_movement.id is null then null else to_jsonb(v_movement) end
  );
end;
$$;


ALTER FUNCTION "public"."create_business_inventory_item"("p_business_id" "uuid", "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_category_id" "uuid", "p_supplier_id" "uuid", "p_location_id" "uuid", "p_unit" "text", "p_low_stock_threshold" numeric, "p_default_purchase_cost" numeric, "p_default_purchase_currency" "text", "p_default_purchase_cost_base" numeric, "p_default_exchange_rate_to_base" numeric, "p_selling_price_base" numeric, "p_opening_quantity" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_business_workspace"("p_name" "text", "p_legal_name" "text" DEFAULT NULL::"text", "p_business_type" "text" DEFAULT 'Sole trader'::"text", "p_country_code" "text" DEFAULT 'DE'::"text", "p_base_currency" "text" DEFAULT 'EUR'::"text", "p_fiscal_year_start_month" integer DEFAULT 1, "p_timezone" "text" DEFAULT 'UTC'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_timezone text :=
    coalesce(nullif(trim(p_timezone), ''), 'UTC');
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter a valid business name.';
  end if;

  if char_length(upper(trim(coalesce(p_country_code, '')))) <> 2 then
    raise exception 'Country code must contain two letters.';
  end if;

  if char_length(upper(trim(coalesce(p_base_currency, '')))) <> 3 then
    raise exception 'Base currency must contain three letters.';
  end if;

  if p_fiscal_year_start_month not between 1 and 12 then
    raise exception 'Fiscal year start month must be between 1 and 12.';
  end if;

  perform 1
  from pg_timezone_names
  where name = v_timezone;

  if not found then
    raise exception 'Enter a valid timezone.';
  end if;

  insert into public.businesses (
    owner_id,
    name,
    legal_name,
    business_type,
    country_code,
    base_currency,
    fiscal_year_start_month,
    status,
    timezone
  ) values (
    v_user_id,
    trim(p_name),
    nullif(trim(coalesce(p_legal_name, '')), ''),
    coalesce(nullif(trim(p_business_type), ''), 'Sole trader'),
    upper(coalesce(nullif(trim(p_country_code), ''), 'DE')),
    upper(coalesce(nullif(trim(p_base_currency), ''), 'EUR')),
    p_fiscal_year_start_month,
    'active',
    v_timezone
  )
  returning id into v_business_id;

  insert into public.business_members (
    business_id,
    user_id,
    role,
    status
  ) values (
    v_business_id,
    v_user_id,
    'owner',
    'active'
  );

  insert into public.business_settings (
    business_id,
    default_timezone
  ) values (
    v_business_id,
    v_timezone
  );

  insert into public.business_user_preferences (
    user_id,
    active_business_id
  ) values (
    v_user_id,
    v_business_id
  )
  on conflict (user_id)
  do update set
    active_business_id = excluded.active_business_id,
    updated_at = now();

  return v_business_id;
end;
$$;


ALTER FUNCTION "public"."create_business_workspace"("p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."credit_card_minimum_payment_3_percent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if lower(coalesce(new.category, '')) = 'credit card' then
    if new.statement_balance is null then
      new.minimum_payment := 0;
      new.minimum_payment_eur := 0;
    else
      new.minimum_payment := least(
        new.statement_balance,
        round(new.statement_balance * 0.03, 2)
      );

      new.minimum_payment_eur := least(
        coalesce(new.statement_balance_eur, 0),
        round(coalesce(new.statement_balance_eur, 0) * 0.03, 2)
      );
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."credit_card_minimum_payment_3_percent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_all_financial_records"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_goals bigint := 0;
  v_debts bigint := 0;
  v_bills bigint := 0;
  v_plans bigint := 0;
  v_items bigint := 0;
  v_transactions bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.goals where user_id = v_user_id;
  get diagnostics v_goals = row_count;

  delete from public.debts where user_id = v_user_id;
  get diagnostics v_debts = row_count;

  delete from public.bills where user_id = v_user_id;
  get diagnostics v_bills = row_count;

  delete from public.monthly_budget_items where user_id = v_user_id;
  get diagnostics v_items = row_count;

  delete from public.monthly_budget_plans where user_id = v_user_id;
  get diagnostics v_plans = row_count;

  delete from public.transactions where user_id = v_user_id;
  get diagnostics v_transactions = row_count;

  return jsonb_build_object(
    'goals', v_goals,
    'debts', v_debts,
    'bills', v_bills,
    'planner_plans', v_plans,
    'planner_items', v_items,
    'transactions', v_transactions
  );
end;
$$;


ALTER FUNCTION "public"."delete_all_financial_records"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_bill_with_transaction"("p_bill_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_bill
  from public.bills
  where id = p_bill_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Bill not found.';
  end if;

  delete from public.bills
  where id = v_bill.id and user_id = v_user_id;

  if v_bill.transaction_id is not null then
    delete from public.transactions
    where id = v_bill.transaction_id and user_id = v_user_id;
  end if;

  return jsonb_build_object('bill', to_jsonb(v_bill));
end;
$$;


ALTER FUNCTION "public"."delete_bill_with_transaction"("p_bill_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_business_document"("p_document_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_document public.business_documents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_document
  from public.business_documents document
  where document.id = p_document_id
  for update;

  if v_document.id is null then
    raise exception 'Business document was not found.';
  end if;

  if not public.business_member_can_manage(v_document.business_id) then
    raise exception 'Owner or administrator access is required.';
  end if;

  delete from public.business_documents
  where id = p_document_id;

  return jsonb_build_object(
    'id', v_document.id,
    'file_path', v_document.file_path,
    'original_filename', v_document.original_filename
  );
end;
$$;


ALTER FUNCTION "public"."delete_business_document"("p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_business_sale"("p_sale_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.business_sales%rowtype;
  v_line public.business_sale_lines%rowtype;
  v_original public.business_inventory_movements%rowtype;
  v_reversal public.business_inventory_movements%rowtype;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_sale
  from public.business_sales
  where id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale was not found.';
  end if;

  if not public.business_member_can_write(v_sale.business_id) then
    raise exception 'Business write access is required.';
  end if;

  if v_sale.status = 'deleted' then
    raise exception 'This sale is already deleted.';
  end if;

  if v_sale.status = 'completed' then
    for v_line in
      select *
      from public.business_sale_lines
      where sale_id = v_sale.id
        and inventory_movement_id is not null
      order by created_at
    loop
      select *
        into v_original
      from public.business_inventory_movements
      where id = v_line.inventory_movement_id
      for update;

      if v_original.id is null then
        raise exception 'A linked inventory movement is missing.';
      end if;

      if exists (
        select 1
        from public.business_inventory_movements movement
        where movement.reversal_of_id = v_original.id
      ) then
        raise exception 'This sale inventory has already been restored.';
      end if;

      insert into public.business_inventory_movements (
        business_id,
        item_id,
        item_name,
        item_sku,
        created_by,
        movement_type,
        quantity_delta,
        unit_cost,
        currency,
        unit_cost_base,
        inventory_value_delta_base,
        exchange_rate_to_base,
        exchange_rate_date,
        exchange_rate_source,
        reversal_of_id,
        movement_date,
        occurred_at,
        reference,
        notes
      ) values (
        v_original.business_id,
        v_original.item_id,
        v_original.item_name,
        v_original.item_sku,
        v_user_id,
        'reversal',
        -v_original.quantity_delta,
        v_original.unit_cost,
        v_original.currency,
        v_original.unit_cost_base,
        -v_original.inventory_value_delta_base,
        v_original.exchange_rate_to_base,
        current_date,
        'Deleted sale reversal',
        v_original.id,
        current_date,
        now(),
        'Delete · ' || v_sale.sale_number,
        'Inventory restored from a safely deleted sale'
      ) returning * into v_reversal;
    end loop;
  end if;

  v_transaction_id := v_sale.transaction_id;

  if v_transaction_id is not null then
    delete from public.business_transactions
    where id = v_transaction_id
      and business_id = v_sale.business_id
      and source_sale_id = v_sale.id;
  end if;

  update public.business_sales
  set
    status = 'deleted',
    transaction_id = null,
    deleted_at = now(),
    updated_at = now()
  where id = v_sale.id
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'deleted_transaction_id', v_transaction_id
  );
end;
$$;


ALTER FUNCTION "public"."delete_business_sale"("p_sale_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_business_sale"("p_sale_id" "uuid") IS 'Safely moves a sale to Deleted, restores active stock and removes the linked revenue transaction.';



CREATE OR REPLACE FUNCTION "public"."delete_business_workspace"("p_business_id" "uuid", "p_confirmation_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business_name text;
  v_owner_id uuid;
  v_next_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select business.name, business.owner_id
    into v_business_name, v_owner_id
  from public.businesses business
  where business.id = p_business_id
  for update;

  if v_business_name is null then
    raise exception 'Business workspace was not found.';
  end if;

  if v_owner_id <> v_user_id then
    raise exception 'Only the business owner can remove this workspace.';
  end if;

  if trim(coalesce(p_confirmation_name, '')) <> v_business_name then
    raise exception 'The confirmation name does not match the business name.';
  end if;

  delete from public.businesses
  where id = p_business_id
    and owner_id = v_user_id;

  select business.id
    into v_next_business_id
  from public.businesses business
  join public.business_members member
    on member.business_id = business.id
  where member.user_id = v_user_id
    and member.status = 'active'
  order by business.created_at asc
  limit 1;

  insert into public.business_user_preferences (
    user_id,
    active_business_id
  ) values (
    v_user_id,
    v_next_business_id
  )
  on conflict (user_id)
  do update set
    active_business_id = excluded.active_business_id,
    updated_at = now();

  return jsonb_build_object(
    'deleted_business_id', p_business_id,
    'active_business_id', v_next_business_id
  );
end;
$$;


ALTER FUNCTION "public"."delete_business_workspace"("p_business_id" "uuid", "p_confirmation_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_debt_with_linked_transactions"("p_debt_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_transaction_ids uuid[] := '{}'::uuid[];
  v_payment_count integer := 0;
  v_deleted_payment_count integer := 0;
  v_deleted_debt_count integer := 0;
  v_deleted_transaction_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.' using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    coalesce(
      array_agg(distinct payment_record.transaction_id)
        filter (where payment_record.transaction_id is not null),
      '{}'::uuid[]
    )
  into v_payment_count, v_transaction_ids
  from public.debt_payments as payment_record
  where payment_record.debt_id = p_debt_id
    and payment_record.user_id = v_user_id;

  -- Do not rely on ON DELETE CASCADE. Some existing databases may still have
  -- an older NO ACTION / RESTRICT foreign key on debt_payments.debt_id.
  delete from public.debt_payments
  where debt_id = p_debt_id
    and user_id = v_user_id;
  get diagnostics v_deleted_payment_count = row_count;

  delete from public.debts
  where id = p_debt_id
    and user_id = v_user_id;
  get diagnostics v_deleted_debt_count = row_count;

  if v_deleted_debt_count <> 1 then
    raise exception 'Debt could not be deleted.' using errcode = 'P0001';
  end if;

  if cardinality(v_transaction_ids) > 0 then
    delete from public.transactions
    where user_id = v_user_id
      and id = any(v_transaction_ids);
    get diagnostics v_deleted_transaction_count = row_count;
  end if;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'deleted_debt_count', v_deleted_debt_count,
    'deleted_payment_count', v_deleted_payment_count,
    'expected_payment_count', v_payment_count,
    'deleted_transaction_count', v_deleted_transaction_count,
    'deleted_transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;


ALTER FUNCTION "public"."delete_debt_with_linked_transactions"("p_debt_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_debt_with_linked_transactions"("p_debt_id" "uuid") IS 'Atomically deletes a customer-owned debt, its payment history and linked transactions.';



CREATE OR REPLACE FUNCTION "public"."delete_debt_with_payments"("p_debt_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts;
  v_transaction_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_debt
  from public.debts
  where id = p_debt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.';
  end if;

  select coalesce(array_agg(transaction_id) filter (where transaction_id is not null), '{}'::uuid[])
  into v_transaction_ids
  from public.debt_payments
  where debt_id = p_debt_id and user_id = v_user_id;

  delete from public.debts
  where id = p_debt_id and user_id = v_user_id;

  if cardinality(v_transaction_ids) > 0 then
    delete from public.transactions
    where user_id = v_user_id and id = any(v_transaction_ids);
  end if;

  return jsonb_build_object('debt', to_jsonb(v_debt));
end;
$$;


ALTER FUNCTION "public"."delete_debt_with_payments"("p_debt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_goal_with_investments"("p_goal_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals;
  v_transaction_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_goal
  from public.goals
  where id = p_goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found.';
  end if;

  select coalesce(array_agg(transaction_id), '{}'::uuid[])
  into v_transaction_ids
  from public.goal_investments
  where goal_id = p_goal_id and user_id = v_user_id;

  delete from public.goals
  where id = p_goal_id and user_id = v_user_id;

  if cardinality(v_transaction_ids) > 0 then
    delete from public.transactions
    where user_id = v_user_id and id = any(v_transaction_ids);
  end if;

  return jsonb_build_object('goal', to_jsonb(v_goal));
end;
$$;


ALTER FUNCTION "public"."delete_goal_with_investments"("p_goal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_transactions_with_linked_bills"("p_transaction_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_ids uuid[] := '{}'::uuid[];
  v_deleted_transaction_count integer := 0;
  v_deleted_bill_count integer := 0;
  v_reversed_debt_payment_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_transaction_ids is null or cardinality(p_transaction_ids) = 0 then
    raise exception 'Choose at least one transaction.' using errcode = '22023';
  end if;

  select coalesce(array_agg(transaction_row.id), '{}'::uuid[])
  into v_transaction_ids
  from (
    select transaction_record.id
    from public.transactions as transaction_record
    where transaction_record.user_id = v_user_id
      and transaction_record.id = any(p_transaction_ids)
    for update
  ) as transaction_row;

  if cardinality(v_transaction_ids) = 0 then
    raise exception 'No matching transactions were found.' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into v_reversed_debt_payment_count
  from public.debt_payments as payment_record
  where payment_record.user_id = v_user_id
    and payment_record.transaction_id = any(v_transaction_ids);

  delete from public.bills
  where user_id = v_user_id
    and transaction_id = any(v_transaction_ids);
  get diagnostics v_deleted_bill_count = row_count;

  -- The existing BEFORE DELETE trigger restores linked debt payments.
  delete from public.transactions
  where user_id = v_user_id
    and id = any(v_transaction_ids);
  get diagnostics v_deleted_transaction_count = row_count;

  return jsonb_build_object(
    'deleted_transaction_count', v_deleted_transaction_count,
    'deleted_bill_count', v_deleted_bill_count,
    'reversed_debt_payment_count', v_reversed_debt_payment_count,
    'deleted_transaction_ids', to_jsonb(v_transaction_ids)
  );
end;
$$;


ALTER FUNCTION "public"."delete_transactions_with_linked_bills"("p_transaction_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_transactions_with_linked_bills"("p_transaction_ids" "uuid"[]) IS 'Deletes customer-owned cash transactions, linked Bills, and reverses linked confirmed debt payments.';



CREATE OR REPLACE FUNCTION "public"."enforce_manual_debt_payment_confirmation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if lower(coalesce(new.category, '')) <> 'credit card' then
    new.autopay := false;
    new.autopay_enabled_at := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_manual_debt_payment_confirmation"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_manual_debt_payment_confirmation"() IS 'Prevents non-credit-card debts from being marked paid by the automatic schedule before the user confirms the payment.';



CREATE OR REPLACE FUNCTION "public"."ficonter_debt_due_date"("p_reference_date" "date", "p_due_day" integer) RETURNS "date"
    LANGUAGE "sql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog', 'pg_temp'
    AS $$
  with month_values as (
    select
      date_trunc('month', p_reference_date)::date as month_start,
      (date_trunc('month', p_reference_date) + interval '1 month - 1 day')::date
        as month_end
  )
  select make_date(
    extract(year from month_start)::integer,
    extract(month from month_start)::integer,
    least(
      greatest(coalesce(p_due_day, 1), 1),
      extract(day from month_end)::integer
    )
  )
  from month_values;
$$;


ALTER FUNCTION "public"."ficonter_debt_due_date"("p_reference_date" "date", "p_due_day" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ficonter_next_bill_due_date"("p_due_date" "date", "p_recurrence" "text", "p_anchor_day" integer, "p_anchor_month_end" boolean) RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog', 'pg_temp'
    AS $$
declare
  v_months integer;
  v_month_start date;
  v_month_end date;
  v_day integer;
begin
  case p_recurrence
    when 'weekly' then return p_due_date + 7;
    when 'biweekly' then return p_due_date + 14;
    when 'monthly' then v_months := 1;
    when 'quarterly' then v_months := 3;
    when 'semiannual' then v_months := 6;
    when 'yearly' then v_months := 12;
    else return null;
  end case;

  v_month_start :=
    (date_trunc('month', p_due_date)::date + make_interval(months => v_months))::date;
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  if coalesce(p_anchor_month_end, false) then
    return v_month_end;
  end if;

  v_day := least(
    greatest(coalesce(p_anchor_day, extract(day from p_due_date)::integer), 1),
    extract(day from v_month_end)::integer
  );

  return make_date(
    extract(year from v_month_start)::integer,
    extract(month from v_month_start)::integer,
    v_day
  );
end;
$$;


ALTER FUNCTION "public"."ficonter_next_bill_due_date"("p_due_date" "date", "p_recurrence" "text", "p_anchor_day" integer, "p_anchor_month_end" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ficonter_record_bill_occurrence"("p_bill_id" "uuid", "p_user_id" "uuid", "p_occurrence_date" "date", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog', 'pg_temp'
    AS $$
declare
  v_bill public.bills%rowtype;
  v_transaction public.transactions%rowtype;
  v_run public.automatic_payment_runs%rowtype;
  v_next_due_date date;
  v_occurrence_key text := to_char(p_occurrence_date, 'YYYY-MM-DD');
begin
  if p_user_id is null then
    raise exception 'A user is required.' using errcode = '42501';
  end if;

  if p_trigger_mode not in ('automatic', 'manual') then
    raise exception 'Invalid trigger mode.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ficonter:bill:' || p_bill_id::text || ':' || v_occurrence_key,
      0
    )
  );

  select run_record.*
  into v_run
  from public.automatic_payment_runs as run_record
  where run_record.source_type = 'bill'
    and run_record.source_id = p_bill_id
    and run_record.occurrence_key = v_occurrence_key
    and run_record.status = 'completed';

  if found then
    select bill_record.*
    into v_bill
    from public.bills as bill_record
    where bill_record.id = p_bill_id
      and bill_record.user_id = p_user_id;

    if v_run.transaction_id is not null then
      select transaction_record.*
      into v_transaction
      from public.transactions as transaction_record
      where transaction_record.id = v_run.transaction_id
        and transaction_record.user_id = p_user_id;
    end if;

    return jsonb_build_object(
      'bill', to_jsonb(v_bill),
      'transaction', to_jsonb(v_transaction),
      'run', to_jsonb(v_run),
      'already_recorded', true,
      'recurring', coalesce(v_bill.recurrence, 'none') <> 'none',
      'next_due_date', v_bill.due_date
    );
  end if;

  select bill_record.*
  into v_bill
  from public.bills as bill_record
  where bill_record.id = p_bill_id
    and bill_record.user_id = p_user_id
  for update;

  if not found then
    raise exception 'The bill was not found.' using errcode = 'P0002';
  end if;

  if v_bill.status = 'cancelled' then
    raise exception 'A cancelled bill cannot be recorded.' using errcode = '22023';
  end if;

  if v_bill.recurrence = 'none' and v_bill.status = 'paid' then
    raise exception 'This one-time bill is already paid.' using errcode = '22023';
  end if;

  if v_bill.due_date <> p_occurrence_date then
    raise exception 'The bill schedule changed before it was recorded.'
      using errcode = '40001';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  )
  values (
    v_bill.user_id,
    case
      when nullif(btrim(coalesce(v_bill.company, '')), '') is null then v_bill.name
      else v_bill.name || ' · ' || v_bill.company
    end,
    v_bill.amount,
    v_bill.currency,
    v_bill.amount_eur,
    v_bill.exchange_rate_to_eur,
    p_transaction_date,
    case
      when p_trigger_mode = 'automatic' then 'Automatic bill schedule'
      else 'Bill conversion'
    end,
    'expense',
    v_bill.category,
    p_transaction_date,
    p_occurred_at
  )
  returning * into v_transaction;

  if v_bill.recurrence = 'none' then
    update public.bills
    set
      status = 'paid',
      paid_at = p_occurred_at,
      transaction_id = v_transaction.id,
      updated_at = now()
    where id = v_bill.id
      and user_id = v_bill.user_id
    returning * into v_bill;

    v_next_due_date := null;
  else
    v_next_due_date := public.ficonter_next_bill_due_date(
      v_bill.due_date,
      v_bill.recurrence,
      v_bill.recurrence_anchor_day,
      v_bill.recurrence_anchor_month_end
    );

    if v_next_due_date is null or v_next_due_date <= v_bill.due_date then
      raise exception 'The next recurring due date could not be calculated.';
    end if;

    update public.bills
    set
      status = 'pending',
      paid_at = p_occurred_at,
      transaction_id = null,
      due_date = v_next_due_date,
      updated_at = now()
    where id = v_bill.id
      and user_id = v_bill.user_id
    returning * into v_bill;
  end if;

  insert into public.automatic_payment_runs (
    user_id,
    source_type,
    source_id,
    occurrence_key,
    scheduled_for,
    amount,
    currency,
    amount_eur,
    transaction_id,
    debt_payment_id,
    trigger_mode,
    status,
    error_message,
    processed_at
  )
  values (
    v_bill.user_id,
    'bill',
    v_bill.id,
    v_occurrence_key,
    p_occurred_at,
    v_transaction.amount,
    v_transaction.currency,
    v_transaction.amount_eur,
    v_transaction.id,
    null,
    p_trigger_mode,
    'completed',
    null,
    now()
  )
  on conflict (source_type, source_id, occurrence_key)
  do update set
    user_id = excluded.user_id,
    scheduled_for = excluded.scheduled_for,
    amount = excluded.amount,
    currency = excluded.currency,
    amount_eur = excluded.amount_eur,
    transaction_id = excluded.transaction_id,
    debt_payment_id = null,
    trigger_mode = excluded.trigger_mode,
    status = 'completed',
    error_message = null,
    processed_at = now()
  returning * into v_run;

  return jsonb_build_object(
    'bill', to_jsonb(v_bill),
    'transaction', to_jsonb(v_transaction),
    'run', to_jsonb(v_run),
    'already_recorded', false,
    'recurring', v_bill.recurrence <> 'none',
    'next_due_date', v_next_due_date
  );
end;
$$;


ALTER FUNCTION "public"."ficonter_record_bill_occurrence"("p_bill_id" "uuid", "p_user_id" "uuid", "p_occurrence_date" "date", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ficonter_record_debt_occurrence"("p_debt_id" "uuid", "p_user_id" "uuid", "p_occurrence_key" "text", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog', 'pg_temp'
    AS $$
declare
  v_debt public.debts%rowtype;
  v_transaction public.transactions%rowtype;
  v_payment public.debt_payments%rowtype;
  v_run public.automatic_payment_runs%rowtype;
  v_amount numeric(16,2);
  v_amount_eur numeric(16,2);
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if p_user_id is null then
    raise exception 'A user is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'ficonter:debt:' || p_debt_id::text || ':' || p_occurrence_key,
      0
    )
  );

  select run_record.*
  into v_run
  from public.automatic_payment_runs as run_record
  where run_record.source_type = 'debt'
    and run_record.source_id = p_debt_id
    and run_record.occurrence_key = p_occurrence_key
    and run_record.status = 'completed';

  if found then
    select debt_record.*
    into v_debt
    from public.debts as debt_record
    where debt_record.id = p_debt_id
      and debt_record.user_id = p_user_id;

    return jsonb_build_object(
      'debt', to_jsonb(v_debt),
      'run', to_jsonb(v_run),
      'already_recorded', true
    );
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = p_user_id
  for update;

  if not found then
    raise exception 'The debt was not found.' using errcode = 'P0002';
  end if;

  if v_debt.status <> 'active' or v_debt.current_balance <= 0 then
    raise exception 'The debt is not active.' using errcode = '22023';
  end if;

  if v_debt.minimum_payment <= 0 or v_debt.payment_due_day is null then
    raise exception 'The debt has no valid monthly minimum schedule.'
      using errcode = '22023';
  end if;

  v_amount := least(v_debt.minimum_payment, v_debt.current_balance);
  v_amount_eur := least(
    v_debt.current_balance_eur,
    round(v_amount * v_debt.exchange_rate_to_eur, 2)
  );

  if v_amount <= 0 or v_amount_eur <= 0 then
    raise exception 'The scheduled debt amount is invalid.';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  )
  values (
    v_debt.user_id,
    'Debt payment · ' || v_debt.name,
    v_amount,
    v_debt.currency,
    v_amount_eur,
    v_debt.exchange_rate_to_eur,
    p_transaction_date,
    case
      when p_trigger_mode = 'automatic' then 'Automatic debt schedule'
      else 'Debt payment conversion'
    end,
    'expense',
    'Debt repayment',
    p_transaction_date,
    p_occurred_at
  )
  returning * into v_transaction;

  v_new_balance := greatest(0, v_debt.current_balance - v_amount);
  v_new_balance_eur := greatest(0, v_debt.current_balance_eur - v_amount_eur);

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    status = case when v_new_balance = 0 then 'paid_off' else status end,
    autopay = case when v_new_balance = 0 then false else autopay end,
    autopay_enabled_at =
      case when v_new_balance = 0 then null else autopay_enabled_at end,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_debt.user_id
  returning * into v_debt;

  insert into public.debt_payments (
    debt_id,
    user_id,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    paid_at,
    notes,
    transaction_id
  )
  values (
    v_debt.id,
    v_debt.user_id,
    v_amount,
    v_debt.currency,
    v_amount_eur,
    v_debt.exchange_rate_to_eur,
    p_occurred_at,
    'Automatically recorded monthly minimum',
    v_transaction.id
  )
  returning * into v_payment;

  insert into public.automatic_payment_runs (
    user_id,
    source_type,
    source_id,
    occurrence_key,
    scheduled_for,
    amount,
    currency,
    amount_eur,
    transaction_id,
    debt_payment_id,
    trigger_mode,
    status,
    error_message,
    processed_at
  )
  values (
    v_debt.user_id,
    'debt',
    v_debt.id,
    p_occurrence_key,
    p_occurred_at,
    v_amount,
    v_debt.currency,
    v_amount_eur,
    v_transaction.id,
    v_payment.id,
    p_trigger_mode,
    'completed',
    null,
    now()
  )
  on conflict (source_type, source_id, occurrence_key)
  do update set
    user_id = excluded.user_id,
    scheduled_for = excluded.scheduled_for,
    amount = excluded.amount,
    currency = excluded.currency,
    amount_eur = excluded.amount_eur,
    transaction_id = excluded.transaction_id,
    debt_payment_id = excluded.debt_payment_id,
    trigger_mode = excluded.trigger_mode,
    status = 'completed',
    error_message = null,
    processed_at = now()
  returning * into v_run;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'transaction', to_jsonb(v_transaction),
    'run', to_jsonb(v_run),
    'already_recorded', false
  );
end;
$$;


ALTER FUNCTION "public"."ficonter_record_debt_occurrence"("p_debt_id" "uuid", "p_user_id" "uuid", "p_occurrence_key" "text", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ficonter_safe_timezone"("p_timezone" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog', 'pg_temp'
    AS $$
begin
  if p_timezone is null or btrim(p_timezone) = '' then
    return 'UTC';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    return p_timezone;
  end if;

  return 'UTC';
end;
$$;


ALTER FUNCTION "public"."ficonter_safe_timezone"("p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ficonter_scheduled_timestamp"("p_date" "date", "p_time" time without time zone, "p_timezone" "text") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog', 'pg_temp'
    AS $$
  select
    (p_date + coalesce(p_time, time '09:00'))
    at time zone public.ficonter_safe_timezone(p_timezone);
$$;


ALTER FUNCTION "public"."ficonter_scheduled_timestamp"("p_date" "date", "p_time" time without time zone, "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_insights_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_cash_flow jsonb;
  v_financial_independence jsonb;
  v_preferences jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  -- These two aggregate functions already compose every Phase 2 source of truth.
  v_cash_flow := public.get_cash_flow_intelligence_inputs_v2();
  v_financial_independence := public.get_financial_independence_inputs();

  select jsonb_build_object(
    'enabled', preferences.enabled,
    'consentVersion', preferences.consent_version,
    'consentedAt', preferences.consented_at,
    'updatedAt', preferences.updated_at
  )
  into v_preferences
  from public.ai_insight_preferences preferences
  where preferences.user_id = v_user_id;

  if v_preferences is null then
    v_preferences := jsonb_build_object(
      'enabled', false,
      'consentVersion', null,
      'consentedAt', null,
      'updatedAt', null
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'cashFlow', v_cash_flow,
    'financialIndependence', v_financial_independence,
    'preferences', v_preferences
  );
end;
$$;


ALTER FUNCTION "public"."get_ai_insights_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ai_insights_inputs"() IS 'Returns privacy-scoped aggregate inputs for AI Insights by composing existing Wealth Engine sources of truth.';



CREATE OR REPLACE FUNCTION "public"."get_business_overview"("p_business_id" "uuid", "p_month" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_lifetime_balance numeric := 0;
  v_transaction_count integer := 0;
  v_recent jsonb := '[]'::jsonb;
begin
  if not public.business_member_has_access(p_business_id) then
    raise exception 'Business access is required.';
  end if;

  select
    coalesce(sum(amount_base) filter (where type = 'income'), 0),
    coalesce(sum(amount_base) filter (where type = 'expense'), 0),
    count(*)::integer
  into v_revenue, v_expenses, v_transaction_count
  from public.business_transactions
  where business_id = p_business_id
    and transaction_date >= v_month_start
    and transaction_date < v_month_end;

  select coalesce(sum(
    case when type = 'income' then amount_base else -amount_base end
  ), 0)
  into v_lifetime_balance
  from public.business_transactions
  where business_id = p_business_id;

  select coalesce(jsonb_agg(to_jsonb(recent_row)), '[]'::jsonb)
  into v_recent
  from (
    select
      id,
      description,
      counterparty,
      type,
      category,
      amount,
      currency,
      amount_base,
      transaction_date,
      occurred_at
    from public.business_transactions
    where business_id = p_business_id
    order by occurred_at desc
    limit 8
  ) recent_row;

  return jsonb_build_object(
    'month', to_char(v_month_start, 'YYYY-MM'),
    'revenue', v_revenue,
    'expenses', v_expenses,
    'operatingResult', v_revenue - v_expenses,
    'lifetimeBalance', v_lifetime_balance,
    'transactionCount', v_transaction_count,
    'recentTransactions', v_recent
  );
end;
$$;


ALTER FUNCTION "public"."get_business_overview"("p_business_id" "uuid", "p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_business_profitability_report"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_day_count integer;
  v_prior_start date;
  v_prior_end date;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.business_member_has_access(p_business_id) then
    raise exception 'Business access is required.';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'A report start date and end date are required.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'The report end date cannot be earlier than the start date.';
  end if;

  v_day_count := (p_end_date - p_start_date) + 1;
  if v_day_count > 1827 then
    raise exception 'A single report can cover at most five years.';
  end if;

  v_prior_end := p_start_date - 1;
  v_prior_start := v_prior_end - (v_day_count - 1);

  with
  current_tx as (
    select txrow.*
    from public.business_transactions txrow
    where txrow.business_id = p_business_id
      and txrow.transaction_date between p_start_date and p_end_date
  ),
  prior_tx as (
    select txrow.*
    from public.business_transactions txrow
    where txrow.business_id = p_business_id
      and txrow.transaction_date between v_prior_start and v_prior_end
  ),
  current_sales as (
    select sale.*
    from public.business_sales sale
    where sale.business_id = p_business_id
      and sale.status = 'completed'
      and sale.sale_date between p_start_date and p_end_date
  ),
  prior_sales as (
    select sale.*
    from public.business_sales sale
    where sale.business_id = p_business_id
      and sale.status = 'completed'
      and sale.sale_date between v_prior_start and v_prior_end
  ),
  current_lines as (
    select
      line.*,
      sale.subtotal_base as sale_subtotal_base,
      sale.net_sales_base as sale_net_sales_base
    from public.business_sale_lines line
    join current_sales sale on sale.id = line.sale_id
  ),
  current_tx_summary as (
    select
      coalesce(sum(amount_base) filter (where type = 'income'), 0) as cash_inflow,
      coalesce(sum(amount_base) filter (where type = 'expense'), 0) as cash_outflow,
      coalesce(sum(amount_base) filter (
        where type = 'income' and source_sale_id is null
      ), 0) as other_income,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and source_inventory_movement_id is null
          and lower(category) <> 'inventory purchases'
      ), 0) as operating_expenses,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and (
            source_inventory_movement_id is not null
            or lower(category) = 'inventory purchases'
          )
      ), 0) as inventory_purchases,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and source_inventory_movement_id is null
          and lower(category) <> 'inventory purchases'
          and cost_nature = 'fixed'
      ), 0) as fixed_costs,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and source_inventory_movement_id is null
          and lower(category) <> 'inventory purchases'
          and cost_nature = 'variable'
      ), 0) as variable_costs
    from current_tx
  ),
  prior_tx_summary as (
    select
      coalesce(sum(amount_base) filter (where type = 'income'), 0) as cash_inflow,
      coalesce(sum(amount_base) filter (where type = 'expense'), 0) as cash_outflow,
      coalesce(sum(amount_base) filter (
        where type = 'income' and source_sale_id is null
      ), 0) as other_income,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and source_inventory_movement_id is null
          and lower(category) <> 'inventory purchases'
      ), 0) as operating_expenses,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and (
            source_inventory_movement_id is not null
            or lower(category) = 'inventory purchases'
          )
      ), 0) as inventory_purchases,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and source_inventory_movement_id is null
          and lower(category) <> 'inventory purchases'
          and cost_nature = 'fixed'
      ), 0) as fixed_costs,
      coalesce(sum(amount_base) filter (
        where type = 'expense'
          and source_inventory_movement_id is null
          and lower(category) <> 'inventory purchases'
          and cost_nature = 'variable'
      ), 0) as variable_costs
    from prior_tx
  ),
  current_sales_summary as (
    select
      coalesce(sum(net_sales_base), 0) as net_sales,
      coalesce(sum(tax_base), 0) as sales_tax,
      coalesce(sum(discount_base), 0) as discounts,
      coalesce(sum(cogs_base), 0) as cogs,
      coalesce(sum(gross_profit_base), 0) as gross_profit,
      count(*)::integer as sales_count,
      coalesce(sum(units_sold), 0) as units_sold
    from current_sales
  ),
  prior_sales_summary as (
    select
      coalesce(sum(net_sales_base), 0) as net_sales,
      coalesce(sum(tax_base), 0) as sales_tax,
      coalesce(sum(discount_base), 0) as discounts,
      coalesce(sum(cogs_base), 0) as cogs,
      coalesce(sum(gross_profit_base), 0) as gross_profit,
      count(*)::integer as sales_count,
      coalesce(sum(units_sold), 0) as units_sold
    from prior_sales
  ),
  current_summary as (
    select
      tx.cash_inflow,
      tx.cash_outflow,
      tx.cash_inflow - tx.cash_outflow as cash_movement,
      sale.net_sales,
      sale.sales_tax,
      sale.discounts,
      tx.other_income,
      sale.net_sales + tx.other_income as operating_income,
      sale.cogs,
      sale.gross_profit,
      tx.operating_expenses,
      tx.inventory_purchases,
      tx.fixed_costs,
      tx.variable_costs,
      sale.gross_profit + tx.other_income - tx.operating_expenses as operating_profit,
      case when sale.net_sales > 0
        then sale.gross_profit / sale.net_sales * 100 else 0 end as gross_margin,
      case when sale.net_sales + tx.other_income > 0
        then (sale.gross_profit + tx.other_income - tx.operating_expenses)
          / (sale.net_sales + tx.other_income) * 100 else 0 end as operating_margin,
      sale.sales_count,
      sale.units_sold,
      case when sale.sales_count > 0
        then sale.net_sales / sale.sales_count else 0 end as average_net_sale
    from current_tx_summary tx
    cross join current_sales_summary sale
  ),
  prior_summary as (
    select
      tx.cash_inflow,
      tx.cash_outflow,
      tx.cash_inflow - tx.cash_outflow as cash_movement,
      sale.net_sales,
      sale.sales_tax,
      sale.discounts,
      tx.other_income,
      sale.net_sales + tx.other_income as operating_income,
      sale.cogs,
      sale.gross_profit,
      tx.operating_expenses,
      tx.inventory_purchases,
      tx.fixed_costs,
      tx.variable_costs,
      sale.gross_profit + tx.other_income - tx.operating_expenses as operating_profit,
      case when sale.net_sales > 0
        then sale.gross_profit / sale.net_sales * 100 else 0 end as gross_margin,
      case when sale.net_sales + tx.other_income > 0
        then (sale.gross_profit + tx.other_income - tx.operating_expenses)
          / (sale.net_sales + tx.other_income) * 100 else 0 end as operating_margin,
      sale.sales_count,
      sale.units_sold,
      case when sale.sales_count > 0
        then sale.net_sales / sale.sales_count else 0 end as average_net_sale
    from prior_tx_summary tx
    cross join prior_sales_summary sale
  ),
  budget_summary as (
    select coalesce(sum(
      budget.amount_base
      * (
          least(
            p_end_date,
            (budget.budget_month + interval '1 month - 1 day')::date
          )
          - greatest(p_start_date, budget.budget_month)
          + 1
        )::numeric
      / extract(
          day from (budget.budget_month + interval '1 month - 1 day')::date
        )::numeric
    ), 0) as planned_operating_costs
    from public.business_cost_budgets budget
    join public.business_cost_categories category
      on category.id = budget.category_id
    where budget.business_id = p_business_id
      and lower(category.name) <> 'inventory purchases'
      and budget.budget_month <= p_end_date
      and (budget.budget_month + interval '1 month - 1 day')::date >= p_start_date
  ),
  inventory_snapshot as (
    select
      count(*) filter (where status = 'active')::integer as active_items,
      coalesce(sum(quantity_on_hand) filter (where status = 'active'), 0) as total_quantity,
      coalesce(sum(inventory_value_base) filter (where status = 'active'), 0) as inventory_value,
      coalesce(sum(potential_sales_value_base) filter (where status = 'active'), 0) as potential_sales_value,
      count(*) filter (
        where status = 'active'
          and quantity_on_hand <= low_stock_threshold
      )::integer as low_stock_items
    from public.business_inventory_item_balances
    where business_id = p_business_id
  ),
  invoice_snapshot as (
    select
      count(*) filter (where status = 'open')::integer as open_count,
      coalesce(sum(amount_base) filter (where status = 'open'), 0) as open_amount,
      count(*) filter (
        where status = 'open' and due_date < current_date
      )::integer as overdue_count,
      coalesce(sum(amount_base) filter (
        where status = 'open' and due_date < current_date
      ), 0) as overdue_amount
    from public.business_supplier_invoices
    where business_id = p_business_id
  ),
  report_months as (
    select generate_series(
      date_trunc('month', p_start_date::timestamp)::date,
      date_trunc('month', p_end_date::timestamp)::date,
      interval '1 month'
    )::date as month_start
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'range', jsonb_build_object(
      'startDate', p_start_date,
      'endDate', p_end_date,
      'priorStartDate', v_prior_start,
      'priorEndDate', v_prior_end,
      'dayCount', v_day_count
    ),
    'summary', jsonb_build_object(
      'cashInflow', current.cash_inflow,
      'cashOutflow', current.cash_outflow,
      'cashMovement', current.cash_movement,
      'netSales', current.net_sales,
      'salesTax', current.sales_tax,
      'discounts', current.discounts,
      'otherIncome', current.other_income,
      'operatingIncome', current.operating_income,
      'cogs', current.cogs,
      'grossProfit', current.gross_profit,
      'operatingExpenses', current.operating_expenses,
      'inventoryPurchases', current.inventory_purchases,
      'fixedCosts', current.fixed_costs,
      'variableCosts', current.variable_costs,
      'operatingProfit', current.operating_profit,
      'grossMargin', current.gross_margin,
      'operatingMargin', current.operating_margin,
      'salesCount', current.sales_count,
      'unitsSold', current.units_sold,
      'averageNetSale', current.average_net_sale
    ),
    'priorSummary', jsonb_build_object(
      'cashInflow', prior.cash_inflow,
      'cashOutflow', prior.cash_outflow,
      'cashMovement', prior.cash_movement,
      'netSales', prior.net_sales,
      'salesTax', prior.sales_tax,
      'discounts', prior.discounts,
      'otherIncome', prior.other_income,
      'operatingIncome', prior.operating_income,
      'cogs', prior.cogs,
      'grossProfit', prior.gross_profit,
      'operatingExpenses', prior.operating_expenses,
      'inventoryPurchases', prior.inventory_purchases,
      'fixedCosts', prior.fixed_costs,
      'variableCosts', prior.variable_costs,
      'operatingProfit', prior.operating_profit,
      'grossMargin', prior.gross_margin,
      'operatingMargin', prior.operating_margin,
      'salesCount', prior.sales_count,
      'unitsSold', prior.units_sold,
      'averageNetSale', prior.average_net_sale
    ),
    'budget', jsonb_build_object(
      'plannedOperatingCosts', budget.planned_operating_costs,
      'actualOperatingCosts', current.operating_expenses,
      'remaining', budget.planned_operating_costs - current.operating_expenses,
      'usagePercentage', case when budget.planned_operating_costs > 0
        then current.operating_expenses / budget.planned_operating_costs * 100
        else 0 end,
      'hasBudget', budget.planned_operating_costs > 0
    ),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(month.month_start, 'YYYY-MM'),
          'netSales', coalesce((
            select sum(sale.net_sales_base)
            from current_sales sale
            where date_trunc('month', sale.sale_date)::date = month.month_start
          ), 0),
          'otherIncome', coalesce((
            select sum(txrow.amount_base)
            from current_tx txrow
            where txrow.type = 'income'
              and txrow.source_sale_id is null
              and date_trunc('month', txrow.transaction_date)::date = month.month_start
          ), 0),
          'cogs', coalesce((
            select sum(sale.cogs_base)
            from current_sales sale
            where date_trunc('month', sale.sale_date)::date = month.month_start
          ), 0),
          'grossProfit', coalesce((
            select sum(sale.gross_profit_base)
            from current_sales sale
            where date_trunc('month', sale.sale_date)::date = month.month_start
          ), 0),
          'operatingExpenses', coalesce((
            select sum(txrow.amount_base)
            from current_tx txrow
            where txrow.type = 'expense'
              and txrow.source_inventory_movement_id is null
              and lower(txrow.category) <> 'inventory purchases'
              and date_trunc('month', txrow.transaction_date)::date = month.month_start
          ), 0),
          'inventoryPurchases', coalesce((
            select sum(txrow.amount_base)
            from current_tx txrow
            where txrow.type = 'expense'
              and (
                txrow.source_inventory_movement_id is not null
                or lower(txrow.category) = 'inventory purchases'
              )
              and date_trunc('month', txrow.transaction_date)::date = month.month_start
          ), 0),
          'operatingProfit',
            coalesce((
              select sum(sale.gross_profit_base)
              from current_sales sale
              where date_trunc('month', sale.sale_date)::date = month.month_start
            ), 0)
            + coalesce((
              select sum(txrow.amount_base)
              from current_tx txrow
              where txrow.type = 'income'
                and txrow.source_sale_id is null
                and date_trunc('month', txrow.transaction_date)::date = month.month_start
            ), 0)
            - coalesce((
              select sum(txrow.amount_base)
              from current_tx txrow
              where txrow.type = 'expense'
                and txrow.source_inventory_movement_id is null
                and lower(txrow.category) <> 'inventory purchases'
                and date_trunc('month', txrow.transaction_date)::date = month.month_start
            ), 0),
          'cashMovement',
            coalesce((
              select sum(txrow.amount_base)
              from current_tx txrow
              where txrow.type = 'income'
                and date_trunc('month', txrow.transaction_date)::date = month.month_start
            ), 0)
            - coalesce((
              select sum(txrow.amount_base)
              from current_tx txrow
              where txrow.type = 'expense'
                and date_trunc('month', txrow.transaction_date)::date = month.month_start
            ), 0)
        ) order by month.month_start
      )
      from report_months month
    ), '[]'::jsonb),
    'costCategories', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data.amount desc)
      from (
        select
          txrow.cost_category_id as id,
          txrow.category as name,
          sum(txrow.amount_base) as amount,
          case when current.operating_expenses > 0
            then sum(txrow.amount_base) / current.operating_expenses * 100
            else 0 end as percentage,
          count(*)::integer as "transactionCount"
        from current_tx txrow
        where txrow.type = 'expense'
          and txrow.source_inventory_movement_id is null
          and lower(txrow.category) <> 'inventory purchases'
        group by txrow.cost_category_id, txrow.category
        order by amount desc
        limit 12
      ) row_data
    ), '[]'::jsonb),
    'costCentres', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data.amount desc)
      from (
        select
          txrow.cost_centre_id as id,
          coalesce(centre.name, 'Unassigned') as name,
          sum(txrow.amount_base) as amount,
          case when current.operating_expenses > 0
            then sum(txrow.amount_base) / current.operating_expenses * 100
            else 0 end as percentage,
          count(*)::integer as "transactionCount"
        from current_tx txrow
        left join public.business_cost_centres centre
          on centre.id = txrow.cost_centre_id
        where txrow.type = 'expense'
          and txrow.source_inventory_movement_id is null
          and lower(txrow.category) <> 'inventory purchases'
        group by txrow.cost_centre_id, centre.name
        order by amount desc
        limit 12
      ) row_data
    ), '[]'::jsonb),
    'suppliers', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data."totalSpend" desc)
      from (
        select
          supplier.id,
          supplier.name,
          coalesce(sum(txrow.amount_base) filter (
            where txrow.source_inventory_movement_id is null
              and lower(txrow.category) <> 'inventory purchases'
          ), 0) as "operatingSpend",
          coalesce(sum(txrow.amount_base) filter (
            where txrow.source_inventory_movement_id is not null
              or lower(txrow.category) = 'inventory purchases'
          ), 0) as "inventoryPurchases",
          coalesce(sum(txrow.amount_base), 0) as "totalSpend",
          count(*)::integer as "transactionCount"
        from current_tx txrow
        join public.business_suppliers supplier
          on supplier.id = txrow.supplier_id
        where txrow.type = 'expense'
        group by supplier.id, supplier.name
        order by "totalSpend" desc
        limit 12
      ) row_data
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data."grossProfit" desc)
      from (
        select
          coalesce(line.inventory_item_id::text, 'service:' || lower(line.item_name)) as id,
          line.item_name as name,
          max(line.item_sku) as sku,
          sum(line.quantity) as quantity,
          round(sum(
            case when line.sale_subtotal_base > 0
              then line.line_subtotal_base
                * line.sale_net_sales_base / line.sale_subtotal_base
              else 0 end
          ), 2) as "netSales",
          round(sum(line.cogs_base), 2) as cogs,
          round(sum(
            case when line.sale_subtotal_base > 0
              then line.line_subtotal_base
                * line.sale_net_sales_base / line.sale_subtotal_base
              else 0 end
          ) - sum(line.cogs_base), 2) as "grossProfit",
          case when sum(
            case when line.sale_subtotal_base > 0
              then line.line_subtotal_base
                * line.sale_net_sales_base / line.sale_subtotal_base
              else 0 end
          ) > 0 then
            (
              sum(
                case when line.sale_subtotal_base > 0
                  then line.line_subtotal_base
                    * line.sale_net_sales_base / line.sale_subtotal_base
                  else 0 end
              ) - sum(line.cogs_base)
            )
            / sum(
                case when line.sale_subtotal_base > 0
                  then line.line_subtotal_base
                    * line.sale_net_sales_base / line.sale_subtotal_base
                  else 0 end
              ) * 100
          else 0 end as "grossMargin",
          count(distinct line.sale_id)::integer as "saleCount"
        from current_lines line
        group by line.inventory_item_id, line.item_name
        order by "grossProfit" desc
        limit 12
      ) row_data
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(to_jsonb(row_data) order by row_data."netSales" desc)
      from (
        select
          coalesce(nullif(trim(sale.customer_name), ''), 'Walk-in / unnamed') as name,
          sum(sale.net_sales_base) as "netSales",
          sum(sale.gross_profit_base) as "grossProfit",
          count(*)::integer as "salesCount"
        from current_sales sale
        group by coalesce(nullif(trim(sale.customer_name), ''), 'Walk-in / unnamed')
        order by "netSales" desc
        limit 12
      ) row_data
    ), '[]'::jsonb),
    'inventory', jsonb_build_object(
      'activeItems', inventory.active_items,
      'totalQuantity', inventory.total_quantity,
      'inventoryValue', inventory.inventory_value,
      'potentialSalesValue', inventory.potential_sales_value,
      'lowStockItems', inventory.low_stock_items
    ),
    'supplierInvoices', jsonb_build_object(
      'openCount', invoice.open_count,
      'openAmount', invoice.open_amount,
      'overdueCount', invoice.overdue_count,
      'overdueAmount', invoice.overdue_amount
    )
  ) into v_result
  from current_summary current
  cross join prior_summary prior
  cross join budget_summary budget
  cross join inventory_snapshot inventory
  cross join invoice_snapshot invoice;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_business_profitability_report"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_business_profitability_report"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date") IS 'Returns an authenticated FICONTER Business management report with P&L, cash reconciliation, budgets, trends, product profitability, supplier spend and current inventory/payables snapshots.';



CREATE OR REPLACE FUNCTION "public"."get_cash_flow_intelligence_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_health jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_health := public.get_financial_health_inputs();

  with month_range as (
    select generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  monthly_transactions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    where user_id = v_user_id
      and transaction_date >= (date_trunc('month', current_date) - interval '11 months')::date
      and transaction_date <= current_date
    group by 1
  ),
  monthly_series as (
    select
      months.month_start,
      coalesce(tx.transaction_count, 0)::integer as transaction_count,
      coalesce(tx.income, 0)::numeric as income,
      coalesce(tx.expenses, 0)::numeric as expenses,
      coalesce(tx.savings, 0)::numeric as savings,
      (coalesce(tx.expenses, 0) + coalesce(tx.savings, 0))::numeric as outflow,
      (
        coalesce(tx.income, 0)
        - coalesce(tx.expenses, 0)
        - coalesce(tx.savings, 0)
      )::numeric as net_cash_flow
    from month_range months
    left join monthly_transactions tx using (month_start)
    order by months.month_start
  ),
  recent_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 89
      and transaction_date <= current_date
    group by 1
  ),
  prior_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 179
      and transaction_date < current_date - 89
    group by 1
  ),
  category_rows as (
    select
      coalesce(recent.category, prior.category) as category,
      coalesce(recent.amount, 0)::numeric as recent_amount,
      coalesce(prior.amount, 0)::numeric as prior_amount
    from recent_categories recent
    full outer join prior_categories prior using (category)
  ),
  category_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category', ranked.category,
          'recentAmount', ranked.recent_amount,
          'priorAmount', ranked.prior_amount
        ) order by ranked.recent_amount desc, ranked.category asc
      ),
      '[]'::jsonb
    ) as items
    from (
      select category, recent_amount, prior_amount
      from category_rows
      where recent_amount > 0 or prior_amount > 0
      order by recent_amount desc, category asc
      limit 8
    ) ranked
  ),
  bill_commitments as (
    select
      ('bill:' || id::text) as id,
      'bill'::text as kind,
      name,
      category,
      due_date,
      coalesce(amount_eur, 0)::numeric as amount
    from public.bills
    where user_id = v_user_id
      and status = 'pending'
      and due_date between current_date and current_date + 30
  ),
  debt_commitments as (
    select
      ('debt:' || id::text) as id,
      'debt'::text as kind,
      name,
      category,
      null::date as due_date,
      coalesce(minimum_payment_eur, 0)::numeric as amount
    from public.debts
    where user_id = v_user_id
      and status <> 'paid_off'
      and coalesce(minimum_payment_eur, 0) > 0
  ),
  commitment_rows as (
    select * from bill_commitments
    union all
    select * from debt_commitments
  ),
  commitment_totals as (
    select
      coalesce(sum(amount) filter (where kind = 'bill'), 0)::numeric as bills_total,
      coalesce(sum(amount) filter (where kind = 'debt'), 0)::numeric as debt_minimums,
      coalesce(sum(amount), 0)::numeric as total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'kind', kind,
            'name', name,
            'category', category,
            'dueDate', due_date,
            'amount', amount
          ) order by due_date asc nulls last, amount desc, name asc
        ),
        '[]'::jsonb
      ) as items
    from commitment_rows
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'financialHealth', v_health,
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'outflow', outflow,
            'netCashFlow', net_cash_flow
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'categories', category_json.items,
    'commitments', jsonb_build_object(
      'total', commitment_totals.total,
      'billsTotal', commitment_totals.bills_total,
      'debtMinimums', commitment_totals.debt_minimums,
      'items', commitment_totals.items
    ),
    'planner', jsonb_build_object(
      'hasPlan', coalesce((v_health #>> '{planner,hasPlan}')::boolean, false),
      'plannedIncome', coalesce((v_health #>> '{planner,plannedIncome}')::numeric, 0),
      'plannedOutflow', coalesce((v_health #>> '{planner,plannedOutflow}')::numeric, 0)
    )
  ) into v_result
  from category_json
  cross join commitment_totals;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_cash_flow_intelligence_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_cash_flow_intelligence_inputs"() IS 'Returns privacy-scoped Cash Flow Intelligence inputs for the authenticated user, reusing the existing Financial Health source of truth.';



CREATE OR REPLACE FUNCTION "public"."get_cash_flow_intelligence_inputs_v2"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_source jsonb;
  v_filtered_items jsonb;
  v_bills_total numeric := 0;
  v_debt_minimums numeric := 0;
  v_commitments jsonb;
begin
  v_source := public.get_cash_flow_intelligence_inputs_v2_base();

  select
    coalesce(
      jsonb_agg(item order by
        nullif(item ->> 'dueDate', '') asc nulls last,
        coalesce((item ->> 'amount')::numeric, 0) desc,
        item ->> 'name' asc
      ),
      '[]'::jsonb
    ),
    coalesce(
      sum(
        case
          when item ->> 'kind' = 'bill'
          then coalesce((item ->> 'amount')::numeric, 0)
          else 0
        end
      ),
      0
    ),
    coalesce(
      sum(
        case
          when item ->> 'kind' = 'debt'
          then coalesce((item ->> 'amount')::numeric, 0)
          else 0
        end
      ),
      0
    )
  into
    v_filtered_items,
    v_bills_total,
    v_debt_minimums
  from jsonb_array_elements(
    coalesce(v_source #> '{commitments,items}', '[]'::jsonb)
  ) as item
  where
    item ->> 'kind' = 'debt'
    or (
      item ->> 'kind' = 'bill'
      and left(coalesce(item ->> 'dueDate', ''), 7)
        = to_char(current_date, 'YYYY-MM')
    );

  v_commitments := jsonb_build_object(
    'total', v_bills_total + v_debt_minimums,
    'billsTotal', v_bills_total,
    'debtMinimums', v_debt_minimums,
    'items', v_filtered_items
  );

  return jsonb_set(
    v_source,
    '{commitments}',
    v_commitments,
    true
  );
end
$$;


ALTER FUNCTION "public"."get_cash_flow_intelligence_inputs_v2"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2"() IS 'Returns Cash Flow Intelligence inputs with unpaid Bills restricted to the current calendar month. Future-month Bills remain hidden until that month begins.';



CREATE OR REPLACE FUNCTION "public"."get_cash_flow_intelligence_inputs_v2_base"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_health jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_health := public.get_financial_health_inputs();

  with month_range as (
    select generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  monthly_transactions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    where user_id = v_user_id
      and transaction_date >= (date_trunc('month', current_date) - interval '11 months')::date
      and transaction_date <= current_date
    group by 1
  ),
  monthly_series as (
    select
      months.month_start,
      coalesce(tx.transaction_count, 0)::integer as transaction_count,
      coalesce(tx.income, 0)::numeric as income,
      coalesce(tx.expenses, 0)::numeric as expenses,
      coalesce(tx.savings, 0)::numeric as savings,
      (coalesce(tx.expenses, 0) + coalesce(tx.savings, 0))::numeric as outflow,
      (
        coalesce(tx.income, 0)
        - coalesce(tx.expenses, 0)
        - coalesce(tx.savings, 0)
      )::numeric as net_cash_flow
    from month_range months
    left join monthly_transactions tx using (month_start)
    order by months.month_start
  ),
  recent_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 89
      and transaction_date <= current_date
    group by 1
  ),
  prior_categories as (
    select
      coalesce(nullif(trim(category), ''), 'Uncategorized') as category,
      coalesce(sum(amount_eur), 0)::numeric as amount
    from public.transactions
    where user_id = v_user_id
      and type = 'expense'
      and transaction_date >= current_date - 179
      and transaction_date < current_date - 89
    group by 1
  ),
  category_rows as (
    select
      coalesce(recent.category, prior.category) as category,
      coalesce(recent.amount, 0)::numeric as recent_amount,
      coalesce(prior.amount, 0)::numeric as prior_amount
    from recent_categories recent
    full outer join prior_categories prior using (category)
  ),
  category_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'category', ranked.category,
          'recentAmount', ranked.recent_amount,
          'priorAmount', ranked.prior_amount
        ) order by ranked.recent_amount desc, ranked.category asc
      ),
      '[]'::jsonb
    ) as items
    from (
      select category, recent_amount, prior_amount
      from category_rows
      where recent_amount > 0 or prior_amount > 0
      order by recent_amount desc, category asc
      limit 8
    ) ranked
  ),
  bill_commitments as (
    select
      ('bill:' || id::text) as id,
      'bill'::text as kind,
      name,
      category,
      due_date,
      coalesce(amount_eur, 0)::numeric as amount
    from public.bills
    where user_id = v_user_id
      and status = 'pending'
      and due_date >= current_date
      and due_date <= (current_date + interval '1 month')::date
  ),
  debt_commitments as (
    select
      ('debt:' || id::text) as id,
      'debt'::text as kind,
      name,
      category,
      null::date as due_date,
      coalesce(minimum_payment_eur, 0)::numeric as amount
    from public.debts
    where user_id = v_user_id
      and status <> 'paid_off'
      and coalesce(minimum_payment_eur, 0) > 0
  ),
  commitment_rows as (
    select * from bill_commitments
    union all
    select * from debt_commitments
  ),
  commitment_totals as (
    select
      coalesce(sum(amount) filter (where kind = 'bill'), 0)::numeric as bills_total,
      coalesce(sum(amount) filter (where kind = 'debt'), 0)::numeric as debt_minimums,
      coalesce(sum(amount), 0)::numeric as total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'kind', kind,
            'name', name,
            'category', category,
            'dueDate', due_date,
            'amount', amount
          ) order by due_date asc nulls last, amount desc, name asc
        ),
        '[]'::jsonb
      ) as items
    from commitment_rows
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'financialHealth', v_health,
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'outflow', outflow,
            'netCashFlow', net_cash_flow
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'categories', category_json.items,
    'commitments', jsonb_build_object(
      'total', commitment_totals.total,
      'billsTotal', commitment_totals.bills_total,
      'debtMinimums', commitment_totals.debt_minimums,
      'items', commitment_totals.items
    ),
    'planner', jsonb_build_object(
      'hasPlan', coalesce((v_health #>> '{planner,hasPlan}')::boolean, false),
      'plannedIncome', coalesce((v_health #>> '{planner,plannedIncome}')::numeric, 0),
      'plannedOutflow', coalesce((v_health #>> '{planner,plannedOutflow}')::numeric, 0)
    )
  ) into v_result
  from category_json
  cross join commitment_totals;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_cash_flow_intelligence_inputs_v2_base"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2_base"() IS 'Returns privacy-scoped Cash Flow Intelligence inputs using an inclusive one-calendar-month commitment window.';



CREATE OR REPLACE FUNCTION "public"."get_emergency_fund_intelligence_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_health jsonb;
  v_cash_flow jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_health := public.get_financial_health_inputs();
  v_cash_flow := public.get_cash_flow_intelligence_inputs_v2();

  with contribution_bounds as (
    select min(
      date_trunc(
        'month',
        transaction_date
      )::date
    ) as first_month
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
  ),
  month_range as (
    select generate_series(
      least(
        coalesce(
          (select first_month from contribution_bounds),
          date_trunc('month', current_date)::date
        ),
        (date_trunc('month', current_date) - interval '11 months')::date
      ),
      date_trunc('month', current_date)::date,
      interval '1 month'
    )::date as month_start
  ),
  monthly_contributions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as contribution_count,
      coalesce(sum(amount_eur), 0)::numeric as contribution
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
    group by 1
  ),
  monthly_series as (
    select
      months.month_start,
      coalesce(contributions.contribution_count, 0)::integer as contribution_count,
      coalesce(contributions.contribution, 0)::numeric as contribution
    from month_range months
    left join monthly_contributions contributions using (month_start)
    order by months.month_start
  ),
  recent_contributions as (
    select
      id,
      coalesce(nullif(trim(description), ''), 'Emergency fund saving') as description,
      coalesce(amount_eur, 0)::numeric as amount,
      coalesce(occurred_at, transaction_date::timestamptz, created_at) as occurred_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
    order by coalesce(occurred_at, transaction_date::timestamptz, created_at) desc
    limit 10
  ),
  contribution_stats as (
    select
      count(*)::integer as contribution_count,
      max(coalesce(occurred_at, transaction_date::timestamptz, created_at)) as last_contribution_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and lower(trim(category)) = 'emergency fund'
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'generatedAt', now(),
    'financialHealth', v_health,
    'oneMonthCommitments', coalesce((v_cash_flow #>> '{commitments,total}')::numeric, 0),
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'contributionCount', contribution_count,
            'contribution', contribution
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'recentContributions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id::text,
            'description', description,
            'amount', amount,
            'occurredAt', occurred_at
          ) order by occurred_at desc
        ),
        '[]'::jsonb
      )
      from recent_contributions
    ),
    'stats', jsonb_build_object(
      'contributionCount', contribution_stats.contribution_count,
      'lastContributionAt', contribution_stats.last_contribution_at
    )
  ) into v_result
  from contribution_stats;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_emergency_fund_intelligence_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_emergency_fund_intelligence_inputs"() IS 'Returns privacy-scoped Emergency Fund Intelligence inputs, including complete monthly contribution history, for the authenticated user while reusing the existing Financial Health source of truth.';



CREATE OR REPLACE FUNCTION "public"."get_financial_health_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  with transaction_metrics as (
    select
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as total_income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as total_expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as total_savings,
      coalesce(
        sum(amount_eur) filter (
          where type = 'saving'
            and lower(category) = 'emergency fund'
        ),
        0
      )::numeric as emergency_fund_savings,
      coalesce(
        sum(amount_eur) filter (
          where type = 'saving'
            and description ilike 'Goal investment ·%'
        ),
        0
      )::numeric as goal_investments,
      coalesce(
        sum(amount_eur) filter (
          where type = 'expense'
            and (
              description ilike 'Debt payment ·%'
              or lower(category) in (
                'debt repayment',
                'credit-card payment',
                'personal-loan payment',
                'student-loan payment',
                'mortgage principal'
              )
            )
        ),
        0
      )::numeric as debt_payments,
      count(distinct to_char(transaction_date, 'YYYY-MM'))::integer as active_months,
      (
        count(distinct to_char(transaction_date, 'YYYY-MM'))
          filter (where type = 'income')
      )::integer as income_months,
      (
        count(distinct to_char(transaction_date, 'YYYY-MM'))
          filter (where type = 'expense')
      )::integer as expense_months,
      coalesce(
        sum(amount_eur) filter (
          where type in ('expense', 'saving')
            and date_trunc('month', transaction_date) = date_trunc('month', current_date)
        ),
        0
      )::numeric as current_month_outflow
    from public.transactions
    where user_id = v_user_id
      and transaction_date <= current_date
  ),
  bill_metrics as (
    select
      count(*)::integer as bill_count,
      (count(*) filter (
        where status = 'pending' and due_date >= current_date
      ))::integer as pending_count,
      (count(*) filter (
        where status = 'pending' and due_date < current_date
      ))::integer as overdue_count,
      (count(*) filter (where status = 'paid'))::integer as paid_count,
      (count(*) filter (
        where status = 'paid'
          and paid_at is not null
          and paid_at::date <= due_date
      ))::integer as paid_on_time_count,
      (count(*) filter (
        where status = 'pending'
          and due_date between current_date and current_date + 30
      ))::integer as due_next_30_days_count,
      coalesce(
        sum(amount_eur) filter (where status = 'pending'),
        0
      )::numeric as pending_amount,
      coalesce(
        sum(amount_eur) filter (
          where status = 'pending'
            and due_date >= current_date
            and due_date <= (current_date + interval '1 month')::date
        ),
        0
      )::numeric as one_month_amount
    from public.bills
    where user_id = v_user_id
  ),
  debt_metrics as (
    select
      count(*)::integer as debt_count,
      (count(*) filter (where status <> 'paid_off'))::integer as active_count,
      coalesce(
        sum(original_balance_eur) filter (where status <> 'paid_off'),
        0
      )::numeric as original_balance,
      coalesce(
        sum(current_balance_eur) filter (where status <> 'paid_off'),
        0
      )::numeric as current_balance,
      coalesce(
        sum(minimum_payment_eur) filter (where status <> 'paid_off'),
        0
      )::numeric as minimum_monthly_payment,
      coalesce(
        avg(annual_interest_rate) filter (where status <> 'paid_off'),
        0
      )::numeric as average_interest_rate
    from public.debts
    where user_id = v_user_id
  ),
  goal_metrics as (
    select
      count(*)::integer as goal_count,
      (count(*) filter (where status = 'active'))::integer as active_count,
      (count(*) filter (where status = 'completed'))::integer as completed_count,
      coalesce(sum(target_amount), 0)::numeric as total_target,
      coalesce(sum(current_amount), 0)::numeric as total_current
    from public.goals
    where user_id = v_user_id
  ),
  planner_metrics as (
    select
      to_char(current_date, 'YYYY-MM') as current_month,
      exists (
        select 1
        from public.monthly_budget_plans plan
        where plan.user_id = v_user_id
          and plan.month = to_char(current_date, 'YYYY-MM')
      ) as has_plan,
      count(*)::integer as item_count,
      coalesce(
        sum(planned_amount) filter (where section = 'income'),
        0
      )::numeric as planned_income,
      coalesce(
        sum(planned_amount) filter (where section <> 'income'),
        0
      )::numeric as planned_outflow
    from public.monthly_budget_items
    where user_id = v_user_id
      and month = to_char(current_date, 'YYYY-MM')
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'transactions', jsonb_build_object(
      'count', transaction_metrics.transaction_count,
      'totalIncome', transaction_metrics.total_income,
      'totalExpenses', transaction_metrics.total_expenses,
      'totalSavings', transaction_metrics.total_savings,
      'emergencyFundSavings', transaction_metrics.emergency_fund_savings,
      'goalInvestments', transaction_metrics.goal_investments,
      'debtPayments', transaction_metrics.debt_payments,
      'activeMonths', transaction_metrics.active_months,
      'incomeMonths', transaction_metrics.income_months,
      'expenseMonths', transaction_metrics.expense_months,
      'currentMonthOutflow', transaction_metrics.current_month_outflow
    ),
    'bills', jsonb_build_object(
      'count', bill_metrics.bill_count,
      'pendingCount', bill_metrics.pending_count,
      'overdueCount', bill_metrics.overdue_count,
      'paidCount', bill_metrics.paid_count,
      'paidOnTimeCount', bill_metrics.paid_on_time_count,
      'dueNext30DaysCount', bill_metrics.due_next_30_days_count,
      'pendingAmount', bill_metrics.pending_amount,
      'oneMonthAmount', bill_metrics.one_month_amount
    ),
    'debts', jsonb_build_object(
      'count', debt_metrics.debt_count,
      'activeCount', debt_metrics.active_count,
      'originalBalance', debt_metrics.original_balance,
      'currentBalance', debt_metrics.current_balance,
      'minimumMonthlyPayment', debt_metrics.minimum_monthly_payment,
      'averageInterestRate', debt_metrics.average_interest_rate
    ),
    'goals', jsonb_build_object(
      'count', goal_metrics.goal_count,
      'activeCount', goal_metrics.active_count,
      'completedCount', goal_metrics.completed_count,
      'totalTarget', goal_metrics.total_target,
      'totalCurrent', goal_metrics.total_current
    ),
    'planner', jsonb_build_object(
      'currentMonth', planner_metrics.current_month,
      'hasPlan', planner_metrics.has_plan,
      'itemCount', planner_metrics.item_count,
      'plannedIncome', planner_metrics.planned_income,
      'plannedOutflow', planner_metrics.planned_outflow
    )
  ) into v_result
  from transaction_metrics
  cross join bill_metrics
  cross join debt_metrics
  cross join goal_metrics
  cross join planner_metrics;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_financial_health_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_financial_health_inputs"() IS 'Returns privacy-safe financial-health inputs for the authenticated user only.';



CREATE OR REPLACE FUNCTION "public"."get_financial_independence_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_growth jsonb;
  v_savings jsonb;
  v_emergency jsonb;
  v_settings jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_growth := public.get_net_worth_growth_inputs();
  v_savings := public.get_savings_intelligence_inputs();
  v_emergency := public.get_emergency_fund_intelligence_inputs();

  select jsonb_build_object(
    'targetMonthlySpending', settings.target_monthly_spending,
    'withdrawalRate', settings.withdrawal_rate,
    'annualRealReturnRate', settings.annual_real_return_rate,
    'updatedAt', settings.updated_at
  )
  into v_settings
  from public.financial_independence_settings settings
  where settings.user_id = v_user_id;

  if v_settings is null then
    v_settings := jsonb_build_object(
      'targetMonthlySpending', null,
      'withdrawalRate', 4.00,
      'annualRealReturnRate', 4.00,
      'updatedAt', null
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'netWorthGrowth', v_growth,
    'savingsIntelligence', v_savings,
    'emergencyFund', v_emergency,
    'settings', v_settings
  );
end;
$$;


ALTER FUNCTION "public"."get_financial_independence_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_financial_independence_inputs"() IS 'Returns Financial Independence inputs for the authenticated user by composing existing Wealth Engine sources of truth.';



CREATE OR REPLACE FUNCTION "public"."get_net_worth_growth_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_wealth jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_wealth := public.get_wealth_score_inputs();

  with source_months as (
    select date_trunc('month', min(transaction_date))::date as month_start
    from public.transactions
    where user_id = v_user_id
      and transaction_date <= current_date

    union all

    select date_trunc('month', min(created_at))::date as month_start
    from public.debts
    where user_id = v_user_id
      and created_at::date <= current_date

    union all

    select date_trunc('month', min(paid_at))::date as month_start
    from public.debt_payments
    where user_id = v_user_id
      and paid_at::date <= current_date
  ),
  bounds as (
    select greatest(
      coalesce(min(month_start), date_trunc('month', current_date)::date),
      (date_trunc('month', current_date) - interval '119 months')::date
    )::date as first_month
    from source_months
  ),
  month_range as (
    select generate_series(
      bounds.first_month,
      date_trunc('month', current_date)::date,
      interval '1 month'
    )::date as month_start
    from bounds
  ),
  opening_transactions as (
    select
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    cross join bounds
    where user_id = v_user_id
      and transaction_date < bounds.first_month
  ),
  opening_debt as (
    select coalesce(sum(
      least(
        d.original_balance_eur,
        greatest(
          0,
          d.current_balance_eur + coalesce(future_payments.amount, 0)
        )
      )
    ), 0)::numeric as outstanding
    from public.debts d
    cross join bounds
    left join lateral (
      select coalesce(sum(dp.amount_eur), 0)::numeric as amount
      from public.debt_payments dp
      where dp.user_id = v_user_id
        and dp.debt_id = d.id
        and dp.paid_at >= bounds.first_month
        and dp.paid_at::date <= current_date
    ) future_payments on true
    where d.user_id = v_user_id
      and d.created_at < bounds.first_month
      and d.created_at::date <= current_date
  ),
  monthly_transactions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    cross join bounds
    where user_id = v_user_id
      and transaction_date >= bounds.first_month
      and transaction_date <= current_date
    group by 1
  ),
  monthly_debt_payments as (
    select
      date_trunc('month', paid_at)::date as month_start,
      coalesce(sum(amount_eur), 0)::numeric as debt_payments
    from public.debt_payments
    cross join bounds
    where user_id = v_user_id
      and paid_at >= bounds.first_month
      and paid_at::date <= current_date
    group by 1
  ),
  monthly_base as (
    select
      m.month_start,
      coalesce(t.transaction_count, 0)::integer as transaction_count,
      coalesce(t.income, 0)::numeric as income,
      coalesce(t.expenses, 0)::numeric as expenses,
      coalesce(t.savings, 0)::numeric as savings,
      (coalesce(t.income, 0) - coalesce(t.expenses, 0))::numeric as retained_capital,
      (
        coalesce(t.income, 0)
        - coalesce(t.expenses, 0)
        - coalesce(t.savings, 0)
      )::numeric as available_cash_change,
      coalesce(p.debt_payments, 0)::numeric as debt_payments
    from month_range m
    left join monthly_transactions t using (month_start)
    left join monthly_debt_payments p using (month_start)
  ),
  cumulative as (
    select
      b.*,
      (
        opening_transactions.income
        - opening_transactions.expenses
        + sum(b.retained_capital) over (
          order by b.month_start rows between unbounded preceding and current row
        )
      )::numeric as cumulative_capital,
      (
        opening_transactions.savings
        + sum(b.savings) over (
          order by b.month_start rows between unbounded preceding and current row
        )
      )::numeric as cumulative_savings,
      (
        opening_transactions.income
        - opening_transactions.expenses
        - opening_transactions.savings
        + sum(b.available_cash_change) over (
          order by b.month_start rows between unbounded preceding and current row
        )
      )::numeric as cumulative_available_cash
    from monthly_base b
    cross join opening_transactions
  ),
  positioned as (
    select
      c.*,
      coalesce(debt_state.outstanding, 0)::numeric as debt_outstanding
    from cumulative c
    left join lateral (
      select coalesce(sum(
        least(
          d.original_balance_eur,
          greatest(
            0,
            d.current_balance_eur + coalesce(future_payments.amount, 0)
          )
        )
      ), 0)::numeric as outstanding
      from public.debts d
      left join lateral (
        select coalesce(sum(dp.amount_eur), 0)::numeric as amount
        from public.debt_payments dp
        where dp.user_id = v_user_id
          and dp.debt_id = d.id
          and dp.paid_at >= c.month_start + interval '1 month'
          and dp.paid_at::date <= current_date
      ) future_payments on true
      where d.user_id = v_user_id
        and d.created_at < c.month_start + interval '1 month'
        and d.created_at::date <= current_date
    ) debt_state on true
  ),
  final_series as (
    select
      p.*,
      (p.cumulative_capital - p.debt_outstanding)::numeric as net_worth,
      (
        p.debt_outstanding
        - lag(p.debt_outstanding, 1, opening_debt.outstanding)
          over (order by p.month_start)
      )::numeric as debt_change,
      (
        (p.cumulative_capital - p.debt_outstanding)
        - lag(
            p.cumulative_capital - p.debt_outstanding,
            1,
            opening_transactions.income
              - opening_transactions.expenses
              - opening_debt.outstanding
          ) over (order by p.month_start)
      )::numeric as net_worth_change
    from positioned p
    cross join opening_transactions
    cross join opening_debt
  ),
  growth_payload as (
    select jsonb_build_object(
      'firstMonth', (select to_char(first_month, 'YYYY-MM') from bounds),
      'historyMonths', count(*)::integer,
      'monthly', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'retainedCapital', retained_capital,
            'availableCashChange', available_cash_change,
            'cumulativeCapital', cumulative_capital,
            'cumulativeSavings', cumulative_savings,
            'debtOutstanding', debt_outstanding,
            'debtPayments', debt_payments,
            'debtChange', debt_change,
            'netWorth', net_worth,
            'netWorthChange', net_worth_change
          ) order by month_start
        ),
        '[]'::jsonb
      )
    ) as payload
    from final_series
  )
  select
    v_wealth || jsonb_build_object(
      'schemaVersion', 1,
      'generatedAt', now(),
      'growth', growth_payload.payload
    )
  into v_result
  from growth_payload;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_net_worth_growth_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_net_worth_growth_inputs"() IS 'Returns privacy-scoped Net Worth Growth history for the authenticated user while reusing the existing Wealth Score source of truth.';



CREATE OR REPLACE FUNCTION "public"."get_savings_intelligence_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_cash_flow jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_cash_flow := public.get_cash_flow_intelligence_inputs_v2();

  with month_range as (
    select generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  saving_rows as (
    select
      case
        when description ilike 'Goal investment ·%' then 'Goal investments'
        else coalesce(nullif(trim(category), ''), 'General savings')
      end as saving_category,
      coalesce(amount_eur, 0)::numeric as amount,
      transaction_date,
      coalesce(occurred_at, transaction_date::timestamptz, created_at) as occurred_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and coalesce(lower(trim(category)), '') <> 'emergency fund'
  ),
  monthly_contributions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as contribution_count,
      coalesce(sum(amount), 0)::numeric as savings
    from saving_rows
    where transaction_date >=
      (date_trunc('month', current_date) - interval '11 months')::date
    group by 1
  ),
  monthly_series as (
    select
      months.month_start,
      coalesce(contributions.contribution_count, 0)::integer as contribution_count,
      coalesce(contributions.savings, 0)::numeric as savings
    from month_range months
    left join monthly_contributions contributions using (month_start)
    order by months.month_start
  ),
  category_rows as (
    select
      saving_category as category,
      count(*)::integer as contribution_count,
      coalesce(sum(amount), 0)::numeric as amount,
      max(occurred_at) as latest_at
    from saving_rows
    group by saving_category
  ),
  recent_savings as (
    select
      id,
      coalesce(nullif(trim(description), ''), 'Saving contribution') as description,
      case
        when description ilike 'Goal investment ·%' then 'Goal investments'
        else coalesce(nullif(trim(category), ''), 'General savings')
      end as category,
      coalesce(amount_eur, 0)::numeric as amount,
      coalesce(occurred_at, transaction_date::timestamptz, created_at) as occurred_at
    from public.transactions
    where user_id = v_user_id
      and type = 'saving'
      and transaction_date <= current_date
      and coalesce(lower(trim(category)), '') <> 'emergency fund'
    order by coalesce(occurred_at, transaction_date::timestamptz, created_at) desc
    limit 10
  ),
  saving_stats as (
    select
      coalesce(sum(amount), 0)::numeric as total_amount,
      count(*)::integer as contribution_count,
      min(occurred_at) as first_contribution_at,
      max(occurred_at) as last_contribution_at
    from saving_rows
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'generatedAt', now(),
    'cashFlow', v_cash_flow,
    'monthlySavings', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'contributionCount', contribution_count,
            'savings', savings
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'categories', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'category', category,
            'amount', amount,
            'contributionCount', contribution_count,
            'latestAt', latest_at
          ) order by amount desc, category asc
        ),
        '[]'::jsonb
      )
      from category_rows
    ),
    'recentSavings', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id::text,
            'description', description,
            'category', category,
            'amount', amount,
            'occurredAt', occurred_at
          ) order by occurred_at desc
        ),
        '[]'::jsonb
      )
      from recent_savings
    ),
    'stats', jsonb_build_object(
      'totalAmount', saving_stats.total_amount,
      'contributionCount', saving_stats.contribution_count,
      'firstContributionAt', saving_stats.first_contribution_at,
      'lastContributionAt', saving_stats.last_contribution_at
    )
  ) into v_result
  from saving_stats;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_savings_intelligence_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_savings_intelligence_inputs"() IS 'Returns privacy-scoped non-emergency Savings Intelligence inputs for the authenticated user. Emergency Fund contributions remain exclusively in the dedicated Emergency Fund module.';



CREATE OR REPLACE FUNCTION "public"."get_wealth_score_inputs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_health jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_health := public.get_financial_health_inputs();

  with month_range as (
    select generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  monthly_transactions as (
    select
      date_trunc('month', transaction_date)::date as month_start,
      count(*)::integer as transaction_count,
      coalesce(sum(amount_eur) filter (where type = 'income'), 0)::numeric as income,
      coalesce(sum(amount_eur) filter (where type = 'expense'), 0)::numeric as expenses,
      coalesce(sum(amount_eur) filter (where type = 'saving'), 0)::numeric as savings
    from public.transactions
    where user_id = v_user_id
      and transaction_date >= (date_trunc('month', current_date) - interval '11 months')::date
      and transaction_date <= current_date
    group by 1
  ),
  monthly_series as (
    select
      m.month_start,
      coalesce(t.transaction_count, 0)::integer as transaction_count,
      coalesce(t.income, 0)::numeric as income,
      coalesce(t.expenses, 0)::numeric as expenses,
      coalesce(t.savings, 0)::numeric as savings,
      (coalesce(t.income, 0) - coalesce(t.expenses, 0))::numeric as retained_capital,
      (
        coalesce(t.income, 0)
        - coalesce(t.expenses, 0)
        - coalesce(t.savings, 0)
      )::numeric as available_cash_change
    from month_range m
    left join monthly_transactions t using (month_start)
    order by m.month_start
  ),
  period_metrics as (
    select
      coalesce(sum(income) filter (
        where month_start >= date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as recent_3_month_income,
      coalesce(sum(retained_capital) filter (
        where month_start >= date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as recent_3_month_retained_capital,
      coalesce(sum(income) filter (
        where month_start >= date_trunc('month', current_date) - interval '5 months'
          and month_start < date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as prior_3_month_income,
      coalesce(sum(retained_capital) filter (
        where month_start >= date_trunc('month', current_date) - interval '5 months'
          and month_start < date_trunc('month', current_date) - interval '2 months'
      ), 0)::numeric as prior_3_month_retained_capital
    from monthly_series
  ),
  liabilities as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'originalBalance', original_balance_eur,
          'currentBalance', current_balance_eur,
          'annualInterestRate', annual_interest_rate,
          'status', status,
          'updatedAt', updated_at
        ) order by current_balance_eur desc, created_at asc
      ),
      '[]'::jsonb
    ) as items
    from public.debts
    where user_id = v_user_id
      and status <> 'paid_off'
  ),
  totals as (
    select
      coalesce((v_health #>> '{transactions,totalIncome}')::numeric, 0) as total_income,
      coalesce((v_health #>> '{transactions,totalExpenses}')::numeric, 0) as total_expenses,
      coalesce((v_health #>> '{transactions,totalSavings}')::numeric, 0) as total_savings,
      coalesce((v_health #>> '{debts,currentBalance}')::numeric, 0) as current_debt,
      coalesce((v_health #>> '{transactions,activeMonths}')::integer, 0) as history_months
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'financialHealth', v_health,
    'wealth', jsonb_build_object(
      'availableCash', totals.total_income - totals.total_expenses - totals.total_savings,
      'recordedSavings', totals.total_savings,
      'recordedCapital', totals.total_income - totals.total_expenses,
      'currentDebt', totals.current_debt,
      'netWorth', totals.total_income - totals.total_expenses - totals.current_debt,
      'recent3MonthIncome', period_metrics.recent_3_month_income,
      'recent3MonthRetainedCapital', period_metrics.recent_3_month_retained_capital,
      'prior3MonthIncome', period_metrics.prior_3_month_income,
      'prior3MonthRetainedCapital', period_metrics.prior_3_month_retained_capital,
      'historyMonths', totals.history_months
    ),
    'monthly', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'YYYY-MM'),
            'transactionCount', transaction_count,
            'income', income,
            'expenses', expenses,
            'savings', savings,
            'retainedCapital', retained_capital,
            'availableCashChange', available_cash_change
          ) order by month_start
        ),
        '[]'::jsonb
      )
      from monthly_series
    ),
    'liabilities', liabilities.items
  ) into v_result
  from totals
  cross join period_metrics
  cross join liabilities;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_wealth_score_inputs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_wealth_score_inputs"() IS 'Returns privacy-scoped Wealth Score inputs for the authenticated user, reusing the existing Financial Health source of truth.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_document_upload_intent"("p_storage_path" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.document_upload_intents intent
    where intent.user_id = auth.uid()
      and intent.storage_path = p_storage_path
      and intent.expires_at > now()
  );
$$;


ALTER FUNCTION "public"."has_active_document_upload_intent"("p_storage_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_statement_transactions"("p_file_name" "text", "p_rows" "jsonb", "p_mapping" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_row jsonb;
  v_transaction_id uuid;
  v_fingerprint text;
  v_description text;
  v_type text;
  v_category text;
  v_currency text;
  v_transaction_date date;
  v_occurred_at timestamptz;
  v_amount numeric;
  v_amount_eur numeric;
  v_rate numeric;
  v_rate_date date;
  v_rate_source text;
  v_source_row_number integer;
  v_force_import boolean;
  v_requested integer := 0;
  v_imported integer := 0;
  v_skipped_duplicate integer := 0;
  v_skipped_invalid integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if p_file_name is null or char_length(trim(p_file_name)) < 1 then
    raise exception 'A statement file name is required.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Statement rows must be supplied as an array.' using errcode = '22023';
  end if;

  v_requested := jsonb_array_length(p_rows);
  if v_requested < 1 or v_requested > 2000 then
    raise exception 'Import between 1 and 2,000 statement rows at a time.' using errcode = '22023';
  end if;

  insert into public.statement_import_batches (
    user_id,
    file_name,
    mapping,
    requested_count,
    status
  ) values (
    v_user_id,
    left(trim(p_file_name), 255),
    coalesce(p_mapping, '{}'::jsonb),
    v_requested,
    'processing'
  )
  returning id into v_batch_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_description := left(trim(coalesce(v_row ->> 'description', '')), 120);
      v_type := lower(trim(coalesce(v_row ->> 'type', '')));
      v_category := left(trim(coalesce(v_row ->> 'category', '')), 120);
      v_currency := upper(trim(coalesce(v_row ->> 'currency', 'EUR')));
      v_transaction_date := (v_row ->> 'transactionDate')::date;
      v_occurred_at := (v_row ->> 'occurredAt')::timestamptz;
      v_amount := (v_row ->> 'amount')::numeric;
      v_amount_eur := (v_row ->> 'amountEur')::numeric;
      v_rate := (v_row ->> 'exchangeRateToEur')::numeric;
      v_rate_date := (v_row ->> 'exchangeRateDate')::date;
      v_rate_source := left(trim(coalesce(v_row ->> 'exchangeRateSource', 'statement import')), 120);
      v_source_row_number := greatest(coalesce((v_row ->> 'sourceRowNumber')::integer, 1), 1);
      v_force_import := coalesce((v_row ->> 'forceImport')::boolean, false);

      if v_description = ''
         or v_category = ''
         or v_type not in ('income','expense','saving')
         or v_currency !~ '^[A-Z]{3}$'
         or v_amount <= 0
         or v_amount_eur <= 0
         or v_rate <= 0 then
        v_skipped_invalid := v_skipped_invalid + 1;
        continue;
      end if;

      v_fingerprint := encode(
        digest(
          concat_ws(
            '|',
            v_user_id::text,
            coalesce(v_row ->> 'fingerprintSeed', '')
          ),
          'sha256'
        ),
        'hex'
      );

      if exists (
        select 1
        from public.statement_import_items item
        where item.user_id = v_user_id
          and item.fingerprint = v_fingerprint
      ) then
        v_skipped_duplicate := v_skipped_duplicate + 1;
        continue;
      end if;

      if not v_force_import and exists (
        select 1
        from public.transactions transaction_record
        where transaction_record.user_id = v_user_id
          and transaction_record.transaction_date = v_transaction_date
          and transaction_record.type = v_type
          and coalesce(transaction_record.currency, 'EUR') = v_currency
          and round(transaction_record.amount::numeric, 2) = round(v_amount, 2)
          and regexp_replace(lower(trim(transaction_record.description)), '\s+', ' ', 'g') =
              regexp_replace(lower(trim(v_description)), '\s+', ' ', 'g')
      ) then
        v_skipped_duplicate := v_skipped_duplicate + 1;
        continue;
      end if;

      insert into public.transactions (
        user_id,
        description,
        amount,
        currency,
        amount_eur,
        exchange_rate_to_eur,
        exchange_rate_date,
        exchange_rate_source,
        type,
        category,
        transaction_date,
        occurred_at
      ) values (
        v_user_id,
        v_description,
        v_amount,
        v_currency,
        v_amount_eur,
        v_rate,
        v_rate_date,
        v_rate_source,
        v_type,
        v_category,
        v_transaction_date,
        v_occurred_at
      )
      returning id into v_transaction_id;

      insert into public.statement_import_items (
        batch_id,
        user_id,
        transaction_id,
        fingerprint,
        source_row_number,
        source_data
      ) values (
        v_batch_id,
        v_user_id,
        v_transaction_id,
        v_fingerprint,
        v_source_row_number,
        v_row
      );

      v_imported := v_imported + 1;
    exception
      when unique_violation then
        v_skipped_duplicate := v_skipped_duplicate + 1;
      when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
        v_skipped_invalid := v_skipped_invalid + 1;
    end;
  end loop;

  update public.statement_import_batches
  set
    imported_count = v_imported,
    skipped_duplicate_count = v_skipped_duplicate,
    skipped_invalid_count = v_skipped_invalid,
    status = 'completed',
    completed_at = now()
  where id = v_batch_id;

  return jsonb_build_object(
    'batchId', v_batch_id,
    'requestedCount', v_requested,
    'importedCount', v_imported,
    'skippedDuplicateCount', v_skipped_duplicate,
    'skippedInvalidCount', v_skipped_invalid
  );
end;
$_$;


ALTER FUNCTION "public"."import_statement_transactions"("p_file_name" "text", "p_rows" "jsonb", "p_mapping" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."import_statement_transactions"("p_file_name" "text", "p_rows" "jsonb", "p_mapping" "jsonb") IS 'Imports customer-approved statement rows atomically with ownership validation and duplicate protection.';



CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.role in ('admin', 'super_admin')
    )
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'wixlyydo@gmail.com';
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select
    exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.role = 'super_admin'
    )
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'wixlyydo@gmail.com';
$$;


ALTER FUNCTION "public"."is_platform_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_bill_paid"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone, "p_transaction_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills;
  v_transaction public.transactions;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_bill
  from public.bills
  where id = p_bill_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Bill not found.';
  end if;

  if v_bill.status = 'cancelled' then
    raise exception 'A cancelled bill cannot be marked paid.';
  end if;

  if v_bill.status = 'paid' and v_bill.transaction_id is not null then
    return jsonb_build_object('bill', to_jsonb(v_bill));
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  ) values (
    v_user_id,
    'Bill payment · ' || v_bill.name,
    v_bill.amount,
    v_bill.currency,
    v_bill.amount_eur,
    v_bill.exchange_rate_to_eur,
    p_transaction_date,
    'Bill payment conversion',
    'expense',
    v_bill.category,
    p_transaction_date,
    p_paid_at
  )
  returning * into v_transaction;

  update public.bills
  set
    status = 'paid',
    paid_at = p_paid_at,
    transaction_id = v_transaction.id,
    updated_at = now()
  where id = v_bill.id
  returning * into v_bill;

  return jsonb_build_object(
    'bill', to_jsonb(v_bill),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."mark_bill_paid"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone, "p_transaction_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."platform_usage_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    auth.uid() is not null
    and (
      lower(coalesce(auth.jwt() ->> 'email', '')) =
        lower('wixlyydo@gmail.com')
      or exists (
        select 1
        from public.admin_users admin_user
        where admin_user.user_id = auth.uid()
          and admin_user.role in ('admin', 'super_admin')
      )
    );
$$;


ALTER FUNCTION "public"."platform_usage_is_admin"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "transaction_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "amount_eur" numeric(18,6) NOT NULL,
    "exchange_rate_to_eur" numeric(20,10) NOT NULL,
    "exchange_rate_date" "date",
    "exchange_rate_source" "text",
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_amount_eur_check" CHECK ((("amount_eur" > (0)::numeric) AND ("exchange_rate_to_eur" > (0)::numeric))),
    CONSTRAINT "transactions_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "transactions_description_check" CHECK ((("char_length"("description") >= 1) AND ("char_length"("description") <= 120))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'saving'::"text"])))
);

ALTER TABLE ONLY "public"."transactions" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."transactions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_monthly_transaction_template"("p_template_id" "uuid", "p_period_key" "date" DEFAULT ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date") RETURNS "public"."transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_template public.transaction_templates%rowtype;
  v_existing_transaction public.transactions%rowtype;
  v_saved_transaction public.transactions%rowtype;
  v_period date := date_trunc('month', p_period_key)::date;
  v_last_day integer;
  v_transaction_date date;
  v_posting_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into v_template
  from public.transaction_templates
  where id = p_template_id
    and user_id = auth.uid()
    and is_active = true
    and is_recurring = true
  for update;

  if not found then
    raise exception 'The recurring entry could not be found.';
  end if;

  select transaction.*
  into v_existing_transaction
  from public.transaction_template_postings posting
  join public.transactions transaction on transaction.id = posting.transaction_id
  where posting.template_id = v_template.id
    and posting.user_id = auth.uid()
    and posting.period_key = v_period;

  if found then
    return v_existing_transaction;
  end if;

  if v_template.currency <> 'EUR' then
    raise exception 'Review the latest exchange rate before posting this recurring entry.';
  end if;

  v_last_day := extract(day from (v_period + interval '1 month - 1 day'))::integer;
  v_transaction_date := v_period + (least(v_template.day_of_month, v_last_day) - 1);

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  ) values (
    auth.uid(),
    v_template.description,
    v_template.amount,
    'EUR',
    v_template.amount,
    1,
    v_transaction_date,
    'recurring EUR template',
    v_template.type,
    v_template.category,
    v_transaction_date,
    (v_transaction_date::timestamp + time '12:00') at time zone 'UTC'
  )
  returning * into v_saved_transaction;

  insert into public.transaction_template_postings (
    template_id,
    user_id,
    period_key,
    transaction_id
  ) values (
    v_template.id,
    auth.uid(),
    v_period,
    v_saved_transaction.id
  )
  on conflict (template_id, period_key) do nothing
  returning id into v_posting_id;

  if v_posting_id is null then
    delete from public.transactions where id = v_saved_transaction.id;

    select transaction.*
    into v_existing_transaction
    from public.transaction_template_postings posting
    join public.transactions transaction on transaction.id = posting.transaction_id
    where posting.template_id = v_template.id
      and posting.user_id = auth.uid()
      and posting.period_key = v_period;

    if found then
      return v_existing_transaction;
    end if;

    raise exception 'The recurring entry was already processed.';
  end if;

  return v_saved_transaction;
end;
$$;


ALTER FUNCTION "public"."post_monthly_transaction_template"("p_template_id" "uuid", "p_period_key" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_automatic_payments"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'cron', 'pg_catalog', 'pg_temp'
    AS $$
declare
  v_bill public.bills%rowtype;
  v_debt public.debts%rowtype;
  v_scheduled timestamptz;
  v_local_date date;
  v_due_date date;
  v_occurrence_key text;
  v_bill_count integer := 0;
  v_debt_count integer := 0;
  v_failure_count integer := 0;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('ficonter:automatic-payments:processor', 0)
  ) then
    return jsonb_build_object(
      'status', 'already_running',
      'bills_recorded', 0,
      'debts_recorded', 0,
      'failures', 0
    );
  end if;

  for v_bill in
    select bill_record.*
    from public.bills as bill_record
    where bill_record.autopay = true
      and bill_record.autopay_enabled_at is not null
      and bill_record.status = 'pending'
      and bill_record.amount > 0
      and bill_record.amount_eur > 0
    order by bill_record.due_date, bill_record.id
  loop
    v_scheduled := public.ficonter_scheduled_timestamp(
      v_bill.due_date,
      v_bill.autopay_record_time,
      v_bill.autopay_timezone
    );

    if v_scheduled <= now()
       and v_scheduled >= v_bill.autopay_enabled_at then
      begin
        perform public.ficonter_record_bill_occurrence(
          v_bill.id,
          v_bill.user_id,
          v_bill.due_date,
          v_bill.due_date,
          v_scheduled,
          'automatic'
        );
        v_bill_count := v_bill_count + 1;
      exception
        when others then
          v_failure_count := v_failure_count + 1;
          insert into public.automatic_payment_runs (
            user_id,
            source_type,
            source_id,
            occurrence_key,
            scheduled_for,
            amount,
            currency,
            amount_eur,
            trigger_mode,
            status,
            error_message,
            processed_at
          )
          values (
            v_bill.user_id,
            'bill',
            v_bill.id,
            to_char(v_bill.due_date, 'YYYY-MM-DD'),
            v_scheduled,
            v_bill.amount,
            v_bill.currency,
            v_bill.amount_eur,
            'automatic',
            'failed',
            left(sqlerrm, 500),
            now()
          )
          on conflict (source_type, source_id, occurrence_key)
          do update set
            scheduled_for = excluded.scheduled_for,
            amount = excluded.amount,
            currency = excluded.currency,
            amount_eur = excluded.amount_eur,
            trigger_mode = 'automatic',
            status = 'failed',
            error_message = excluded.error_message,
            processed_at = now();
      end;
    end if;
  end loop;

  for v_debt in
    select debt_record.*
    from public.debts as debt_record
    where debt_record.autopay = true
      and debt_record.autopay_enabled_at is not null
      and debt_record.status = 'active'
      and debt_record.current_balance > 0
      and debt_record.minimum_payment > 0
      and debt_record.payment_due_day is not null
    order by debt_record.id
  loop
    v_local_date :=
      (now() at time zone public.ficonter_safe_timezone(v_debt.autopay_timezone))::date;
    v_due_date := public.ficonter_debt_due_date(
      v_local_date,
      v_debt.payment_due_day
    );
    v_scheduled := public.ficonter_scheduled_timestamp(
      v_due_date,
      v_debt.autopay_record_time,
      v_debt.autopay_timezone
    );
    v_occurrence_key := to_char(v_due_date, 'YYYY-MM');

    if v_scheduled <= now()
       and v_scheduled >= v_debt.autopay_enabled_at
       and (v_debt.start_date is null or v_due_date >= v_debt.start_date)
       and (v_debt.maturity_date is null or v_due_date <= v_debt.maturity_date)
       and not exists (
         select 1
         from public.automatic_payment_runs as run_record
         where run_record.source_type = 'debt'
           and run_record.source_id = v_debt.id
           and run_record.occurrence_key = v_occurrence_key
           and run_record.status = 'completed'
       ) then
      begin
        perform public.ficonter_record_debt_occurrence(
          v_debt.id,
          v_debt.user_id,
          v_occurrence_key,
          v_due_date,
          v_scheduled,
          'automatic'
        );
        v_debt_count := v_debt_count + 1;
      exception
        when others then
          v_failure_count := v_failure_count + 1;
          insert into public.automatic_payment_runs (
            user_id,
            source_type,
            source_id,
            occurrence_key,
            scheduled_for,
            amount,
            currency,
            amount_eur,
            trigger_mode,
            status,
            error_message,
            processed_at
          )
          values (
            v_debt.user_id,
            'debt',
            v_debt.id,
            v_occurrence_key,
            v_scheduled,
            least(v_debt.minimum_payment, v_debt.current_balance),
            v_debt.currency,
            least(v_debt.minimum_payment_eur, v_debt.current_balance_eur),
            'automatic',
            'failed',
            left(sqlerrm, 500),
            now()
          )
          on conflict (source_type, source_id, occurrence_key)
          do update set
            scheduled_for = excluded.scheduled_for,
            amount = excluded.amount,
            currency = excluded.currency,
            amount_eur = excluded.amount_eur,
            trigger_mode = 'automatic',
            status = 'failed',
            error_message = excluded.error_message,
            processed_at = now();
      end;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'bills_recorded', v_bill_count,
    'debts_recorded', v_debt_count,
    'failures', v_failure_count,
    'processed_at', now()
  );
end;
$$;


ALTER FUNCTION "public"."process_automatic_payments"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_automatic_payments"() IS 'Records armed FICONTER Bill and Debt schedules without moving bank funds.';



CREATE OR REPLACE FUNCTION "public"."process_business_recurring_costs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cost public.business_recurring_costs%rowtype;
  v_due timestamptz;
  v_due_local_date date;
  v_cycle_key text;
  v_next timestamptz;
  v_recorded integer := 0;
  v_failures integer := 0;
begin
  for v_cost in
    select cost.*
    from public.business_recurring_costs cost
    join public.businesses business
      on business.id = cost.business_id
     and business.status = 'active'
    where cost.status = 'active'
      and cost.next_run_at is not null
      and cost.next_run_at <= now()
    order by cost.next_run_at
    for update of cost skip locked
  loop
    begin
      v_due := v_cost.next_run_at;
      v_due_local_date := (v_due at time zone v_cost.timezone)::date;
      v_cycle_key := to_char(
        v_due at time zone v_cost.timezone,
        'YYYY-MM'
      );

      insert into public.business_transactions (
        business_id,
        created_by,
        description,
        counterparty,
        supplier_id,
        type,
        category,
        cost_nature,
        cost_category_id,
        cost_centre_id,
        source_recurring_cost_id,
        recurrence_key,
        amount,
        currency,
        amount_base,
        exchange_rate_to_base,
        exchange_rate_date,
        exchange_rate_source,
        transaction_date,
        occurred_at,
        payment_method,
        reference,
        notes
      ) values (
        v_cost.business_id,
        v_cost.created_by,
        v_cost.name,
        v_cost.supplier,
        v_cost.supplier_id,
        'expense',
        v_cost.category_name,
        v_cost.cost_nature,
        v_cost.category_id,
        v_cost.cost_centre_id,
        v_cost.id,
        v_cycle_key,
        v_cost.amount,
        v_cost.currency,
        v_cost.amount_base,
        v_cost.exchange_rate_to_base,
        v_cost.exchange_rate_date,
        'Automatic business recurring cost',
        v_due_local_date,
        v_due,
        v_cost.payment_method,
        v_cost.reference,
        coalesce(
          v_cost.notes,
          'Automatic monthly business cost'
        )
      )
      on conflict do nothing;

      v_next := public.business_next_recurring_timestamp(
        v_cost.start_date,
        v_cost.due_day,
        v_cost.record_time,
        v_cost.timezone,
        v_due + interval '1 second'
      );

      if v_cost.end_date is not null
         and (
           v_next at time zone v_cost.timezone
         )::date > v_cost.end_date then
        update public.business_recurring_costs
        set
          last_recorded_at = v_due,
          next_run_at = null,
          last_error = null,
          status = 'ended',
          updated_at = now()
        where id = v_cost.id;
      else
        update public.business_recurring_costs
        set
          last_recorded_at = v_due,
          next_run_at = v_next,
          last_error = null,
          updated_at = now()
        where id = v_cost.id;
      end if;

      v_recorded := v_recorded + 1;
    exception
      when others then
        v_failures := v_failures + 1;
        update public.business_recurring_costs
        set
          last_error = sqlerrm,
          updated_at = now()
        where id = v_cost.id;
    end;
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'recorded', v_recorded,
    'failures', v_failures,
    'processed_at', now()
  );
end;
$$;


ALTER FUNCTION "public"."process_business_recurring_costs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_business_recurring_costs"() IS 'Records due FICONTER Business recurring costs without moving external funds.';



CREATE OR REPLACE FUNCTION "public"."record_bill_payment_and_advance"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills%rowtype;
  v_transaction_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select bill_record.*
  into v_bill
  from public.bills as bill_record
  where bill_record.id = p_bill_id
    and bill_record.user_id = v_user_id;

  if not found then
    raise exception 'The bill was not found.' using errcode = 'P0002';
  end if;

  v_transaction_date :=
    (p_paid_at at time zone public.ficonter_safe_timezone(v_bill.autopay_timezone))::date;

  return public.ficonter_record_bill_occurrence(
    v_bill.id,
    v_user_id,
    v_bill.due_date,
    v_transaction_date,
    p_paid_at,
    'manual'
  );
end;
$$;


ALTER FUNCTION "public"."record_bill_payment_and_advance"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_business_inventory_movement"("p_item_id" "uuid", "p_movement_type" "text", "p_quantity" numeric, "p_unit_cost" numeric DEFAULT 0, "p_currency" "text" DEFAULT 'EUR'::"text", "p_unit_cost_base" numeric DEFAULT 0, "p_exchange_rate_to_base" numeric DEFAULT 1, "p_exchange_rate_date" "date" DEFAULT CURRENT_DATE, "p_exchange_rate_source" "text" DEFAULT NULL::"text", "p_supplier_id" "uuid" DEFAULT NULL::"uuid", "p_movement_date" "date" DEFAULT CURRENT_DATE, "p_occurred_at" timestamp with time zone DEFAULT "now"(), "p_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_create_expense" boolean DEFAULT false, "p_payment_method" "text" DEFAULT NULL::"text", "p_cost_category_id" "uuid" DEFAULT NULL::"uuid", "p_cost_centre_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_item public.business_inventory_items%rowtype;
  v_movement public.business_inventory_movements%rowtype;
  v_transaction public.business_transactions%rowtype;
  v_supplier_name text;
  v_current_quantity numeric(18,4) := 0;
  v_current_value numeric(18,4) := 0;
  v_average_cost numeric(18,4) := 0;
  v_quantity_delta numeric(18,4);
  v_unit_cost numeric(18,4);
  v_unit_cost_base numeric(18,4);
  v_value_delta numeric(18,4);
  v_currency text;
  v_rate numeric(20,8);
  v_rate_date date;
  v_rate_source text;
  v_category_id uuid;
  v_category_name text;
  v_cost_centre_id uuid;
  v_is_incoming boolean;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if coalesce(p_quantity,0) <= 0 then raise exception 'Movement quantity must be greater than zero.'; end if;
  if p_movement_type not in ('purchase','sale','used','damaged','lost','adjustment_in','adjustment_out','return_in','return_out') then
    raise exception 'Unsupported inventory movement type.';
  end if;

  select * into v_item from public.business_inventory_items where id = p_item_id for update;
  if v_item.id is null then raise exception 'Inventory item was not found.'; end if;
  if not public.business_member_can_write(v_item.business_id) then raise exception 'Business write access is required.'; end if;
  if v_item.status <> 'active' then raise exception 'Archived inventory items cannot receive new movements.'; end if;

  select coalesce(sum(quantity_delta),0), coalesce(sum(inventory_value_delta_base),0)
    into v_current_quantity, v_current_value
  from public.business_inventory_movements
  where item_id = v_item.id;

  if v_current_quantity > 0 then v_average_cost := greatest(0, v_current_value / v_current_quantity); end if;
  v_is_incoming := p_movement_type in ('purchase','adjustment_in','return_in');

  if p_supplier_id is not null then
    select supplier.name into v_supplier_name
    from public.business_suppliers supplier
    where supplier.id = p_supplier_id and supplier.business_id = v_item.business_id;
    if v_supplier_name is null then raise exception 'The selected supplier does not belong to this business.'; end if;
  end if;

  if v_is_incoming then
    v_quantity_delta := round(p_quantity,4);
    v_unit_cost := round(coalesce(p_unit_cost,0),4);
    v_unit_cost_base := round(coalesce(p_unit_cost_base,0),4);
    if p_movement_type = 'purchase' and v_unit_cost_base <= 0 then raise exception 'A stock purchase requires a unit cost greater than zero.'; end if;
    v_value_delta := round(p_quantity * v_unit_cost_base,4);
    v_currency := upper(coalesce(p_currency, v_item.default_purchase_currency));
    v_rate := coalesce(p_exchange_rate_to_base,1);
    v_rate_date := p_exchange_rate_date;
    v_rate_source := p_exchange_rate_source;
  else
    if round(p_quantity,4) > v_current_quantity then
      raise exception 'This movement exceeds the available stock of %.', v_current_quantity;
    end if;
    v_quantity_delta := -round(p_quantity,4);
    v_unit_cost_base := round(v_average_cost,4);
    v_unit_cost := v_unit_cost_base;
    v_value_delta := case when round(p_quantity,4) = v_current_quantity then -v_current_value else -round(p_quantity * v_average_cost,4) end;
    v_currency := (select base_currency from public.businesses where id = v_item.business_id);
    v_rate := 1;
    v_rate_date := p_movement_date;
    v_rate_source := 'Weighted average inventory cost';
  end if;

  insert into public.business_inventory_movements (
    business_id, item_id, item_name, item_sku, created_by, movement_type,
    quantity_delta, unit_cost, currency, unit_cost_base, inventory_value_delta_base,
    exchange_rate_to_base, exchange_rate_date, exchange_rate_source,
    supplier_id, supplier_name, movement_date, occurred_at, reference, notes
  ) values (
    v_item.business_id, v_item.id, v_item.name, v_item.sku, v_user_id, p_movement_type,
    v_quantity_delta, v_unit_cost, v_currency, v_unit_cost_base, v_value_delta,
    v_rate, v_rate_date, v_rate_source,
    p_supplier_id, v_supplier_name, p_movement_date, p_occurred_at,
    nullif(trim(coalesce(p_reference,'')), ''), nullif(trim(coalesce(p_notes,'')), '')
  ) returning * into v_movement;

  if p_movement_type = 'purchase' then
    update public.business_inventory_items
    set
      supplier_id = coalesce(p_supplier_id, supplier_id),
      default_purchase_cost = v_unit_cost,
      default_purchase_currency = v_currency,
      default_purchase_cost_base = v_unit_cost_base,
      default_exchange_rate_to_base = v_rate,
      updated_at = now()
    where id = v_item.id;
  end if;

  if p_movement_type = 'purchase' and p_create_expense then
    v_category_id := p_cost_category_id;
    if v_category_id is null then
      select category.id into v_category_id
      from public.business_cost_categories category
      where category.business_id = v_item.business_id and lower(category.name) = 'inventory purchases'
      limit 1;
    end if;

    if v_category_id is not null then
      select category.name into v_category_name
      from public.business_cost_categories category
      where category.id = v_category_id and category.business_id = v_item.business_id;
      if v_category_name is null then raise exception 'The selected cost category does not belong to this business.'; end if;
    else
      v_category_name := 'Inventory purchases';
    end if;

    if p_cost_centre_id is not null then
      select centre.id into v_cost_centre_id
      from public.business_cost_centres centre
      where centre.id = p_cost_centre_id and centre.business_id = v_item.business_id;
      if v_cost_centre_id is null then raise exception 'The selected cost centre does not belong to this business.'; end if;
    end if;

    insert into public.business_transactions (
      business_id, created_by, description, counterparty, supplier_id, type,
      category, cost_nature, cost_category_id, cost_centre_id,
      source_inventory_movement_id, amount, currency, amount_base,
      exchange_rate_to_base, exchange_rate_date, exchange_rate_source,
      transaction_date, occurred_at, payment_method, reference, notes
    ) values (
      v_item.business_id, v_user_id, 'Inventory purchase: ' || v_item.name,
      v_supplier_name, p_supplier_id, 'expense',
      v_category_name, 'variable', v_category_id, v_cost_centre_id,
      v_movement.id, round(p_quantity * v_unit_cost,2), v_currency, round(v_value_delta,2),
      v_rate, v_rate_date, 'Inventory purchase',
      p_movement_date, p_occurred_at, p_payment_method,
      coalesce(nullif(trim(coalesce(p_reference,'')), ''), v_item.sku),
      coalesce(nullif(trim(coalesce(p_notes,'')), ''), 'Stock purchase recorded from Inventory')
    ) returning * into v_transaction;

    update public.business_inventory_movements
    set transaction_id = v_transaction.id
    where id = v_movement.id
    returning * into v_movement;
  end if;

  return jsonb_build_object(
    'movement', to_jsonb(v_movement),
    'item', (select to_jsonb(snapshot) from public.business_inventory_item_balances snapshot where snapshot.id = v_item.id),
    'transaction', case when v_transaction.id is null then null else to_jsonb(v_transaction) end
  );
end;
$$;


ALTER FUNCTION "public"."record_business_inventory_movement"("p_item_id" "uuid", "p_movement_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_currency" "text", "p_unit_cost_base" numeric, "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_supplier_id" "uuid", "p_movement_date" "date", "p_occurred_at" timestamp with time zone, "p_reference" "text", "p_notes" "text", "p_create_expense" boolean, "p_payment_method" "text", "p_cost_category_id" "uuid", "p_cost_centre_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_business_inventory_movement"("p_item_id" "uuid", "p_movement_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_currency" "text", "p_unit_cost_base" numeric, "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_supplier_id" "uuid", "p_movement_date" "date", "p_occurred_at" timestamp with time zone, "p_reference" "text", "p_notes" "text", "p_create_expense" boolean, "p_payment_method" "text", "p_cost_category_id" "uuid", "p_cost_centre_id" "uuid") IS 'Records an atomic inventory movement and optionally creates a linked Business expense for a stock purchase.';



CREATE OR REPLACE FUNCTION "public"."record_business_sale"("p_business_id" "uuid", "p_sale_number" "text", "p_customer_name" "text" DEFAULT NULL::"text", "p_customer_email" "text" DEFAULT NULL::"text", "p_currency" "text" DEFAULT 'EUR'::"text", "p_exchange_rate_to_base" numeric DEFAULT 1, "p_exchange_rate_date" "date" DEFAULT CURRENT_DATE, "p_exchange_rate_source" "text" DEFAULT NULL::"text", "p_sale_date" "date" DEFAULT CURRENT_DATE, "p_occurred_at" timestamp with time zone DEFAULT "now"(), "p_payment_method" "text" DEFAULT 'Card'::"text", "p_discount" numeric DEFAULT 0, "p_tax" numeric DEFAULT 0, "p_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_lines" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid:=auth.uid();
  v_base_currency text;
  v_rate numeric:=greatest(coalesce(p_exchange_rate_to_base,1),0.00000001);
  v_sale public.business_sales%rowtype;
  v_transaction public.business_transactions%rowtype;
  v_line jsonb;
  v_sale_line public.business_sale_lines%rowtype;
  v_item public.business_inventory_items%rowtype;
  v_movement public.business_inventory_movements%rowtype;
  v_inventory_id uuid;
  v_name text;
  v_sku text;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_subtotal numeric;
  v_line_subtotal_base numeric;
  v_current_quantity numeric;
  v_current_value numeric;
  v_average_cost numeric;
  v_cogs numeric;
  v_subtotal numeric:=0;
  v_subtotal_base numeric:=0;
  v_total_cogs numeric:=0;
  v_units numeric:=0;
  v_line_count integer:=0;
  v_discount numeric:=greatest(coalesce(p_discount,0),0);
  v_tax numeric:=greatest(coalesce(p_tax,0),0);
  v_discount_base numeric;
  v_tax_base numeric;
  v_net_sales_base numeric;
  v_total numeric;
  v_total_base numeric;
  v_lines_result jsonb:='[]'::jsonb;
  v_movements_result jsonb:='[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if not public.business_member_can_write(p_business_id) then raise exception 'Business write access is required.'; end if;
  select base_currency into v_base_currency from public.businesses where id=p_business_id;
  if v_base_currency is null then raise exception 'Business was not found.'; end if;
  if nullif(trim(coalesce(p_sale_number,'')),'') is null then raise exception 'A sale number is required.'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'At least one sale line is required.'; end if;
  if jsonb_array_length(p_lines)>100 then raise exception 'A sale can contain at most 100 lines.'; end if;

  insert into public.business_sales(
    business_id,created_by,sale_number,customer_name,customer_email,status,currency,
    exchange_rate_to_base,exchange_rate_date,exchange_rate_source,subtotal,discount,tax,total,
    subtotal_base,discount_base,tax_base,total_base,net_sales_base,cogs_base,gross_profit_base,
    line_count,units_sold,sale_date,occurred_at,payment_method,reference,notes,completed_at
  ) values(
    p_business_id,v_user_id,p_sale_number,p_customer_name,p_customer_email,'completed',upper(p_currency),
    v_rate,p_exchange_rate_date,p_exchange_rate_source,0,0,0,0,0,0,0,0,0,0,0,
    1,1,p_sale_date,p_occurred_at,p_payment_method,p_reference,p_notes,p_occurred_at
  ) returning * into v_sale;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_inventory_id:=nullif(v_line->>'inventory_item_id','')::uuid;
    v_name:=nullif(trim(coalesce(v_line->>'item_name','')),'');
    v_quantity:=abs(coalesce((v_line->>'quantity')::numeric,0));
    v_unit_price:=greatest(coalesce((v_line->>'unit_price')::numeric,0),0);
    if v_quantity<=0 then raise exception 'Every sale quantity must be greater than zero.'; end if;
    if v_name is null then raise exception 'Every sale line requires an item or service name.'; end if;
    v_line_subtotal:=round(v_quantity*v_unit_price,2);
    v_line_subtotal_base:=round(v_line_subtotal*v_rate,2);
    v_sku:=null; v_average_cost:=0; v_cogs:=0; v_movement.id:=null;

    if v_inventory_id is not null then
      select * into v_item from public.business_inventory_items item
      where item.id=v_inventory_id and item.business_id=p_business_id for update;
      if v_item.id is null then raise exception 'One selected inventory item was not found.'; end if;
      if v_item.status<>'active' then raise exception 'A discontinued inventory item cannot be sold.'; end if;
      select coalesce(sum(quantity_delta),0),coalesce(sum(inventory_value_delta_base),0)
      into v_current_quantity,v_current_value from public.business_inventory_movements where item_id=v_item.id;
      if v_current_quantity<=0 or v_quantity>v_current_quantity then
        raise exception '% has only % % available.',v_item.name,v_current_quantity,v_item.unit;
      end if;
      v_average_cost:=case when v_current_quantity>0 then greatest(v_current_value,0)/v_current_quantity else 0 end;
      v_cogs:=case when v_quantity=v_current_quantity then round(greatest(v_current_value,0),2) else round(v_quantity*v_average_cost,2) end;
      v_name:=v_item.name; v_sku:=v_item.sku;
      insert into public.business_inventory_movements(
        business_id,item_id,item_name,item_sku,created_by,movement_type,quantity_delta,unit_cost,currency,
        unit_cost_base,inventory_value_delta_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,
        movement_date,occurred_at,reference,notes
      ) values(
        p_business_id,v_item.id,v_item.name,v_item.sku,v_user_id,'sale',-v_quantity,round(v_average_cost,4),v_base_currency,
        round(v_average_cost,4),-v_cogs,1,p_sale_date,'Sale COGS',p_sale_date,p_occurred_at,
        coalesce(nullif(trim(p_reference),''),upper(trim(p_sale_number))),'Sold through Business Sales'
      ) returning * into v_movement;
      v_movements_result:=v_movements_result||jsonb_build_array(to_jsonb(v_movement));
    end if;

    insert into public.business_sale_lines(
      sale_id,business_id,inventory_item_id,item_name,item_sku,quantity,unit_price,line_subtotal,line_subtotal_base,
      unit_cost_base,cogs_base,gross_profit_base,inventory_movement_id
    ) values(
      v_sale.id,p_business_id,v_inventory_id,v_name,v_sku,v_quantity,v_unit_price,v_line_subtotal,v_line_subtotal_base,
      round(v_average_cost,4),v_cogs,round(v_line_subtotal_base-v_cogs,2),v_movement.id
    ) returning * into v_sale_line;
    v_lines_result:=v_lines_result||jsonb_build_array(to_jsonb(v_sale_line));
    v_subtotal:=v_subtotal+v_line_subtotal;
    v_subtotal_base:=v_subtotal_base+v_line_subtotal_base;
    v_total_cogs:=v_total_cogs+v_cogs;
    v_units:=v_units+v_quantity;
    v_line_count:=v_line_count+1;
  end loop;

  if v_discount>v_subtotal then raise exception 'Discount cannot exceed the sale subtotal.'; end if;
  v_discount_base:=round(v_discount*v_rate,2);
  v_tax_base:=round(v_tax*v_rate,2);
  v_net_sales_base:=round(v_subtotal_base-v_discount_base,2);
  v_total:=round(v_subtotal-v_discount+v_tax,2);
  v_total_base:=round(v_net_sales_base+v_tax_base,2);

  insert into public.business_transactions(
    business_id,created_by,description,counterparty,type,category,source_sale_id,amount,currency,amount_base,
    exchange_rate_to_base,exchange_rate_date,exchange_rate_source,transaction_date,occurred_at,payment_method,reference,notes
  ) values(
    p_business_id,v_user_id,'Sale · '||upper(trim(p_sale_number)),nullif(trim(coalesce(p_customer_name,'')),''),
    'income','Sales revenue',v_sale.id,v_total,upper(p_currency),v_total_base,v_rate,p_exchange_rate_date,
    coalesce(p_exchange_rate_source,'Business sale'),p_sale_date,p_occurred_at,nullif(trim(coalesce(p_payment_method,'')),''),
    coalesce(nullif(trim(coalesce(p_reference,'')),''),upper(trim(p_sale_number))),
    coalesce(nullif(trim(coalesce(p_notes,'')),''),'Revenue recorded from Business Sales')
  ) returning * into v_transaction;

  update public.business_sales set
    subtotal=round(v_subtotal,2),discount=round(v_discount,2),tax=round(v_tax,2),total=v_total,
    subtotal_base=round(v_subtotal_base,2),discount_base=v_discount_base,tax_base=v_tax_base,total_base=v_total_base,
    net_sales_base=v_net_sales_base,cogs_base=round(v_total_cogs,2),gross_profit_base=round(v_net_sales_base-v_total_cogs,2),
    line_count=v_line_count,units_sold=v_units,transaction_id=v_transaction.id,updated_at=now()
  where id=v_sale.id returning * into v_sale;

  return jsonb_build_object('sale',to_jsonb(v_sale),'transaction',to_jsonb(v_transaction),'lines',v_lines_result,'movements',v_movements_result);
end;$$;


ALTER FUNCTION "public"."record_business_sale"("p_business_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_business_sale"("p_business_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") IS 'Atomically records a Business sale, revenue transaction, inventory reductions and weighted-average COGS.';



CREATE OR REPLACE FUNCTION "public"."record_business_supplier_invoice_payment"("p_invoice_id" "uuid", "p_paid_at" timestamp with time zone DEFAULT "now"(), "p_payment_method" "text" DEFAULT 'Bank transfer'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.business_supplier_invoices%rowtype;
  v_supplier_name text;
  v_transaction public.business_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_invoice
  from public.business_supplier_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Supplier invoice was not found.';
  end if;

  if not public.business_member_can_write(v_invoice.business_id) then
    raise exception 'Business write access is required.';
  end if;

  if v_invoice.status = 'paid' then
    raise exception 'This supplier invoice is already paid.';
  end if;

  if v_invoice.status = 'cancelled' then
    raise exception 'A cancelled supplier invoice cannot be paid.';
  end if;

  select supplier.name
    into v_supplier_name
  from public.business_suppliers supplier
  where supplier.id = v_invoice.supplier_id
    and supplier.business_id = v_invoice.business_id;

  insert into public.business_transactions (
    business_id,
    created_by,
    description,
    counterparty,
    supplier_id,
    type,
    category,
    cost_nature,
    cost_category_id,
    cost_centre_id,
    source_supplier_invoice_id,
    amount,
    currency,
    amount_base,
    exchange_rate_to_base,
    exchange_rate_date,
    exchange_rate_source,
    transaction_date,
    occurred_at,
    payment_method,
    reference,
    notes
  ) values (
    v_invoice.business_id,
    v_user_id,
    v_invoice.description,
    v_supplier_name,
    v_invoice.supplier_id,
    'expense',
    v_invoice.category_name,
    v_invoice.cost_nature,
    v_invoice.category_id,
    v_invoice.cost_centre_id,
    v_invoice.id,
    v_invoice.amount,
    v_invoice.currency,
    v_invoice.amount_base,
    v_invoice.exchange_rate_to_base,
    v_invoice.exchange_rate_date,
    'Supplier invoice payment',
    (p_paid_at at time zone 'UTC')::date,
    p_paid_at,
    coalesce(nullif(trim(p_payment_method), ''), v_invoice.payment_method),
    v_invoice.invoice_number,
    coalesce(v_invoice.notes, 'Supplier invoice payment')
  )
  returning * into v_transaction;

  update public.business_supplier_invoices
  set
    status = 'paid',
    paid_at = p_paid_at,
    payment_method = coalesce(nullif(trim(p_payment_method), ''), payment_method),
    transaction_id = v_transaction.id,
    updated_at = now()
  where id = v_invoice.id
  returning * into v_invoice;

  return jsonb_build_object(
    'invoice', to_jsonb(v_invoice),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."record_business_supplier_invoice_payment"("p_invoice_id" "uuid", "p_paid_at" timestamp with time zone, "p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_credit_card_activity"("p_debt_id" "uuid", "p_activity_type" "text", "p_description" "text", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_activity public.credit_card_activities%rowtype;
  v_direction integer;
  v_effect numeric(16,2);
  v_effect_eur numeric(16,2);
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_activity_type not in (
    'purchase', 'interest', 'fee', 'refund',
    'adjustment_increase', 'adjustment_decrease'
  ) then
    raise exception 'Choose a valid credit-card activity.' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0
    or p_amount_eur is null or p_amount_eur <= 0
    or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Enter a valid amount and EUR conversion.' using errcode = '22023';
  end if;

  if nullif(btrim(p_description), '') is null then
    raise exception 'Enter an activity description.' using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card'
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  v_direction := case
    when p_activity_type in ('refund', 'adjustment_decrease') then -1
    else 1
  end;

  v_effect := round(p_amount * v_direction, 2);
  v_effect_eur := round(p_amount_eur * v_direction, 2);
  v_new_balance := round(v_debt.current_balance + v_effect, 2);
  v_new_balance_eur := round(v_debt.current_balance_eur + v_effect_eur, 2);

  if v_new_balance < 0 or v_new_balance_eur < 0 then
    raise exception 'This refund or adjustment is greater than the current balance.'
      using errcode = '22023';
  end if;

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    exchange_rate_to_eur = p_exchange_rate,
    interest_charged = case
      when p_activity_type = 'interest'
        then round(interest_charged + p_amount, 2)
      else interest_charged
    end,
    interest_charged_eur = case
      when p_activity_type = 'interest'
        then round(interest_charged_eur + p_amount_eur, 2)
      else interest_charged_eur
    end,
    status = 'active',
    autopay = false,
    autopay_enabled_at = null,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  insert into public.credit_card_activities (
    debt_id,
    user_id,
    activity_type,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    balance_effect,
    balance_effect_eur,
    occurred_at,
    notes
  ) values (
    v_debt.id,
    v_user_id,
    p_activity_type,
    btrim(p_description),
    round(p_amount, 2),
    v_debt.currency,
    round(p_amount_eur, 2),
    p_exchange_rate,
    v_effect,
    v_effect_eur,
    coalesce(p_occurred_at, now()),
    nullif(btrim(p_notes), '')
  )
  returning * into v_activity;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'activity', to_jsonb(v_activity)
  );
end;
$$;


ALTER FUNCTION "public"."record_credit_card_activity"("p_debt_id" "uuid", "p_activity_type" "text", "p_description" "text", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_credit_card_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_payment public.debt_payments%rowtype;
  v_transaction public.transactions%rowtype;
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card'
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > v_debt.current_balance
    or p_amount_eur is null or p_amount_eur <= 0
    or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Enter a valid payment not greater than the current balance.'
      using errcode = '22023';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  ) values (
    v_user_id,
    'Credit card payment · ' || v_debt.name,
    round(p_amount, 2),
    v_debt.currency,
    round(p_amount_eur, 2),
    p_exchange_rate,
    p_exchange_rate_date,
    'Credit card payment conversion',
    'expense',
    'Credit-card payment',
    p_exchange_rate_date,
    coalesce(p_paid_at, now())
  )
  returning * into v_transaction;

  v_new_balance := greatest(0, round(v_debt.current_balance - p_amount, 2));
  v_new_balance_eur := greatest(0, round(v_debt.current_balance_eur - p_amount_eur, 2));

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    exchange_rate_to_eur = p_exchange_rate,
    status = 'active',
    autopay = false,
    autopay_enabled_at = null,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  insert into public.debt_payments (
    debt_id,
    user_id,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    paid_at,
    notes,
    transaction_id
  ) values (
    v_debt.id,
    v_user_id,
    round(p_amount, 2),
    v_debt.currency,
    round(p_amount_eur, 2),
    p_exchange_rate,
    coalesce(p_paid_at, now()),
    nullif(btrim(p_notes), ''),
    v_transaction.id
  )
  returning * into v_payment;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."record_credit_card_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_debt_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_transaction_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_payment public.debt_payments%rowtype;
  v_transaction public.transactions%rowtype;
  v_new_balance numeric;
  v_new_balance_eur numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0
     or p_amount_eur is null or p_amount_eur <= 0
     or p_exchange_rate is null or p_exchange_rate <= 0
     or p_paid_at is null then
    raise exception 'Enter a valid payment amount and date.' using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.' using errcode = 'P0002';
  end if;

  if p_amount > v_debt.current_balance then
    raise exception 'Payment cannot exceed the outstanding balance.'
      using errcode = '22023';
  end if;

  if p_transaction_id is null then
    raise exception 'The linked transaction is required.' using errcode = '22023';
  end if;

  select transaction_record.*
  into v_transaction
  from public.transactions as transaction_record
  where transaction_record.id = p_transaction_id
    and transaction_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Linked transaction not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.debt_payments as existing_payment
    where existing_payment.transaction_id = p_transaction_id
  ) then
    raise exception 'This transaction is already linked to a debt payment.'
      using errcode = '23505';
  end if;

  v_new_balance := greatest(0, v_debt.current_balance - p_amount);
  v_new_balance_eur := greatest(
    0,
    v_debt.current_balance_eur - p_amount_eur
  );

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    status = case
      when v_new_balance = 0 then 'paid_off'
      when status = 'paid_off' then 'active'
      else status
    end,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  insert into public.debt_payments (
    debt_id,
    user_id,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    paid_at,
    notes,
    transaction_id
  )
  values (
    v_debt.id,
    v_user_id,
    p_amount,
    v_debt.currency,
    p_amount_eur,
    p_exchange_rate,
    p_paid_at,
    nullif(btrim(p_notes), ''),
    p_transaction_id
  )
  returning * into v_payment;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."record_debt_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_transaction_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_debt_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_transaction_id" "uuid") IS 'Compatibility RPC for linking an existing transaction to a debt payment.';



CREATE OR REPLACE FUNCTION "public"."record_debt_payment_atomic"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts;
  v_payment public.debt_payments;
  v_transaction public.transactions;
  v_new_balance numeric;
  v_new_balance_eur numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_debt
  from public.debts
  where id = p_debt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > v_debt.current_balance then
    raise exception 'Invalid payment amount.';
  end if;

  if p_amount_eur is null or p_amount_eur <= 0 or p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Invalid EUR conversion.';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  ) values (
    v_user_id,
    'Debt payment · ' || v_debt.name,
    p_amount,
    v_debt.currency,
    p_amount_eur,
    p_exchange_rate,
    p_exchange_rate_date,
    'Debt payment conversion',
    'expense',
    'Debt repayment',
    p_exchange_rate_date,
    p_paid_at
  )
  returning * into v_transaction;

  v_new_balance := greatest(0, v_debt.current_balance - p_amount);
  v_new_balance_eur := greatest(0, v_debt.current_balance_eur - p_amount_eur);

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    status = case when v_new_balance = 0 then 'paid_off' else status end,
    updated_at = now()
  where id = v_debt.id
  returning * into v_debt;

  insert into public.debt_payments (
    debt_id,
    user_id,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    paid_at,
    notes,
    transaction_id
  ) values (
    v_debt.id,
    v_user_id,
    p_amount,
    v_debt.currency,
    p_amount_eur,
    p_exchange_rate,
    p_paid_at,
    nullif(btrim(p_notes), ''),
    v_transaction.id
  )
  returning * into v_payment;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."record_debt_payment_atomic"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_debt_payment_with_transaction"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_exchange_rate_date" "date", "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_payment public.debt_payments%rowtype;
  v_transaction public.transactions%rowtype;
  v_new_balance numeric;
  v_new_balance_eur numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0
     or p_amount_eur is null or p_amount_eur <= 0
     or p_exchange_rate is null or p_exchange_rate <= 0
     or p_paid_at is null
     or p_exchange_rate_date is null then
    raise exception 'Enter a valid payment amount and date.' using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Debt not found.' using errcode = 'P0002';
  end if;

  if p_amount > v_debt.current_balance then
    raise exception 'Payment cannot exceed the outstanding balance.'
      using errcode = '22023';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  )
  values (
    v_user_id,
    'Debt payment · ' || v_debt.name,
    p_amount,
    v_debt.currency,
    p_amount_eur,
    p_exchange_rate,
    p_exchange_rate_date,
    'Debt payment conversion',
    'expense',
    'Debt repayment',
    p_exchange_rate_date,
    p_paid_at
  )
  returning * into v_transaction;

  v_new_balance := greatest(0, v_debt.current_balance - p_amount);
  v_new_balance_eur := greatest(
    0,
    v_debt.current_balance_eur - p_amount_eur
  );

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    status = case
      when v_new_balance = 0 then 'paid_off'
      when status = 'paid_off' then 'active'
      else status
    end,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  insert into public.debt_payments (
    debt_id,
    user_id,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    paid_at,
    notes,
    transaction_id
  )
  values (
    v_debt.id,
    v_user_id,
    p_amount,
    v_debt.currency,
    p_amount_eur,
    p_exchange_rate,
    p_paid_at,
    nullif(btrim(p_notes), ''),
    v_transaction.id
  )
  returning * into v_payment;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."record_debt_payment_with_transaction"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_exchange_rate_date" "date", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_debt_payment_with_transaction"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_exchange_rate_date" "date", "p_notes" "text") IS 'Atomically records a debt payment, creates its expense transaction, and updates the debt balance.';



CREATE OR REPLACE FUNCTION "public"."record_goal_investment"("p_goal_id" "uuid", "p_amount" numeric, "p_invested_at" timestamp with time zone, "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals;
  v_investment public.goal_investments;
  v_transaction public.transactions;
  v_next_amount numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid investment amount.';
  end if;

  select * into v_goal
  from public.goals
  where id = p_goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found.';
  end if;

  if v_goal.status = 'paused' then
    raise exception 'Resume this goal before recording an investment.';
  end if;

  if p_amount > greatest(0, v_goal.target_amount - v_goal.current_amount) then
    raise exception 'Investment cannot exceed the remaining goal amount.';
  end if;

  insert into public.transactions (
    user_id,
    description,
    amount,
    currency,
    amount_eur,
    exchange_rate_to_eur,
    exchange_rate_date,
    exchange_rate_source,
    type,
    category,
    transaction_date,
    occurred_at
  ) values (
    v_user_id,
    'Goal investment · ' || v_goal.name,
    p_amount,
    'EUR',
    p_amount,
    1,
    p_invested_at::date,
    'Goal investment',
    'saving',
    'General savings',
    p_invested_at::date,
    p_invested_at
  )
  returning * into v_transaction;

  v_next_amount := least(v_goal.target_amount, v_goal.current_amount + p_amount);

  update public.goals
  set
    current_amount = v_next_amount,
    status = case
      when v_next_amount >= target_amount then 'completed'
      when status = 'completed' then 'active'
      else status
    end,
    updated_at = now()
  where id = v_goal.id
  returning * into v_goal;

  insert into public.goal_investments (
    goal_id,
    user_id,
    amount,
    invested_at,
    notes,
    transaction_id
  ) values (
    v_goal.id,
    v_user_id,
    p_amount,
    p_invested_at,
    nullif(btrim(p_notes), ''),
    v_transaction.id
  )
  returning * into v_investment;

  return jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'investment', to_jsonb(v_investment),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."record_goal_investment"("p_goal_id" "uuid", "p_amount" numeric, "p_invested_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_platform_usage_heartbeat"("p_session_id" "uuid", "p_workspace" "text", "p_module" "text", "p_visible" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := (now() at time zone 'UTC')::date;
  v_existing public.platform_usage_presence%rowtype;
  v_elapsed bigint := 0;
  v_previous_date date;
  v_workspace_changed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_session_id is null then
    raise exception 'A usage session ID is required.';
  end if;

  if p_workspace not in ('personal', 'business') then
    raise exception 'Unsupported workspace.';
  end if;

  if char_length(trim(coalesce(p_module, ''))) not between 1 and 120 then
    raise exception 'Enter a valid module name.';
  end if;

  select presence.*
    into v_existing
  from public.platform_usage_presence presence
  where presence.session_id = p_session_id
  for update;

  if v_existing.session_id is null then
    insert into public.platform_usage_presence (
      session_id,
      user_id,
      workspace,
      module,
      is_visible,
      started_at,
      last_seen_at,
      updated_at
    ) values (
      p_session_id,
      v_user_id,
      p_workspace,
      trim(p_module),
      coalesce(p_visible, true),
      v_now,
      v_now,
      v_now
    );

    insert into public.platform_usage_daily (
      user_id,
      usage_date,
      workspace,
      active_seconds,
      sessions_count,
      first_seen_at,
      last_seen_at,
      updated_at
    ) values (
      v_user_id,
      v_today,
      p_workspace,
      0,
      1,
      v_now,
      v_now,
      v_now
    )
    on conflict (user_id, usage_date, workspace)
    do update set
      sessions_count =
        platform_usage_daily.sessions_count + 1,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at;

    return jsonb_build_object(
      'status', 'started',
      'live', coalesce(p_visible, true),
      'recorded_at', v_now
    );
  end if;

  if v_existing.user_id <> v_user_id then
    raise exception 'This usage session belongs to another account.';
  end if;

  v_previous_date :=
    (v_existing.last_seen_at at time zone 'UTC')::date;
  v_workspace_changed := v_existing.workspace <> p_workspace;

  if v_existing.is_visible and v_previous_date = v_today then
    v_elapsed := least(
      90,
      greatest(
        0,
        floor(
          extract(epoch from (v_now - v_existing.last_seen_at))
        )::bigint
      )
    );
  end if;

  insert into public.platform_usage_daily (
    user_id,
    usage_date,
    workspace,
    active_seconds,
    sessions_count,
    first_seen_at,
    last_seen_at,
    updated_at
  ) values (
    v_user_id,
    v_today,
    case
      when v_previous_date = v_today
        then v_existing.workspace
      else p_workspace
    end,
    v_elapsed,
    case
      when v_previous_date <> v_today then 1
      else 0
    end,
    v_now,
    v_now,
    v_now
  )
  on conflict (user_id, usage_date, workspace)
  do update set
    active_seconds =
      platform_usage_daily.active_seconds +
      excluded.active_seconds,
    sessions_count =
      platform_usage_daily.sessions_count +
      excluded.sessions_count,
    last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at;

  if v_workspace_changed and v_previous_date = v_today then
    insert into public.platform_usage_daily (
      user_id,
      usage_date,
      workspace,
      active_seconds,
      sessions_count,
      first_seen_at,
      last_seen_at,
      updated_at
    ) values (
      v_user_id,
      v_today,
      p_workspace,
      0,
      1,
      v_now,
      v_now,
      v_now
    )
    on conflict (user_id, usage_date, workspace)
    do update set
      sessions_count =
        platform_usage_daily.sessions_count + 1,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at;
  elsif not v_workspace_changed then
    update public.platform_usage_daily
    set
      last_seen_at = v_now,
      updated_at = v_now
    where user_id = v_user_id
      and usage_date = v_today
      and workspace = p_workspace;
  end if;

  update public.platform_usage_presence
  set
    workspace = p_workspace,
    module = trim(p_module),
    is_visible = coalesce(p_visible, true),
    last_seen_at = v_now,
    updated_at = v_now
  where session_id = p_session_id;

  return jsonb_build_object(
    'status', 'recorded',
    'active_seconds_added', v_elapsed,
    'live', coalesce(p_visible, true),
    'recorded_at', v_now
  );
end;
$$;


ALTER FUNCTION "public"."record_platform_usage_heartbeat"("p_session_id" "uuid", "p_workspace" "text", "p_module" "text", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_business_sale"("p_sale_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid:=auth.uid();
  v_sale public.business_sales%rowtype;
  v_line public.business_sale_lines%rowtype;
  v_original public.business_inventory_movements%rowtype;
  v_reversal public.business_inventory_movements%rowtype;
  v_transaction_id uuid;
  v_reversals jsonb:='[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select * into v_sale from public.business_sales where id=p_sale_id for update;
  if v_sale.id is null then raise exception 'Sale was not found.'; end if;
  if not public.business_member_can_write(v_sale.business_id) then raise exception 'Business write access is required.'; end if;
  if v_sale.status<>'completed' then raise exception 'Only a completed sale can be refunded.'; end if;

  for v_line in select * from public.business_sale_lines where sale_id=v_sale.id and inventory_movement_id is not null
  loop
    select * into v_original from public.business_inventory_movements where id=v_line.inventory_movement_id for update;
    if v_original.id is null then raise exception 'A linked inventory movement is missing.'; end if;
    if exists(select 1 from public.business_inventory_movements where reversal_of_id=v_original.id) then
      raise exception 'This sale inventory has already been restored.';
    end if;
    insert into public.business_inventory_movements(
      business_id,item_id,item_name,item_sku,created_by,movement_type,quantity_delta,unit_cost,currency,unit_cost_base,
      inventory_value_delta_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,reversal_of_id,
      movement_date,occurred_at,reference,notes
    ) values(
      v_original.business_id,v_original.item_id,v_original.item_name,v_original.item_sku,v_user_id,'reversal',-v_original.quantity_delta,
      v_original.unit_cost,v_original.currency,v_original.unit_cost_base,-v_original.inventory_value_delta_base,
      v_original.exchange_rate_to_base,current_date,'Sale refund',v_original.id,current_date,now(),
      'Refund · '||v_sale.sale_number,'Inventory restored from refunded sale'
    ) returning * into v_reversal;
    v_reversals:=v_reversals||jsonb_build_array(to_jsonb(v_reversal));
  end loop;

  v_transaction_id:=v_sale.transaction_id;
  if v_transaction_id is not null then
    delete from public.business_transactions where id=v_transaction_id and business_id=v_sale.business_id and source_sale_id=v_sale.id;
  end if;
  update public.business_sales set status='refunded',refunded_at=now(),transaction_id=null,updated_at=now()
  where id=v_sale.id returning * into v_sale;
  return jsonb_build_object('sale',to_jsonb(v_sale),'deleted_transaction_id',v_transaction_id,'reversals',v_reversals);
end;$$;


ALTER FUNCTION "public"."refund_business_sale"("p_sale_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refund_business_sale"("p_sale_id" "uuid") IS 'Refunds a Business sale, restores inventory and removes the linked revenue transaction.';



CREATE OR REPLACE FUNCTION "public"."reserve_document_upload"("p_user_id" "uuid", "p_storage_path" "text", "p_original_name" "text", "p_display_name" "text", "p_category" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_document_date" "date" DEFAULT NULL::"date", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_document_bytes bigint := 0;
  v_pending_bytes bigint := 0;
  v_pending_count integer := 0;
  v_intent_id uuid;
begin
  if p_user_id is null then
    raise exception 'invalid_document_owner';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(size_bytes), 0)
    into v_document_bytes
  from public.financial_documents
  where user_id = p_user_id;

  select count(*), coalesce(sum(size_bytes), 0)
    into v_pending_count, v_pending_bytes
  from public.document_upload_intents
  where user_id = p_user_id
    and expires_at > now();

  if v_pending_count >= 5 then
    raise exception 'too_many_pending_document_uploads';
  end if;

  if v_document_bytes + v_pending_bytes + p_size_bytes > 104857600 then
    raise exception 'document_vault_quota_exceeded';
  end if;

  insert into public.document_upload_intents (
    user_id,
    storage_path,
    original_name,
    display_name,
    category,
    mime_type,
    size_bytes,
    document_date,
    notes
  ) values (
    p_user_id,
    p_storage_path,
    p_original_name,
    p_display_name,
    p_category,
    p_mime_type,
    p_size_bytes,
    p_document_date,
    p_notes
  )
  returning id into v_intent_id;

  return v_intent_id;
end;
$$;


ALTER FUNCTION "public"."reserve_document_upload"("p_user_id" "uuid", "p_storage_path" "text", "p_original_name" "text", "p_display_name" "text", "p_category" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_document_date" "date", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_business_sale"("p_sale_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.business_sales%rowtype;
  v_line public.business_sale_lines%rowtype;
  v_item public.business_inventory_items%rowtype;
  v_movement public.business_inventory_movements%rowtype;
  v_transaction public.business_transactions%rowtype;
  v_base_currency text;
  v_rate numeric;
  v_current_quantity numeric;
  v_current_value numeric;
  v_average_cost numeric;
  v_line_cogs numeric;
  v_line_subtotal_base numeric;
  v_subtotal numeric := 0;
  v_subtotal_base numeric := 0;
  v_total_cogs numeric := 0;
  v_units numeric := 0;
  v_line_count integer := 0;
  v_discount_base numeric;
  v_tax_base numeric;
  v_net_sales_base numeric;
  v_total numeric;
  v_total_base numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_sale
  from public.business_sales
  where id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale was not found.';
  end if;

  if not public.business_member_can_write(v_sale.business_id) then
    raise exception 'Business write access is required.';
  end if;

  if v_sale.status not in ('refunded', 'deleted') then
    raise exception 'Only a refunded or deleted sale can be restored.';
  end if;

  select base_currency
    into v_base_currency
  from public.businesses
  where id = v_sale.business_id;

  if v_base_currency is null then
    raise exception 'Business was not found.';
  end if;

  v_rate := greatest(coalesce(v_sale.exchange_rate_to_base, 1), 0.00000001);

  if not exists (
    select 1
    from public.business_sale_lines
    where sale_id = v_sale.id
  ) then
    raise exception 'This sale has no lines to restore.';
  end if;

  for v_line in
    select *
    from public.business_sale_lines
    where sale_id = v_sale.id
    order by created_at
    for update
  loop
    v_line_subtotal_base := round(v_line.line_subtotal * v_rate, 2);
    v_average_cost := 0;
    v_line_cogs := 0;
    v_movement.id := null;

    if v_line.inventory_item_id is not null then
      select *
        into v_item
      from public.business_inventory_items item
      where item.id = v_line.inventory_item_id
        and item.business_id = v_sale.business_id
      for update;

      if v_item.id is null then
        raise exception 'One inventory item from this sale no longer exists.';
      end if;

      select
        coalesce(sum(quantity_delta), 0),
        coalesce(sum(inventory_value_delta_base), 0)
        into v_current_quantity, v_current_value
      from public.business_inventory_movements
      where item_id = v_item.id;

      if v_current_quantity <= 0
         or v_line.quantity > v_current_quantity then
        raise exception '% has only % % available and this sale requires %.',
          v_item.name,
          v_current_quantity,
          v_item.unit,
          v_line.quantity;
      end if;

      v_average_cost :=
        case
          when v_current_quantity > 0
            then greatest(v_current_value, 0) / v_current_quantity
          else 0
        end;

      v_line_cogs :=
        case
          when v_line.quantity = v_current_quantity
            then round(greatest(v_current_value, 0), 2)
          else round(v_line.quantity * v_average_cost, 2)
        end;

      insert into public.business_inventory_movements (
        business_id,
        item_id,
        item_name,
        item_sku,
        created_by,
        movement_type,
        quantity_delta,
        unit_cost,
        currency,
        unit_cost_base,
        inventory_value_delta_base,
        exchange_rate_to_base,
        exchange_rate_date,
        exchange_rate_source,
        movement_date,
        occurred_at,
        reference,
        notes
      ) values (
        v_sale.business_id,
        v_item.id,
        v_item.name,
        v_item.sku,
        v_user_id,
        'sale',
        -v_line.quantity,
        round(v_average_cost, 4),
        v_base_currency,
        round(v_average_cost, 4),
        -v_line_cogs,
        1,
        v_sale.sale_date,
        'Restored sale COGS',
        v_sale.sale_date,
        v_sale.occurred_at,
        coalesce(v_sale.reference, v_sale.sale_number),
        'Inventory issued again when a sale was restored'
      ) returning * into v_movement;

      update public.business_sale_lines
      set
        item_name = v_item.name,
        item_sku = v_item.sku,
        line_subtotal_base = v_line_subtotal_base,
        unit_cost_base = round(v_average_cost, 4),
        cogs_base = v_line_cogs,
        gross_profit_base = round(v_line_subtotal_base - v_line_cogs, 2),
        inventory_movement_id = v_movement.id
      where id = v_line.id;
    else
      update public.business_sale_lines
      set
        line_subtotal_base = v_line_subtotal_base,
        unit_cost_base = 0,
        cogs_base = 0,
        gross_profit_base = v_line_subtotal_base,
        inventory_movement_id = null
      where id = v_line.id;
    end if;

    v_subtotal := v_subtotal + v_line.line_subtotal;
    v_subtotal_base := v_subtotal_base + v_line_subtotal_base;
    v_total_cogs := v_total_cogs + v_line_cogs;
    v_units := v_units + v_line.quantity;
    v_line_count := v_line_count + 1;
  end loop;

  if v_sale.discount > v_subtotal then
    raise exception 'The saved discount exceeds the restored sale subtotal.';
  end if;

  v_discount_base := round(v_sale.discount * v_rate, 2);
  v_tax_base := round(v_sale.tax * v_rate, 2);
  v_net_sales_base := round(v_subtotal_base - v_discount_base, 2);
  v_total := round(v_subtotal - v_sale.discount + v_sale.tax, 2);
  v_total_base := round(v_net_sales_base + v_tax_base, 2);

  insert into public.business_transactions (
    business_id,
    created_by,
    description,
    counterparty,
    type,
    category,
    source_sale_id,
    amount,
    currency,
    amount_base,
    exchange_rate_to_base,
    exchange_rate_date,
    exchange_rate_source,
    transaction_date,
    occurred_at,
    payment_method,
    reference,
    notes
  ) values (
    v_sale.business_id,
    v_user_id,
    'Sale · ' || v_sale.sale_number,
    v_sale.customer_name,
    'income',
    'Sales revenue',
    v_sale.id,
    v_total,
    v_sale.currency,
    v_total_base,
    v_rate,
    v_sale.exchange_rate_date,
    'Restored business sale',
    v_sale.sale_date,
    v_sale.occurred_at,
    v_sale.payment_method,
    coalesce(v_sale.reference, v_sale.sale_number),
    coalesce(v_sale.notes, 'Revenue recreated from a restored Business sale')
  ) returning * into v_transaction;

  update public.business_sales
  set
    status = 'completed',
    subtotal = round(v_subtotal, 2),
    total = v_total,
    subtotal_base = round(v_subtotal_base, 2),
    discount_base = v_discount_base,
    tax_base = v_tax_base,
    total_base = v_total_base,
    net_sales_base = v_net_sales_base,
    cogs_base = round(v_total_cogs, 2),
    gross_profit_base = round(v_net_sales_base - v_total_cogs, 2),
    line_count = v_line_count,
    units_sold = v_units,
    transaction_id = v_transaction.id,
    completed_at = now(),
    refunded_at = null,
    deleted_at = null,
    updated_at = now()
  where id = v_sale.id
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;


ALTER FUNCTION "public"."restore_business_sale"("p_sale_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_business_sale"("p_sale_id" "uuid") IS 'Restores a refunded or deleted sale when sufficient inventory is available and recreates revenue and COGS.';



CREATE OR REPLACE FUNCTION "public"."restore_business_workspace"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business public.businesses%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_business
  from public.businesses business
  where business.id = p_business_id
  for update;

  if v_business.id is null then
    raise exception 'Business workspace was not found.';
  end if;

  if v_business.owner_id <> v_user_id then
    raise exception 'Only the business owner can restore this workspace.';
  end if;

  if v_business.status <> 'archived' then
    raise exception 'This business is already active.';
  end if;

  update public.businesses
  set
    status = 'active',
    archived_at = null,
    updated_at = now()
  where id = p_business_id
  returning * into v_business;

  update public.business_recurring_costs recurring
  set
    next_run_at = public.business_next_recurring_timestamp(
      recurring.start_date,
      recurring.due_day,
      recurring.record_time,
      recurring.timezone,
      now()
    ),
    last_error = null,
    updated_at = now()
  where recurring.business_id = p_business_id
    and recurring.status = 'active';

  update public.business_recurring_costs recurring
  set
    status = 'ended',
    next_run_at = null,
    updated_at = now()
  where recurring.business_id = p_business_id
    and recurring.status = 'active'
    and recurring.end_date is not null
    and (
      recurring.next_run_at at time zone recurring.timezone
    )::date > recurring.end_date;

  insert into public.business_user_preferences (
    user_id,
    active_business_id
  ) values (
    v_user_id,
    p_business_id
  )
  on conflict (user_id)
  do update set
    active_business_id = excluded.active_business_id,
    updated_at = now();

  return jsonb_build_object(
    'business', to_jsonb(v_business),
    'active_business_id', p_business_id
  );
end;
$$;


ALTER FUNCTION "public"."restore_business_workspace"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_debt_before_transaction_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_payment public.debt_payments%rowtype;
begin
  select payment_record.*
  into v_payment
  from public.debt_payments as payment_record
  where payment_record.transaction_id = old.id
    and payment_record.user_id = old.user_id
  for update;

  if found then
    update public.debts
    set
      current_balance = case
        when lower(category) = 'credit card'
          then current_balance + v_payment.amount
        else least(original_balance, current_balance + v_payment.amount)
      end,
      current_balance_eur = case
        when lower(category) = 'credit card'
          then current_balance_eur + v_payment.amount_eur
        else least(original_balance_eur, current_balance_eur + v_payment.amount_eur)
      end,
      status = case when status = 'paid_off' then 'active' else status end,
      updated_at = now()
    where id = v_payment.debt_id
      and user_id = old.user_id;

    delete from public.debt_payments
    where id = v_payment.id
      and user_id = old.user_id;
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."restore_debt_before_transaction_delete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_debt_before_transaction_delete"() IS 'Restores a linked debt balance and deletes its debt-payment row before a transaction is deleted.';



CREATE OR REPLACE FUNCTION "public"."reverse_business_inventory_movement"("p_movement_id" "uuid", "p_occurred_at" timestamp with time zone DEFAULT "now"(), "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_original public.business_inventory_movements%rowtype;
  v_reversal public.business_inventory_movements%rowtype;
  v_current_quantity numeric(18,4) := 0;
  v_transaction_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select * into v_original
  from public.business_inventory_movements
  where id = p_movement_id
  for update;

  if v_original.id is null then raise exception 'Inventory movement was not found.'; end if;
  if not public.business_member_can_write(v_original.business_id) then raise exception 'Business write access is required.'; end if;
  if v_original.movement_type = 'reversal' then raise exception 'A reversal entry cannot be reversed again.'; end if;
  if exists (select 1 from public.business_inventory_movements where reversal_of_id = v_original.id) then
    raise exception 'This movement has already been reversed.';
  end if;

  select coalesce(sum(quantity_delta),0) into v_current_quantity
  from public.business_inventory_movements where item_id = v_original.item_id;

  if v_original.quantity_delta > 0 and v_current_quantity < v_original.quantity_delta then
    raise exception 'There is not enough current stock to reverse this incoming movement.';
  end if;

  v_transaction_id := v_original.transaction_id;
  if v_transaction_id is not null then
    delete from public.business_transactions
    where id = v_transaction_id and business_id = v_original.business_id;
  end if;

  insert into public.business_inventory_movements (
    business_id, item_id, item_name, item_sku, created_by, movement_type,
    quantity_delta, unit_cost, currency, unit_cost_base, inventory_value_delta_base,
    exchange_rate_to_base, exchange_rate_date, exchange_rate_source,
    supplier_id, supplier_name, reversal_of_id, movement_date, occurred_at,
    reference, notes
  ) values (
    v_original.business_id, v_original.item_id, v_original.item_name, v_original.item_sku,
    v_user_id, 'reversal', -v_original.quantity_delta, v_original.unit_cost,
    v_original.currency, v_original.unit_cost_base, -v_original.inventory_value_delta_base,
    v_original.exchange_rate_to_base, current_date, 'Inventory movement reversal',
    v_original.supplier_id, v_original.supplier_name, v_original.id,
    (p_occurred_at at time zone 'UTC')::date, p_occurred_at,
    coalesce(v_original.reference, 'Reversal'),
    coalesce(nullif(trim(coalesce(p_notes,'')), ''), 'Reversal of ' || v_original.movement_type)
  ) returning * into v_reversal;

  return jsonb_build_object(
    'movement', to_jsonb(v_reversal),
    'deleted_transaction_id', v_transaction_id,
    'item', (select to_jsonb(snapshot) from public.business_inventory_item_balances snapshot where snapshot.id = v_original.item_id)
  );
end;
$$;


ALTER FUNCTION "public"."reverse_business_inventory_movement"("p_movement_id" "uuid", "p_occurred_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_business_supplier_invoice_payment"("p_invoice_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.business_supplier_invoices%rowtype;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_invoice
  from public.business_supplier_invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'Supplier invoice was not found.';
  end if;

  if not public.business_member_can_write(v_invoice.business_id) then
    raise exception 'Business write access is required.';
  end if;

  if v_invoice.status <> 'paid' then
    raise exception 'Only a paid supplier invoice can be reversed.';
  end if;

  v_transaction_id := v_invoice.transaction_id;

  if v_transaction_id is not null then
    delete from public.business_transactions
    where id = v_transaction_id
      and business_id = v_invoice.business_id;
  end if;

  update public.business_supplier_invoices
  set
    status = 'open',
    paid_at = null,
    transaction_id = null,
    updated_at = now()
  where id = v_invoice.id
  returning * into v_invoice;

  return jsonb_build_object(
    'invoice', to_jsonb(v_invoice),
    'deleted_transaction_id', v_transaction_id
  );
end;
$$;


ALTER FUNCTION "public"."reverse_business_supplier_invoice_payment"("p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_credit_card_activity"("p_activity_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.credit_card_activities%rowtype;
  v_debt public.debts%rowtype;
  v_new_balance numeric(16,2);
  v_new_balance_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select activity_record.*
  into v_activity
  from public.credit_card_activities as activity_record
  where activity_record.id = p_activity_id
    and activity_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Credit-card activity not found.' using errcode = 'P0002';
  end if;

  if v_activity.activity_type = 'statement_adjustment' then
    raise exception 'Confirmed statement reconciliation cannot be reversed directly. Update the statement again instead.'
      using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = v_activity.debt_id
    and debt_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  v_new_balance := round(
    v_debt.current_balance - v_activity.balance_effect,
    2
  );

  v_new_balance_eur := round(
    v_debt.current_balance_eur - v_activity.balance_effect_eur,
    2
  );

  if v_new_balance < 0 or v_new_balance_eur < 0 then
    raise exception 'This activity cannot be reversed after later payments reduced the balance.'
      using errcode = '22023';
  end if;

  update public.debts
  set
    current_balance = v_new_balance,
    current_balance_eur = v_new_balance_eur,
    interest_charged = case
      when v_activity.activity_type = 'interest'
        then greatest(0, round(interest_charged - v_activity.amount, 2))
      else interest_charged
    end,
    interest_charged_eur = case
      when v_activity.activity_type = 'interest'
        then greatest(
          0,
          round(interest_charged_eur - v_activity.amount_eur, 2)
        )
      else interest_charged_eur
    end,
    status = 'active',
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  delete from public.credit_card_activities
  where id = v_activity.id
    and user_id = v_user_id;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'activity', to_jsonb(v_activity)
  );
end;
$$;


ALTER FUNCTION "public"."reverse_credit_card_activity"("p_activity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverse_credit_card_activity"("p_activity_id" "uuid") IS 'Reverses one non-cash Credit Card activity and restores the shared card liability.';



CREATE OR REPLACE FUNCTION "public"."reverse_debt_payment"("p_payment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.debt_payments%rowtype;
  v_debt public.debts%rowtype;
  v_deleted_transaction_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select payment_record.*
  into v_payment
  from public.debt_payments as payment_record
  where payment_record.id = p_payment_id
    and payment_record.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;

  if v_payment.transaction_id is not null then
    delete from public.transactions
    where id = v_payment.transaction_id
      and user_id = v_user_id;
    get diagnostics v_deleted_transaction_count = row_count;
  end if;

  if v_deleted_transaction_count = 0 then
    update public.debts
    set
      current_balance = case
        when lower(category) = 'credit card'
          then current_balance + v_payment.amount
        else least(original_balance, current_balance + v_payment.amount)
      end,
      current_balance_eur = case
        when lower(category) = 'credit card'
          then current_balance_eur + v_payment.amount_eur
        else least(original_balance_eur, current_balance_eur + v_payment.amount_eur)
      end,
      status = case when status = 'paid_off' then 'active' else status end,
      updated_at = now()
    where id = v_payment.debt_id
      and user_id = v_user_id
    returning * into v_debt;

    delete from public.debt_payments
    where id = v_payment.id
      and user_id = v_user_id;
  else
    select debt_record.*
    into v_debt
    from public.debts as debt_record
    where debt_record.id = v_payment.debt_id
      and debt_record.user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment),
    'deleted_transaction_count', v_deleted_transaction_count,
    'deleted_transaction_id', v_payment.transaction_id
  );
end;
$$;


ALTER FUNCTION "public"."reverse_debt_payment"("p_payment_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverse_debt_payment"("p_payment_id" "uuid") IS 'Atomically reverses a customer-owned debt payment and deletes its linked transaction.';



CREATE OR REPLACE FUNCTION "public"."reverse_debt_payment_atomic"("p_payment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.debt_payments;
  v_debt public.debts;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_payment
  from public.debt_payments
  where id = p_payment_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Payment not found.';
  end if;

  update public.debts
  set
    current_balance = least(original_balance, current_balance + v_payment.amount),
    current_balance_eur = least(
      original_balance_eur,
      current_balance_eur + v_payment.amount_eur
    ),
    status = case when status = 'paid_off' then 'active' else status end,
    updated_at = now()
  where id = v_payment.debt_id and user_id = v_user_id
  returning * into v_debt;

  if v_payment.transaction_id is not null then
    delete from public.transactions
    where id = v_payment.transaction_id and user_id = v_user_id;
  end if;

  delete from public.debt_payments
  where id = v_payment.id and user_id = v_user_id;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'payment', to_jsonb(v_payment)
  );
end;
$$;


ALTER FUNCTION "public"."reverse_debt_payment_atomic"("p_payment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_goal_investment"("p_investment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_investment public.goal_investments;
  v_goal public.goals;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_investment
  from public.goal_investments
  where id = p_investment_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Investment not found.';
  end if;

  select * into v_goal
  from public.goals
  where id = v_investment.goal_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Goal not found.';
  end if;

  update public.goals
  set
    current_amount = greatest(0, current_amount - v_investment.amount),
    status = case when status = 'completed' then 'active' else status end,
    updated_at = now()
  where id = v_goal.id
  returning * into v_goal;

  delete from public.transactions
  where id = v_investment.transaction_id and user_id = v_user_id;

  -- transaction_id uses ON DELETE CASCADE, so the investment row is removed
  -- with the linked transaction. This explicit delete is harmless if already gone.
  delete from public.goal_investments
  where id = v_investment.id and user_id = v_user_id;

  return jsonb_build_object(
    'goal', to_jsonb(v_goal),
    'investment', to_jsonb(v_investment)
  );
end;
$$;


ALTER FUNCTION "public"."reverse_goal_investment"("p_investment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_credit_card_monthly_record"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_record public.credit_card_monthly_records%rowtype;
  v_minimum numeric(16,2);
  v_minimum_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_statement_balance is null or p_statement_balance < 0
    or p_statement_balance_eur is null or p_statement_balance_eur < 0
    or p_exchange_rate is null or p_exchange_rate <= 0
    or p_statement_date is null
    or p_payment_due_date is null
    or p_payment_due_date < p_statement_date
    or p_interest_charged is null or p_interest_charged < 0
    or p_interest_charged_eur is null or p_interest_charged_eur < 0 then
    raise exception 'Enter valid historical statement values.'
      using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card';

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  if v_debt.statement_date is null
    or p_statement_date >= v_debt.statement_date then
    raise exception 'Current or newer statements must update the live card balance.'
      using errcode = '22023';
  end if;

  v_minimum := least(
    round(p_statement_balance, 2),
    round(p_statement_balance * 0.03, 2)
  );
  v_minimum_eur := least(
    round(p_statement_balance_eur, 2),
    round(p_statement_balance_eur * 0.03, 2)
  );

  insert into public.credit_card_monthly_records (
    debt_id,
    user_id,
    month_start,
    currency,
    statement_balance,
    statement_balance_eur,
    minimum_payment,
    minimum_payment_eur,
    interest_charged,
    interest_charged_eur,
    statement_date,
    payment_due_date,
    updated_at
  ) values (
    v_debt.id,
    v_user_id,
    date_trunc('month', p_statement_date)::date,
    v_debt.currency,
    round(p_statement_balance, 2),
    round(p_statement_balance_eur, 2),
    v_minimum,
    v_minimum_eur,
    round(p_interest_charged, 2),
    round(p_interest_charged_eur, 2),
    p_statement_date,
    p_payment_due_date,
    now()
  )
  on conflict (debt_id, month_start)
  do update set
    user_id = excluded.user_id,
    currency = excluded.currency,
    statement_balance = excluded.statement_balance,
    statement_balance_eur = excluded.statement_balance_eur,
    minimum_payment = excluded.minimum_payment,
    minimum_payment_eur = excluded.minimum_payment_eur,
    interest_charged = excluded.interest_charged,
    interest_charged_eur = excluded.interest_charged_eur,
    statement_date = excluded.statement_date,
    payment_due_date = excluded.payment_due_date,
    updated_at = now()
  returning * into v_record;

  return to_jsonb(v_record);
end;
$$;


ALTER FUNCTION "public"."save_credit_card_monthly_record"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_business_cost_control_defaults"("p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.business_cost_categories
    (business_id, name, default_nature)
  values
    (p_business_id, 'Materials', 'variable'),
    (p_business_id, 'Inventory purchases', 'variable'),
    (p_business_id, 'Rent', 'fixed'),
    (p_business_id, 'Utilities', 'fixed'),
    (p_business_id, 'Payroll', 'fixed'),
    (p_business_id, 'Contractors', 'variable'),
    (p_business_id, 'Marketing', 'variable'),
    (p_business_id, 'Software', 'fixed'),
    (p_business_id, 'Insurance', 'fixed'),
    (p_business_id, 'Transport', 'variable'),
    (p_business_id, 'Shipping', 'variable'),
    (p_business_id, 'Equipment', 'variable'),
    (p_business_id, 'Professional services', 'variable'),
    (p_business_id, 'Taxes and fees', 'variable'),
    (p_business_id, 'Bank fees', 'variable'),
    (p_business_id, 'Travel', 'variable'),
    (p_business_id, 'Other expense', 'variable')
  on conflict do nothing;

  insert into public.business_cost_centres
    (business_id, name, description)
  values
    (p_business_id, 'General Operations', 'General day-to-day business activity'),
    (p_business_id, 'Administration', 'Administrative and back-office activity'),
    (p_business_id, 'Sales & Marketing', 'Sales, promotion and customer acquisition'),
    (p_business_id, 'Production / Delivery', 'Production, fulfilment and service delivery')
  on conflict do nothing;
end;
$$;


ALTER FUNCTION "public"."seed_business_cost_control_defaults"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_business_inventory_defaults"("p_business_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.business_inventory_categories (business_id, name, description)
  select p_business_id, seed.name, seed.description
  from (values
    ('Finished goods','Products ready for sale'),
    ('Raw materials','Materials used in production'),
    ('Components','Parts used to assemble products'),
    ('Packaging','Boxes, labels and packaging materials'),
    ('Business supplies','Consumable operational supplies'),
    ('Other','Unclassified inventory')
  ) as seed(name, description)
  where not exists (
    select 1 from public.business_inventory_categories existing
    where existing.business_id = p_business_id and lower(existing.name) = lower(seed.name)
  );

  insert into public.business_inventory_locations (business_id, name, description)
  select p_business_id, 'Main storage', 'Primary inventory location'
  where not exists (
    select 1 from public.business_inventory_locations existing
    where existing.business_id = p_business_id and lower(existing.name) = 'main storage'
  );

  insert into public.business_cost_categories (business_id, name, description, default_nature, is_active)
  select p_business_id, 'Inventory purchases', 'Cash paid to acquire stock', 'variable', true
  where not exists (
    select 1 from public.business_cost_categories existing
    where existing.business_id = p_business_id and lower(existing.name) = 'inventory purchases'
  );
end;
$$;


ALTER FUNCTION "public"."seed_business_inventory_defaults"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_active_business_workspace"("p_business_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.business_member_has_access(p_business_id) then
    raise exception 'You do not have access to this business.';
  end if;

  if not exists (
    select 1
    from public.businesses business
    where business.id = p_business_id
      and business.status = 'active'
  ) then
    raise exception 'Restore this business before opening it.';
  end if;

  insert into public.business_user_preferences (
    user_id,
    active_business_id
  ) values (
    v_user_id,
    p_business_id
  )
  on conflict (user_id)
  do update set
    active_business_id = excluded.active_business_id,
    updated_at = now();

  return p_business_id;
end;
$$;


ALTER FUNCTION "public"."set_active_business_workspace"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_admin_user_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_admin_user_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_financial_document_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_financial_document_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_support_request_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
  elsif new.status is distinct from 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_support_request_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_credit_card_monthly_record"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if lower(coalesce(new.category, '')) <> 'credit card'
    or new.statement_date is null
    or new.payment_due_date is null
    or new.statement_balance is null
    or new.statement_balance_eur is null then
    return new;
  end if;

  insert into public.credit_card_monthly_records (
    debt_id,
    user_id,
    month_start,
    currency,
    statement_balance,
    statement_balance_eur,
    minimum_payment,
    minimum_payment_eur,
    interest_charged,
    interest_charged_eur,
    statement_date,
    payment_due_date,
    updated_at
  ) values (
    new.id,
    new.user_id,
    date_trunc('month', new.statement_date)::date,
    new.currency,
    round(new.statement_balance, 2),
    round(new.statement_balance_eur, 2),
    round(coalesce(new.minimum_payment, 0), 2),
    round(coalesce(new.minimum_payment_eur, 0), 2),
    round(coalesce(new.interest_charged, 0), 2),
    round(coalesce(new.interest_charged_eur, 0), 2),
    new.statement_date,
    new.payment_due_date,
    now()
  )
  on conflict (debt_id, month_start)
  do update set
    user_id = excluded.user_id,
    currency = excluded.currency,
    statement_balance = excluded.statement_balance,
    statement_balance_eur = excluded.statement_balance_eur,
    minimum_payment = excluded.minimum_payment,
    minimum_payment_eur = excluded.minimum_payment_eur,
    interest_charged = excluded.interest_charged,
    interest_charged_eur = excluded.interest_charged_eur,
    statement_date = excluded.statement_date,
    payment_due_date = excluded.payment_due_date,
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_credit_card_monthly_record"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_effortless_entry_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_effortless_entry_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_statement_import_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_statement_import_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_support_request_from_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.internal_note then
    return new;
  end if;

  update public.support_requests
  set
    last_message_at = new.created_at,
    updated_at = new.created_at,
    status = case
      when new.sender_role = 'customer' and status = 'resolved' then 'open'
      else status
    end,
    resolved_at = case
      when new.sender_role = 'customer' and status = 'resolved' then null
      else resolved_at
    end
  where id = new.request_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_support_request_from_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_business_administration_settings"("p_business_id" "uuid", "p_default_timezone" "text", "p_date_format" "text", "p_number_format" "text", "p_default_payment_method" "text", "p_default_payment_terms_days" integer, "p_default_sales_tax_rate" numeric, "p_invoice_prefix" "text", "p_next_invoice_number" bigint, "p_default_low_stock_threshold" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_timezone text := coalesce(nullif(trim(p_default_timezone), ''), 'UTC');
  v_settings public.business_settings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.business_member_can_manage(p_business_id) then
    raise exception 'Owner or administrator access is required.';
  end if;

  perform 1 from pg_timezone_names where name = v_timezone;
  if not found then
    raise exception 'Enter a valid timezone.';
  end if;

  if p_date_format not in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD') then
    raise exception 'Select a supported date format.';
  end if;

  if p_number_format not in ('de-DE', 'en-GB', 'en-US', 'fr-FR') then
    raise exception 'Select a supported number format.';
  end if;

  if p_default_payment_terms_days not between 0 and 365 then
    raise exception 'Payment terms must be between 0 and 365 days.';
  end if;

  if p_default_sales_tax_rate < 0 or p_default_sales_tax_rate > 100 then
    raise exception 'Sales tax must be between 0 and 100 percent.';
  end if;

  if p_next_invoice_number < 1 then
    raise exception 'The next invoice number must be at least 1.';
  end if;

  if p_default_low_stock_threshold < 0 then
    raise exception 'The low-stock threshold cannot be negative.';
  end if;

  if char_length(trim(coalesce(p_invoice_prefix, ''))) not between 1 and 20
     or upper(trim(p_invoice_prefix)) !~ '^[A-Z0-9-]+$' then
    raise exception 'Invoice prefix may contain letters, numbers and hyphens.';
  end if;

  insert into public.business_settings (
    business_id,
    default_timezone,
    date_format,
    number_format,
    default_payment_method,
    default_payment_terms_days,
    default_sales_tax_rate,
    invoice_prefix,
    next_invoice_number,
    default_low_stock_threshold
  ) values (
    p_business_id,
    v_timezone,
    p_date_format,
    p_number_format,
    coalesce(nullif(trim(p_default_payment_method), ''), 'Card'),
    p_default_payment_terms_days,
    p_default_sales_tax_rate,
    upper(trim(p_invoice_prefix)),
    p_next_invoice_number,
    p_default_low_stock_threshold
  )
  on conflict (business_id)
  do update set
    default_timezone = excluded.default_timezone,
    date_format = excluded.date_format,
    number_format = excluded.number_format,
    default_payment_method = excluded.default_payment_method,
    default_payment_terms_days = excluded.default_payment_terms_days,
    default_sales_tax_rate = excluded.default_sales_tax_rate,
    invoice_prefix = excluded.invoice_prefix,
    next_invoice_number = excluded.next_invoice_number,
    default_low_stock_threshold = excluded.default_low_stock_threshold,
    updated_at = now()
  returning * into v_settings;

  update public.businesses
  set timezone = v_timezone,
      updated_at = now()
  where id = p_business_id
    and timezone is distinct from v_timezone;

  return to_jsonb(v_settings);
end;
$_$;


ALTER FUNCTION "public"."update_business_administration_settings"("p_business_id" "uuid", "p_default_timezone" "text", "p_date_format" "text", "p_number_format" "text", "p_default_payment_method" "text", "p_default_payment_terms_days" integer, "p_default_sales_tax_rate" numeric, "p_invoice_prefix" "text", "p_next_invoice_number" bigint, "p_default_low_stock_threshold" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_business_document"("p_document_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_expires_on" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_document public.business_documents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_document
  from public.business_documents document
  where document.id = p_document_id
  for update;

  if v_document.id is null then
    raise exception 'Business document was not found.';
  end if;

  if not public.business_member_can_manage(v_document.business_id) then
    raise exception 'Owner or administrator access is required.';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 2 and 160 then
    raise exception 'Document title must contain 2 to 160 characters.';
  end if;

  if p_category not in (
    'Company registration',
    'Tax & VAT',
    'Licences & permits',
    'Contracts',
    'Supplier documents',
    'Insurance',
    'Banking & finance',
    'Receipts & invoices',
    'Employment',
    'Other'
  ) then
    raise exception 'Select a supported document category.';
  end if;

  update public.business_documents
  set
    title = trim(p_title),
    category = p_category,
    description = nullif(trim(coalesce(p_description, '')), ''),
    expires_on = p_expires_on
  where id = p_document_id
  returning * into v_document;

  return to_jsonb(v_document);
end;
$$;


ALTER FUNCTION "public"."update_business_document"("p_document_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_expires_on" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_business_sale"("p_sale_id" "uuid", "p_sale_number" "text", "p_customer_name" "text" DEFAULT NULL::"text", "p_customer_email" "text" DEFAULT NULL::"text", "p_currency" "text" DEFAULT 'EUR'::"text", "p_exchange_rate_to_base" numeric DEFAULT 1, "p_exchange_rate_date" "date" DEFAULT CURRENT_DATE, "p_exchange_rate_source" "text" DEFAULT NULL::"text", "p_sale_date" "date" DEFAULT CURRENT_DATE, "p_occurred_at" timestamp with time zone DEFAULT "now"(), "p_payment_method" "text" DEFAULT 'Card'::"text", "p_discount" numeric DEFAULT 0, "p_tax" numeric DEFAULT 0, "p_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text", "p_lines" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.business_sales%rowtype;
  v_base_currency text;
  v_rate numeric := greatest(coalesce(p_exchange_rate_to_base, 1), 0.00000001);
  v_old_line public.business_sale_lines%rowtype;
  v_old_movement public.business_inventory_movements%rowtype;
  v_reversal public.business_inventory_movements%rowtype;
  v_line jsonb;
  v_sale_line public.business_sale_lines%rowtype;
  v_item public.business_inventory_items%rowtype;
  v_movement public.business_inventory_movements%rowtype;
  v_transaction public.business_transactions%rowtype;
  v_inventory_id uuid;
  v_name text;
  v_sku text;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_subtotal numeric;
  v_line_subtotal_base numeric;
  v_current_quantity numeric;
  v_current_value numeric;
  v_average_cost numeric;
  v_line_cogs numeric;
  v_subtotal numeric := 0;
  v_subtotal_base numeric := 0;
  v_total_cogs numeric := 0;
  v_units numeric := 0;
  v_line_count integer := 0;
  v_discount numeric := greatest(coalesce(p_discount, 0), 0);
  v_tax numeric := greatest(coalesce(p_tax, 0), 0);
  v_discount_base numeric;
  v_tax_base numeric;
  v_net_sales_base numeric;
  v_total numeric;
  v_total_base numeric;
  v_old_transaction_id uuid;
  v_lines_result jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_sale
  from public.business_sales
  where id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale was not found.';
  end if;

  if not public.business_member_can_write(v_sale.business_id) then
    raise exception 'Business write access is required.';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Only a completed sale can be edited.';
  end if;

  if nullif(trim(coalesce(p_sale_number, '')), '') is null then
    raise exception 'A sale number is required.';
  end if;

  if jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one sale line is required.';
  end if;

  if jsonb_array_length(p_lines) > 100 then
    raise exception 'A sale can contain at most 100 lines.';
  end if;

  select base_currency
    into v_base_currency
  from public.businesses
  where id = v_sale.business_id;

  if v_base_currency is null then
    raise exception 'Business was not found.';
  end if;

  -- Restore the currently completed sale before applying the correction.
  for v_old_line in
    select *
    from public.business_sale_lines
    where sale_id = v_sale.id
      and inventory_movement_id is not null
    order by created_at
  loop
    select *
      into v_old_movement
    from public.business_inventory_movements
    where id = v_old_line.inventory_movement_id
    for update;

    if v_old_movement.id is null then
      raise exception 'A linked inventory movement is missing.';
    end if;

    if exists (
      select 1
      from public.business_inventory_movements movement
      where movement.reversal_of_id = v_old_movement.id
    ) then
      raise exception 'The current sale inventory has already been restored.';
    end if;

    insert into public.business_inventory_movements (
      business_id,
      item_id,
      item_name,
      item_sku,
      created_by,
      movement_type,
      quantity_delta,
      unit_cost,
      currency,
      unit_cost_base,
      inventory_value_delta_base,
      exchange_rate_to_base,
      exchange_rate_date,
      exchange_rate_source,
      reversal_of_id,
      movement_date,
      occurred_at,
      reference,
      notes
    ) values (
      v_old_movement.business_id,
      v_old_movement.item_id,
      v_old_movement.item_name,
      v_old_movement.item_sku,
      v_user_id,
      'reversal',
      -v_old_movement.quantity_delta,
      v_old_movement.unit_cost,
      v_old_movement.currency,
      v_old_movement.unit_cost_base,
      -v_old_movement.inventory_value_delta_base,
      v_old_movement.exchange_rate_to_base,
      current_date,
      'Sale edit reversal',
      v_old_movement.id,
      current_date,
      now(),
      'Edit · ' || v_sale.sale_number,
      'Inventory restored before applying an edited sale'
    ) returning * into v_reversal;
  end loop;

  v_old_transaction_id := v_sale.transaction_id;

  if v_old_transaction_id is not null then
    delete from public.business_transactions
    where id = v_old_transaction_id
      and business_id = v_sale.business_id
      and source_sale_id = v_sale.id;
  end if;

  delete from public.business_sale_lines
  where sale_id = v_sale.id;

  -- Apply the corrected lines against the restored inventory.
  for v_line in
    select value
    from jsonb_array_elements(p_lines)
  loop
    v_inventory_id := nullif(v_line ->> 'inventory_item_id', '')::uuid;
    v_name := nullif(trim(coalesce(v_line ->> 'item_name', '')), '');
    v_quantity := abs(coalesce((v_line ->> 'quantity')::numeric, 0));
    v_unit_price := greatest(coalesce((v_line ->> 'unit_price')::numeric, 0), 0);

    if v_quantity <= 0 then
      raise exception 'Every sale quantity must be greater than zero.';
    end if;

    if v_name is null then
      raise exception 'Every sale line requires an item or service name.';
    end if;

    v_line_subtotal := round(v_quantity * v_unit_price, 2);
    v_line_subtotal_base := round(v_line_subtotal * v_rate, 2);
    v_sku := null;
    v_average_cost := 0;
    v_line_cogs := 0;
    v_movement.id := null;

    if v_inventory_id is not null then
      select *
        into v_item
      from public.business_inventory_items item
      where item.id = v_inventory_id
        and item.business_id = v_sale.business_id
      for update;

      if v_item.id is null then
        raise exception 'One selected inventory item was not found.';
      end if;

      select
        coalesce(sum(quantity_delta), 0),
        coalesce(sum(inventory_value_delta_base), 0)
        into v_current_quantity, v_current_value
      from public.business_inventory_movements
      where item_id = v_item.id;

      if v_current_quantity <= 0
         or v_quantity > v_current_quantity then
        raise exception '% has only % % available.',
          v_item.name,
          v_current_quantity,
          v_item.unit;
      end if;

      v_average_cost :=
        case
          when v_current_quantity > 0
            then greatest(v_current_value, 0) / v_current_quantity
          else 0
        end;

      v_line_cogs :=
        case
          when v_quantity = v_current_quantity
            then round(greatest(v_current_value, 0), 2)
          else round(v_quantity * v_average_cost, 2)
        end;

      v_name := v_item.name;
      v_sku := v_item.sku;

      insert into public.business_inventory_movements (
        business_id,
        item_id,
        item_name,
        item_sku,
        created_by,
        movement_type,
        quantity_delta,
        unit_cost,
        currency,
        unit_cost_base,
        inventory_value_delta_base,
        exchange_rate_to_base,
        exchange_rate_date,
        exchange_rate_source,
        movement_date,
        occurred_at,
        reference,
        notes
      ) values (
        v_sale.business_id,
        v_item.id,
        v_item.name,
        v_item.sku,
        v_user_id,
        'sale',
        -v_quantity,
        round(v_average_cost, 4),
        v_base_currency,
        round(v_average_cost, 4),
        -v_line_cogs,
        1,
        p_sale_date,
        'Edited sale COGS',
        p_sale_date,
        p_occurred_at,
        coalesce(
          nullif(trim(coalesce(p_reference, '')), ''),
          upper(trim(p_sale_number))
        ),
        'Inventory issued through an edited Business sale'
      ) returning * into v_movement;
    end if;

    insert into public.business_sale_lines (
      sale_id,
      business_id,
      inventory_item_id,
      item_name,
      item_sku,
      quantity,
      unit_price,
      line_subtotal,
      line_subtotal_base,
      unit_cost_base,
      cogs_base,
      gross_profit_base,
      inventory_movement_id
    ) values (
      v_sale.id,
      v_sale.business_id,
      v_inventory_id,
      v_name,
      v_sku,
      v_quantity,
      v_unit_price,
      v_line_subtotal,
      v_line_subtotal_base,
      round(v_average_cost, 4),
      v_line_cogs,
      round(v_line_subtotal_base - v_line_cogs, 2),
      v_movement.id
    ) returning * into v_sale_line;

    v_lines_result :=
      v_lines_result || jsonb_build_array(to_jsonb(v_sale_line));
    v_subtotal := v_subtotal + v_line_subtotal;
    v_subtotal_base := v_subtotal_base + v_line_subtotal_base;
    v_total_cogs := v_total_cogs + v_line_cogs;
    v_units := v_units + v_quantity;
    v_line_count := v_line_count + 1;
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Discount cannot exceed the sale subtotal.';
  end if;

  v_discount_base := round(v_discount * v_rate, 2);
  v_tax_base := round(v_tax * v_rate, 2);
  v_net_sales_base := round(v_subtotal_base - v_discount_base, 2);
  v_total := round(v_subtotal - v_discount + v_tax, 2);
  v_total_base := round(v_net_sales_base + v_tax_base, 2);

  update public.business_sales
  set
    sale_number = p_sale_number,
    customer_name = p_customer_name,
    customer_email = p_customer_email,
    status = 'completed',
    currency = upper(p_currency),
    exchange_rate_to_base = v_rate,
    exchange_rate_date = p_exchange_rate_date,
    exchange_rate_source = p_exchange_rate_source,
    subtotal = round(v_subtotal, 2),
    discount = round(v_discount, 2),
    tax = round(v_tax, 2),
    total = v_total,
    subtotal_base = round(v_subtotal_base, 2),
    discount_base = v_discount_base,
    tax_base = v_tax_base,
    total_base = v_total_base,
    net_sales_base = v_net_sales_base,
    cogs_base = round(v_total_cogs, 2),
    gross_profit_base = round(v_net_sales_base - v_total_cogs, 2),
    line_count = v_line_count,
    units_sold = v_units,
    sale_date = p_sale_date,
    occurred_at = p_occurred_at,
    payment_method = p_payment_method,
    reference = p_reference,
    notes = p_notes,
    transaction_id = null,
    refunded_at = null,
    deleted_at = null,
    updated_at = now()
  where id = v_sale.id
  returning * into v_sale;

  insert into public.business_transactions (
    business_id,
    created_by,
    description,
    counterparty,
    type,
    category,
    source_sale_id,
    amount,
    currency,
    amount_base,
    exchange_rate_to_base,
    exchange_rate_date,
    exchange_rate_source,
    transaction_date,
    occurred_at,
    payment_method,
    reference,
    notes
  ) values (
    v_sale.business_id,
    v_user_id,
    'Sale · ' || v_sale.sale_number,
    v_sale.customer_name,
    'income',
    'Sales revenue',
    v_sale.id,
    v_total,
    v_sale.currency,
    v_total_base,
    v_rate,
    p_exchange_rate_date,
    coalesce(p_exchange_rate_source, 'Edited business sale'),
    p_sale_date,
    p_occurred_at,
    v_sale.payment_method,
    coalesce(v_sale.reference, v_sale.sale_number),
    coalesce(v_sale.notes, 'Revenue recorded from an edited Business sale')
  ) returning * into v_transaction;

  update public.business_sales
  set
    transaction_id = v_transaction.id,
    updated_at = now()
  where id = v_sale.id
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'transaction', to_jsonb(v_transaction),
    'lines', v_lines_result,
    'deleted_transaction_id', v_old_transaction_id
  );
end;
$$;


ALTER FUNCTION "public"."update_business_sale"("p_sale_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_business_sale"("p_sale_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") IS 'Atomically reverses a completed sale and applies the corrected sale, inventory, revenue and COGS records.';



CREATE OR REPLACE FUNCTION "public"."update_business_workspace"("p_business_id" "uuid", "p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text", "p_tax_id" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_website" "text", "p_address_line1" "text", "p_address_line2" "text", "p_city" "text", "p_postal_code" "text", "p_logo_path" "text", "p_cover_image_path" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business public.businesses%rowtype;
  v_currency text := upper(trim(coalesce(p_base_currency, '')));
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_business
  from public.businesses business
  where business.id = p_business_id
  for update;

  if v_business.id is null then
    raise exception 'Business workspace was not found.';
  end if;

  if v_business.owner_id <> v_user_id then
    raise exception 'Only the business owner can edit this workspace.';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Enter a valid business name.';
  end if;

  if char_length(upper(trim(coalesce(p_country_code, '')))) <> 2 then
    raise exception 'Country code must contain two letters.';
  end if;

  if char_length(v_currency) <> 3 then
    raise exception 'Base currency must contain three letters.';
  end if;

  if p_fiscal_year_start_month not between 1 and 12 then
    raise exception 'Fiscal year start month must be between 1 and 12.';
  end if;

  perform 1
  from pg_timezone_names
  where name = v_timezone;

  if not found then
    raise exception 'Enter a valid timezone.';
  end if;

  if v_currency <> v_business.base_currency
     and public.business_workspace_has_financial_activity(p_business_id) then
    raise exception
      'Base currency cannot be changed after financial activity has started.';
  end if;

  if p_logo_path is not null and not (
    split_part(p_logo_path, '/', 1) = v_user_id::text
    and split_part(p_logo_path, '/', 2) = p_business_id::text
    and split_part(p_logo_path, '/', 3) = 'logo'
  ) then
    raise exception 'The logo path is invalid for this business.';
  end if;

  if p_cover_image_path is not null and not (
    split_part(p_cover_image_path, '/', 1) = v_user_id::text
    and split_part(p_cover_image_path, '/', 2) = p_business_id::text
    and split_part(p_cover_image_path, '/', 3) = 'cover'
  ) then
    raise exception 'The cover image path is invalid for this business.';
  end if;

  update public.businesses
  set
    name = trim(p_name),
    legal_name = nullif(trim(coalesce(p_legal_name, '')), ''),
    business_type =
      coalesce(nullif(trim(p_business_type), ''), 'Sole trader'),
    country_code = upper(trim(p_country_code)),
    base_currency = v_currency,
    fiscal_year_start_month = p_fiscal_year_start_month,
    timezone = v_timezone,
    tax_id = nullif(trim(coalesce(p_tax_id, '')), ''),
    contact_email = nullif(trim(coalesce(p_contact_email, '')), ''),
    contact_phone = nullif(trim(coalesce(p_contact_phone, '')), ''),
    website = nullif(trim(coalesce(p_website, '')), ''),
    address_line1 = nullif(trim(coalesce(p_address_line1, '')), ''),
    address_line2 = nullif(trim(coalesce(p_address_line2, '')), ''),
    city = nullif(trim(coalesce(p_city, '')), ''),
    postal_code = nullif(trim(coalesce(p_postal_code, '')), ''),
    logo_path = p_logo_path,
    cover_image_path = p_cover_image_path,
    updated_at = now()
  where id = p_business_id
  returning * into v_business;

  update public.business_settings
  set
    default_timezone = v_timezone,
    updated_at = now()
  where business_id = p_business_id;

  return to_jsonb(v_business);
end;
$$;


ALTER FUNCTION "public"."update_business_workspace"("p_business_id" "uuid", "p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text", "p_tax_id" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_website" "text", "p_address_line1" "text", "p_address_line2" "text", "p_city" "text", "p_postal_code" "text", "p_logo_path" "text", "p_cover_image_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_credit_card_statement"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_activity public.credit_card_activities%rowtype;
  v_post_statement_activity numeric(16,2) := 0;
  v_post_statement_activity_eur numeric(16,2) := 0;
  v_post_statement_payments numeric(16,2) := 0;
  v_post_statement_payments_eur numeric(16,2) := 0;
  v_reconciled_balance numeric(16,2);
  v_reconciled_balance_eur numeric(16,2);
  v_effect numeric(16,2);
  v_effect_eur numeric(16,2);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_statement_balance is null or p_statement_balance < 0
    or p_statement_balance_eur is null or p_statement_balance_eur < 0
    or p_exchange_rate is null or p_exchange_rate <= 0
    or p_minimum_payment is null or p_minimum_payment < 0
    or p_minimum_payment_eur is null or p_minimum_payment_eur < 0
    or p_apr is null or p_apr < 0
    or p_interest_charged is null or p_interest_charged < 0
    or p_interest_charged_eur is null or p_interest_charged_eur < 0 then
    raise exception 'Enter valid statement values.' using errcode = '22023';
  end if;

  if p_statement_date is null or p_payment_due_date is null then
    raise exception 'Statement date and payment due date are required.' using errcode = '22023';
  end if;

  if p_payment_due_date < p_statement_date then
    raise exception 'The payment due date cannot be before the statement date.'
      using errcode = '22023';
  end if;

  if p_minimum_payment > p_statement_balance then
    raise exception 'Minimum payment cannot exceed the statement balance.'
      using errcode = '22023';
  end if;

  select debt_record.*
  into v_debt
  from public.debts as debt_record
  where debt_record.id = p_debt_id
    and debt_record.user_id = v_user_id
    and lower(debt_record.category) = 'credit card'
  for update;

  if not found then
    raise exception 'Credit card not found.' using errcode = 'P0002';
  end if;

  if v_debt.statement_date is not null
    and p_statement_date < v_debt.statement_date then
    raise exception 'The new statement date cannot be earlier than the confirmed statement date.'
      using errcode = '22023';
  end if;

  select
    coalesce(sum(activity_record.balance_effect), 0),
    coalesce(sum(activity_record.balance_effect_eur), 0)
  into v_post_statement_activity, v_post_statement_activity_eur
  from public.credit_card_activities as activity_record
  where activity_record.debt_id = v_debt.id
    and activity_record.user_id = v_user_id
    and activity_record.occurred_at::date > p_statement_date;

  select
    coalesce(sum(payment_record.amount), 0),
    coalesce(sum(payment_record.amount_eur), 0)
  into v_post_statement_payments, v_post_statement_payments_eur
  from public.debt_payments as payment_record
  where payment_record.debt_id = v_debt.id
    and payment_record.user_id = v_user_id
    and payment_record.paid_at::date > p_statement_date;

  v_reconciled_balance := greatest(
    0,
    round(
      p_statement_balance
        + v_post_statement_activity
        - v_post_statement_payments,
      2
    )
  );
  v_reconciled_balance_eur := greatest(
    0,
    round(
      p_statement_balance_eur
        + v_post_statement_activity_eur
        - v_post_statement_payments_eur,
      2
    )
  );

  v_effect := round(v_reconciled_balance - v_debt.current_balance, 2);
  v_effect_eur := round(v_reconciled_balance_eur - v_debt.current_balance_eur, 2);

  update public.debts
  set
    current_balance = v_reconciled_balance,
    current_balance_eur = v_reconciled_balance_eur,
    exchange_rate_to_eur = p_exchange_rate,
    statement_balance = round(p_statement_balance, 2),
    statement_balance_eur = round(p_statement_balance_eur, 2),
    statement_date = p_statement_date,
    payment_due_date = p_payment_due_date,
    payment_due_day = extract(day from p_payment_due_date)::integer,
    minimum_payment = round(p_minimum_payment, 2),
    minimum_payment_eur = round(p_minimum_payment_eur, 2),
    annual_interest_rate = p_apr,
    interest_charged = round(p_interest_charged, 2),
    interest_charged_eur = round(p_interest_charged_eur, 2),
    status = 'active',
    autopay = false,
    autopay_enabled_at = null,
    updated_at = now()
  where id = v_debt.id
    and user_id = v_user_id
  returning * into v_debt;

  if v_effect <> 0 and v_effect_eur <> 0 then
    insert into public.credit_card_activities (
      debt_id,
      user_id,
      activity_type,
      description,
      amount,
      currency,
      amount_eur,
      exchange_rate_to_eur,
      balance_effect,
      balance_effect_eur,
      occurred_at,
      notes
    ) values (
      v_debt.id,
      v_user_id,
      'statement_adjustment',
      'Statement reconciliation',
      abs(v_effect),
      v_debt.currency,
      abs(v_effect_eur),
      p_exchange_rate,
      v_effect,
      v_effect_eur,
      (p_statement_date::timestamp + time '12:00') at time zone 'UTC',
      'Balance reconciled to the confirmed card statement.'
    )
    returning * into v_activity;
  end if;

  return jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'activity', case when v_activity.id is null then null else to_jsonb(v_activity) end
  );
end;
$$;


ALTER FUNCTION "public"."update_credit_card_statement"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid",
    "action" "text" NOT NULL,
    "target_user_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_audit_logs_action_check" CHECK ((("char_length"("action") >= 1) AND ("char_length"("action") <= 80)))
);

ALTER TABLE ONLY "public"."admin_audit_logs" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."admin_audit_logs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))
);

ALTER TABLE ONLY "public"."admin_users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_insight_preferences" (
    "user_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "consent_version" "text",
    "consented_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_insight_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_insight_preferences" IS 'Private per-user consent and enablement settings for on-demand FICONTER AI Insights.';



CREATE TABLE IF NOT EXISTS "public"."ai_insight_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "data_fingerprint" "text" NOT NULL,
    "report" "jsonb" NOT NULL,
    "model" "text" NOT NULL,
    "data_coverage" integer DEFAULT 0 NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_insight_snapshots_data_coverage_check" CHECK ((("data_coverage" >= 0) AND ("data_coverage" <= 100))),
    CONSTRAINT "ai_insight_snapshots_report_object_check" CHECK (("jsonb_typeof"("report") = 'object'::"text"))
);


ALTER TABLE "public"."ai_insight_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_insight_snapshots" IS 'Private per-user cached AI insight reports. Raw financial input payloads are not stored.';



CREATE TABLE IF NOT EXISTS "public"."automatic_payment_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "occurrence_key" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "amount" numeric(16,2) NOT NULL,
    "currency" "text" NOT NULL,
    "amount_eur" numeric(16,2) NOT NULL,
    "transaction_id" "uuid",
    "debt_payment_id" "uuid",
    "trigger_mode" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "automatic_payment_runs_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "automatic_payment_runs_amount_eur_check" CHECK (("amount_eur" > (0)::numeric)),
    CONSTRAINT "automatic_payment_runs_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "automatic_payment_runs_source_type_check" CHECK (("source_type" = ANY (ARRAY['bill'::"text", 'debt'::"text"]))),
    CONSTRAINT "automatic_payment_runs_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "automatic_payment_runs_trigger_mode_check" CHECK (("trigger_mode" = ANY (ARRAY['automatic'::"text", 'manual'::"text"])))
);

ALTER TABLE ONLY "public"."automatic_payment_runs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."automatic_payment_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "company" "text",
    "category" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "amount_eur" numeric(14,2) NOT NULL,
    "exchange_rate_to_eur" numeric(18,8) DEFAULT 1 NOT NULL,
    "due_date" "date" NOT NULL,
    "recurrence" "text" DEFAULT 'none'::"text" NOT NULL,
    "payment_method" "text",
    "autopay" boolean DEFAULT false NOT NULL,
    "reminder_days" integer DEFAULT 3 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "paid_at" timestamp with time zone,
    "transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "autopay_record_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "autopay_timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "autopay_enabled_at" timestamp with time zone,
    "recurrence_anchor_day" smallint,
    "recurrence_anchor_month_end" boolean DEFAULT false NOT NULL,
    CONSTRAINT "bills_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "bills_amount_eur_check" CHECK (("amount_eur" >= (0)::numeric)),
    CONSTRAINT "bills_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "bills_exchange_rate_to_eur_check" CHECK (("exchange_rate_to_eur" > (0)::numeric)),
    CONSTRAINT "bills_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 120))),
    CONSTRAINT "bills_recurrence_anchor_day_check" CHECK ((("recurrence_anchor_day" IS NULL) OR (("recurrence_anchor_day" >= 1) AND ("recurrence_anchor_day" <= 31)))),
    CONSTRAINT "bills_recurrence_check" CHECK (("recurrence" = ANY (ARRAY['none'::"text", 'weekly'::"text", 'biweekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'semiannual'::"text", 'yearly'::"text"]))),
    CONSTRAINT "bills_reminder_days_check" CHECK ((("reminder_days" >= 0) AND ("reminder_days" <= 365))),
    CONSTRAINT "bills_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."bills" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."bills" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "actor_label" "text" DEFAULT 'System'::"text" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "summary" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_audit_log_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'deleted'::"text", 'archived'::"text", 'restored'::"text"])))
);


ALTER TABLE "public"."business_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_cost_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "budget_month" "date" NOT NULL,
    "amount_base" numeric(18,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_cost_budgets_amount_base_check" CHECK (("amount_base" >= (0)::numeric)),
    CONSTRAINT "business_cost_budgets_budget_month_check" CHECK ((EXTRACT(day FROM "budget_month") = (1)::numeric))
);


ALTER TABLE "public"."business_cost_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_cost_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "default_nature" "text" DEFAULT 'variable'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_cost_categories_default_nature_check" CHECK (("default_nature" = ANY (ARRAY['fixed'::"text", 'variable'::"text"]))),
    CONSTRAINT "business_cost_categories_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 100)))
);


ALTER TABLE "public"."business_cost_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_cost_centres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_cost_centres_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 100)))
);


ALTER TABLE "public"."business_cost_centres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "file_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "expires_on" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_documents_category_check" CHECK (("category" = ANY (ARRAY['Company registration'::"text", 'Tax & VAT'::"text", 'Licences & permits'::"text", 'Contracts'::"text", 'Supplier documents'::"text", 'Insurance'::"text", 'Banking & finance'::"text", 'Receipts & invoices'::"text", 'Employment'::"text", 'Other'::"text"]))),
    CONSTRAINT "business_documents_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 1000))),
    CONSTRAINT "business_documents_file_size_check" CHECK ((("file_size" >= 1) AND ("file_size" <= 15728640))),
    CONSTRAINT "business_documents_filename_check" CHECK ((("char_length"(TRIM(BOTH FROM "original_filename")) >= 1) AND ("char_length"(TRIM(BOTH FROM "original_filename")) <= 255))),
    CONSTRAINT "business_documents_mime_check" CHECK (("mime_type" = ANY (ARRAY['application/pdf'::"text", 'application/msword'::"text", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::"text", 'application/vnd.ms-excel'::"text", 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::"text", 'text/csv'::"text", 'text/plain'::"text", 'image/png'::"text", 'image/jpeg'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "business_documents_title_check" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 2) AND ("char_length"(TRIM(BOTH FROM "title")) <= 160)))
);


ALTER TABLE "public"."business_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_inventory_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_inventory_categories_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 100)))
);


ALTER TABLE "public"."business_inventory_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "barcode" "text",
    "category_id" "uuid",
    "supplier_id" "uuid",
    "location_id" "uuid",
    "unit" "text" DEFAULT 'unit'::"text" NOT NULL,
    "low_stock_threshold" numeric(18,4) DEFAULT 0 NOT NULL,
    "default_purchase_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "default_purchase_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "default_purchase_cost_base" numeric(18,4) DEFAULT 0 NOT NULL,
    "default_exchange_rate_to_base" numeric(20,8) DEFAULT 1 NOT NULL,
    "selling_price_base" numeric(18,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_inventory_items_default_exchange_rate_to_base_check" CHECK (("default_exchange_rate_to_base" > (0)::numeric)),
    CONSTRAINT "business_inventory_items_default_purchase_cost_base_check" CHECK (("default_purchase_cost_base" >= (0)::numeric)),
    CONSTRAINT "business_inventory_items_default_purchase_cost_check" CHECK (("default_purchase_cost" >= (0)::numeric)),
    CONSTRAINT "business_inventory_items_default_purchase_currency_check" CHECK (("char_length"("default_purchase_currency") = 3)),
    CONSTRAINT "business_inventory_items_low_stock_threshold_check" CHECK (("low_stock_threshold" >= (0)::numeric)),
    CONSTRAINT "business_inventory_items_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 180))),
    CONSTRAINT "business_inventory_items_selling_price_base_check" CHECK (("selling_price_base" >= (0)::numeric)),
    CONSTRAINT "business_inventory_items_sku_check" CHECK ((("char_length"(TRIM(BOTH FROM "sku")) >= 1) AND ("char_length"(TRIM(BOTH FROM "sku")) <= 100))),
    CONSTRAINT "business_inventory_items_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'discontinued'::"text"]))),
    CONSTRAINT "business_inventory_items_unit_check" CHECK ((("char_length"(TRIM(BOTH FROM "unit")) >= 1) AND ("char_length"(TRIM(BOTH FROM "unit")) <= 30)))
);


ALTER TABLE "public"."business_inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_inventory_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_inventory_locations_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 100)))
);


ALTER TABLE "public"."business_inventory_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "item_sku" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity_delta" numeric(18,4) NOT NULL,
    "unit_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "unit_cost_base" numeric(18,4) DEFAULT 0 NOT NULL,
    "inventory_value_delta_base" numeric(18,4) NOT NULL,
    "exchange_rate_to_base" numeric(20,8) DEFAULT 1 NOT NULL,
    "exchange_rate_date" "date",
    "exchange_rate_source" "text",
    "supplier_id" "uuid",
    "supplier_name" "text",
    "transaction_id" "uuid",
    "reversal_of_id" "uuid",
    "movement_date" "date" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "reference" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_inventory_movements_currency_check" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "business_inventory_movements_exchange_rate_to_base_check" CHECK (("exchange_rate_to_base" > (0)::numeric)),
    CONSTRAINT "business_inventory_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['opening_stock'::"text", 'purchase'::"text", 'sale'::"text", 'used'::"text", 'damaged'::"text", 'lost'::"text", 'adjustment_in'::"text", 'adjustment_out'::"text", 'return_in'::"text", 'return_out'::"text", 'reversal'::"text"]))),
    CONSTRAINT "business_inventory_movements_quantity_delta_check" CHECK (("quantity_delta" <> (0)::numeric)),
    CONSTRAINT "business_inventory_movements_unit_cost_base_check" CHECK (("unit_cost_base" >= (0)::numeric)),
    CONSTRAINT "business_inventory_movements_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."business_inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "legal_name" "text",
    "supplier_code" "text",
    "category" "text" DEFAULT 'Other'::"text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "website" "text",
    "tax_id" "text",
    "payment_terms_days" smallint DEFAULT 30 NOT NULL,
    "default_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "postal_code" "text",
    "country_code" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_suppliers_country_code_check" CHECK ((("country_code" IS NULL) OR ("char_length"("country_code") = 2))),
    CONSTRAINT "business_suppliers_default_currency_check" CHECK (("char_length"("default_currency") = 3)),
    CONSTRAINT "business_suppliers_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 160))),
    CONSTRAINT "business_suppliers_payment_terms_days_check" CHECK ((("payment_terms_days" >= 0) AND ("payment_terms_days" <= 365))),
    CONSTRAINT "business_suppliers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."business_suppliers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."business_inventory_item_balances" WITH ("security_invoker"='true') AS
 WITH "movement_totals" AS (
         SELECT "movement"."item_id",
            (COALESCE("sum"("movement"."quantity_delta"), (0)::numeric))::numeric(18,4) AS "quantity_on_hand",
            (COALESCE("sum"("movement"."inventory_value_delta_base"), (0)::numeric))::numeric(18,4) AS "inventory_value_base",
            ("count"(*))::integer AS "movement_count",
            "max"("movement"."occurred_at") AS "last_movement_at"
           FROM "public"."business_inventory_movements" "movement"
          GROUP BY "movement"."item_id"
        )
 SELECT "item"."id",
    "item"."business_id",
    "item"."created_by",
    "item"."name",
    "item"."sku",
    "item"."barcode",
    "item"."category_id",
    "category"."name" AS "category_name",
    "item"."supplier_id",
    "supplier"."name" AS "supplier_name",
    "item"."location_id",
    "location"."name" AS "location_name",
    "item"."unit",
    "item"."low_stock_threshold",
    "item"."default_purchase_cost",
    "item"."default_purchase_currency",
    "item"."default_purchase_cost_base",
    "item"."default_exchange_rate_to_base",
    "item"."selling_price_base",
    "item"."status",
    "item"."notes",
    (COALESCE("total"."quantity_on_hand", (0)::numeric))::numeric(18,4) AS "quantity_on_hand",
    (
        CASE
            WHEN (COALESCE("total"."quantity_on_hand", (0)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE GREATEST((0)::numeric, COALESCE("total"."inventory_value_base", (0)::numeric))
        END)::numeric(18,4) AS "inventory_value_base",
    (
        CASE
            WHEN (COALESCE("total"."quantity_on_hand", (0)::numeric) > (0)::numeric) THEN GREATEST((0)::numeric, (COALESCE("total"."inventory_value_base", (0)::numeric) / "total"."quantity_on_hand"))
            ELSE (0)::numeric
        END)::numeric(18,4) AS "average_cost_base",
    (GREATEST((0)::numeric, (COALESCE("total"."quantity_on_hand", (0)::numeric) * "item"."selling_price_base")))::numeric(18,2) AS "potential_sales_value_base",
    (GREATEST((0)::numeric, ((COALESCE("total"."quantity_on_hand", (0)::numeric) * "item"."selling_price_base") - COALESCE("total"."inventory_value_base", (0)::numeric))))::numeric(18,2) AS "potential_gross_profit_base",
    COALESCE("total"."movement_count", 0) AS "movement_count",
    "total"."last_movement_at",
    "item"."created_at",
    "item"."updated_at"
   FROM (((("public"."business_inventory_items" "item"
     LEFT JOIN "public"."business_inventory_categories" "category" ON (("category"."id" = "item"."category_id")))
     LEFT JOIN "public"."business_suppliers" "supplier" ON (("supplier"."id" = "item"."supplier_id")))
     LEFT JOIN "public"."business_inventory_locations" "location" ON (("location"."id" = "item"."location_id")))
     LEFT JOIN "movement_totals" "total" ON (("total"."item_id" = "item"."id")));


ALTER VIEW "public"."business_inventory_item_balances" OWNER TO "postgres";


COMMENT ON VIEW "public"."business_inventory_item_balances" IS 'Current inventory quantities and weighted-average values derived from the immutable stock movement ledger.';



CREATE TABLE IF NOT EXISTS "public"."business_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text", 'viewer'::"text"]))),
    CONSTRAINT "business_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'invited'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."business_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_recurring_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "supplier" "text",
    "category_id" "uuid",
    "category_name" "text" NOT NULL,
    "cost_centre_id" "uuid",
    "cost_nature" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "amount" numeric(18,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "amount_base" numeric(18,2) NOT NULL,
    "exchange_rate_to_base" numeric(20,8) DEFAULT 1 NOT NULL,
    "exchange_rate_date" "date",
    "exchange_rate_source" "text",
    "due_day" smallint NOT NULL,
    "record_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date",
    "next_run_at" timestamp with time zone,
    "last_recorded_at" timestamp with time zone,
    "last_error" "text",
    "payment_method" "text",
    "reference" "text",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supplier_id" "uuid",
    CONSTRAINT "business_recurring_costs_amount_base_check" CHECK (("amount_base" > (0)::numeric)),
    CONSTRAINT "business_recurring_costs_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "business_recurring_costs_category_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "category_name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "category_name")) <= 100))),
    CONSTRAINT "business_recurring_costs_check" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "business_recurring_costs_cost_nature_check" CHECK (("cost_nature" = ANY (ARRAY['fixed'::"text", 'variable'::"text"]))),
    CONSTRAINT "business_recurring_costs_currency_check" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "business_recurring_costs_due_day_check" CHECK ((("due_day" >= 1) AND ("due_day" <= 31))),
    CONSTRAINT "business_recurring_costs_exchange_rate_to_base_check" CHECK (("exchange_rate_to_base" > (0)::numeric)),
    CONSTRAINT "business_recurring_costs_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 180))),
    CONSTRAINT "business_recurring_costs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."business_recurring_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sale_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid",
    "item_name" "text" NOT NULL,
    "item_sku" "text",
    "quantity" numeric(18,3) NOT NULL,
    "unit_price" numeric(18,2) NOT NULL,
    "line_subtotal" numeric(18,2) NOT NULL,
    "line_subtotal_base" numeric(18,2) NOT NULL,
    "unit_cost_base" numeric(18,4) DEFAULT 0 NOT NULL,
    "cogs_base" numeric(18,2) DEFAULT 0 NOT NULL,
    "gross_profit_base" numeric(18,2) NOT NULL,
    "inventory_movement_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_sale_lines_cogs_base_check" CHECK (("cogs_base" >= (0)::numeric)),
    CONSTRAINT "business_sale_lines_line_subtotal_base_check" CHECK (("line_subtotal_base" >= (0)::numeric)),
    CONSTRAINT "business_sale_lines_line_subtotal_check" CHECK (("line_subtotal" >= (0)::numeric)),
    CONSTRAINT "business_sale_lines_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "business_sale_lines_unit_cost_base_check" CHECK (("unit_cost_base" >= (0)::numeric)),
    CONSTRAINT "business_sale_lines_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."business_sale_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "sale_number" "text" NOT NULL,
    "customer_name" "text",
    "customer_email" "text",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "currency" "text" NOT NULL,
    "exchange_rate_to_base" numeric(20,8) DEFAULT 1 NOT NULL,
    "exchange_rate_date" "date",
    "exchange_rate_source" "text",
    "subtotal" numeric(18,2) NOT NULL,
    "discount" numeric(18,2) DEFAULT 0 NOT NULL,
    "tax" numeric(18,2) DEFAULT 0 NOT NULL,
    "total" numeric(18,2) NOT NULL,
    "subtotal_base" numeric(18,2) NOT NULL,
    "discount_base" numeric(18,2) DEFAULT 0 NOT NULL,
    "tax_base" numeric(18,2) DEFAULT 0 NOT NULL,
    "total_base" numeric(18,2) NOT NULL,
    "net_sales_base" numeric(18,2) NOT NULL,
    "cogs_base" numeric(18,2) DEFAULT 0 NOT NULL,
    "gross_profit_base" numeric(18,2) NOT NULL,
    "line_count" integer DEFAULT 0 NOT NULL,
    "units_sold" numeric(18,3) DEFAULT 0 NOT NULL,
    "sale_date" "date" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "payment_method" "text",
    "reference" "text",
    "notes" "text",
    "transaction_id" "uuid",
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "refunded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "business_sales_cogs_base_check" CHECK (("cogs_base" >= (0)::numeric)),
    CONSTRAINT "business_sales_currency_check" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "business_sales_discount_base_check" CHECK (("discount_base" >= (0)::numeric)),
    CONSTRAINT "business_sales_discount_check" CHECK (("discount" >= (0)::numeric)),
    CONSTRAINT "business_sales_exchange_rate_to_base_check" CHECK (("exchange_rate_to_base" > (0)::numeric)),
    CONSTRAINT "business_sales_line_count_check" CHECK (("line_count" > 0)),
    CONSTRAINT "business_sales_net_sales_base_check" CHECK (("net_sales_base" >= (0)::numeric)),
    CONSTRAINT "business_sales_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'refunded'::"text", 'deleted'::"text"]))),
    CONSTRAINT "business_sales_subtotal_base_check" CHECK (("subtotal_base" >= (0)::numeric)),
    CONSTRAINT "business_sales_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "business_sales_tax_base_check" CHECK (("tax_base" >= (0)::numeric)),
    CONSTRAINT "business_sales_tax_check" CHECK (("tax" >= (0)::numeric)),
    CONSTRAINT "business_sales_total_base_check" CHECK (("total_base" >= (0)::numeric)),
    CONSTRAINT "business_sales_total_check" CHECK (("total" >= (0)::numeric)),
    CONSTRAINT "business_sales_units_sold_check" CHECK (("units_sold" > (0)::numeric))
);


ALTER TABLE "public"."business_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_settings" (
    "business_id" "uuid" NOT NULL,
    "default_timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "date_format" "text" DEFAULT 'DD/MM/YYYY'::"text" NOT NULL,
    "number_format" "text" DEFAULT 'de-DE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_payment_method" "text" DEFAULT 'Card'::"text" NOT NULL,
    "default_payment_terms_days" integer DEFAULT 14 NOT NULL,
    "default_sales_tax_rate" numeric(7,3) DEFAULT 0 NOT NULL,
    "invoice_prefix" "text" DEFAULT 'INV'::"text" NOT NULL,
    "next_invoice_number" bigint DEFAULT 1 NOT NULL,
    "default_low_stock_threshold" numeric(18,3) DEFAULT 0 NOT NULL,
    CONSTRAINT "business_settings_invoice_number_check" CHECK (("next_invoice_number" >= 1)),
    CONSTRAINT "business_settings_low_stock_check" CHECK (("default_low_stock_threshold" >= (0)::numeric)),
    CONSTRAINT "business_settings_payment_terms_check" CHECK ((("default_payment_terms_days" >= 0) AND ("default_payment_terms_days" <= 365))),
    CONSTRAINT "business_settings_sales_tax_check" CHECK ((("default_sales_tax_rate" >= (0)::numeric) AND ("default_sales_tax_rate" <= (100)::numeric)))
);


ALTER TABLE "public"."business_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category_id" "uuid",
    "category_name" "text" NOT NULL,
    "cost_centre_id" "uuid",
    "cost_nature" "text" NOT NULL,
    "amount" numeric(18,2) NOT NULL,
    "currency" "text" NOT NULL,
    "amount_base" numeric(18,2) NOT NULL,
    "exchange_rate_to_base" numeric(20,8) DEFAULT 1 NOT NULL,
    "exchange_rate_date" "date",
    "exchange_rate_source" "text",
    "issue_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "payment_method" "text",
    "transaction_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_supplier_invoices_amount_base_check" CHECK (("amount_base" > (0)::numeric)),
    CONSTRAINT "business_supplier_invoices_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "business_supplier_invoices_cost_nature_check" CHECK (("cost_nature" = ANY (ARRAY['fixed'::"text", 'variable'::"text"]))),
    CONSTRAINT "business_supplier_invoices_currency_check" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "business_supplier_invoices_description_check" CHECK ((("char_length"(TRIM(BOTH FROM "description")) >= 1) AND ("char_length"(TRIM(BOTH FROM "description")) <= 180))),
    CONSTRAINT "business_supplier_invoices_exchange_rate_to_base_check" CHECK (("exchange_rate_to_base" > (0)::numeric)),
    CONSTRAINT "business_supplier_invoices_invoice_number_check" CHECK ((("char_length"(TRIM(BOTH FROM "invoice_number")) >= 1) AND ("char_length"(TRIM(BOTH FROM "invoice_number")) <= 120))),
    CONSTRAINT "business_supplier_invoices_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."business_supplier_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "counterparty" "text",
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "cost_nature" "text",
    "amount" numeric(18,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "amount_base" numeric(18,2) NOT NULL,
    "exchange_rate_to_base" numeric(20,8) DEFAULT 1 NOT NULL,
    "exchange_rate_date" "date",
    "exchange_rate_source" "text",
    "transaction_date" "date" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "payment_method" "text",
    "reference" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cost_category_id" "uuid",
    "cost_centre_id" "uuid",
    "source_recurring_cost_id" "uuid",
    "recurrence_key" "text",
    "supplier_id" "uuid",
    "source_supplier_invoice_id" "uuid",
    "source_inventory_movement_id" "uuid",
    "source_sale_id" "uuid",
    CONSTRAINT "business_transactions_amount_base_check" CHECK (("amount_base" > (0)::numeric)),
    CONSTRAINT "business_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "business_transactions_category_check" CHECK ((("char_length"(TRIM(BOTH FROM "category")) >= 1) AND ("char_length"(TRIM(BOTH FROM "category")) <= 100))),
    CONSTRAINT "business_transactions_cost_nature_check" CHECK ((("cost_nature" IS NULL) OR ("cost_nature" = ANY (ARRAY['fixed'::"text", 'variable'::"text"])))),
    CONSTRAINT "business_transactions_currency_check" CHECK (("char_length"("currency") = 3)),
    CONSTRAINT "business_transactions_description_check" CHECK ((("char_length"(TRIM(BOTH FROM "description")) >= 1) AND ("char_length"(TRIM(BOTH FROM "description")) <= 180))),
    CONSTRAINT "business_transactions_exchange_rate_to_base_check" CHECK (("exchange_rate_to_base" > (0)::numeric)),
    CONSTRAINT "business_transactions_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."business_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_user_preferences" (
    "user_id" "uuid" NOT NULL,
    "active_business_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "legal_name" "text",
    "business_type" "text" DEFAULT 'Sole trader'::"text" NOT NULL,
    "country_code" "text" DEFAULT 'DE'::"text" NOT NULL,
    "base_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "fiscal_year_start_month" smallint DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "archived_at" timestamp with time zone,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "tax_id" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "website" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "postal_code" "text",
    "logo_path" "text",
    "cover_image_path" "text",
    CONSTRAINT "businesses_base_currency_check" CHECK (("char_length"("base_currency") = 3)),
    CONSTRAINT "businesses_country_code_check" CHECK (("char_length"("country_code") = 2)),
    CONSTRAINT "businesses_fiscal_year_start_month_check" CHECK ((("fiscal_year_start_month" >= 1) AND ("fiscal_year_start_month" <= 12))),
    CONSTRAINT "businesses_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 120))),
    CONSTRAINT "businesses_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_card_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "debt_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(16,2) NOT NULL,
    "currency" "text" NOT NULL,
    "amount_eur" numeric(16,2) NOT NULL,
    "exchange_rate_to_eur" numeric(20,10) NOT NULL,
    "balance_effect" numeric(16,2) NOT NULL,
    "balance_effect_eur" numeric(16,2) NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_card_activities_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['purchase'::"text", 'interest'::"text", 'fee'::"text", 'refund'::"text", 'adjustment_increase'::"text", 'adjustment_decrease'::"text", 'statement_adjustment'::"text"]))),
    CONSTRAINT "credit_card_activities_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "credit_card_activities_amount_eur_check" CHECK (("amount_eur" > (0)::numeric)),
    CONSTRAINT "credit_card_activities_balance_effect_check" CHECK (("balance_effect" <> (0)::numeric)),
    CONSTRAINT "credit_card_activities_balance_effect_eur_check" CHECK (("balance_effect_eur" <> (0)::numeric)),
    CONSTRAINT "credit_card_activities_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "credit_card_activities_description_check" CHECK ((("char_length"("btrim"("description")) >= 1) AND ("char_length"("btrim"("description")) <= 140))),
    CONSTRAINT "credit_card_activities_exchange_rate_to_eur_check" CHECK (("exchange_rate_to_eur" > (0)::numeric))
);

ALTER TABLE ONLY "public"."credit_card_activities" REPLICA IDENTITY FULL;


ALTER TABLE "public"."credit_card_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_card_monthly_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "debt_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month_start" "date" NOT NULL,
    "currency" "text" NOT NULL,
    "statement_balance" numeric(16,2) NOT NULL,
    "statement_balance_eur" numeric(16,2) NOT NULL,
    "minimum_payment" numeric(16,2) NOT NULL,
    "minimum_payment_eur" numeric(16,2) NOT NULL,
    "interest_charged" numeric(16,2) DEFAULT 0 NOT NULL,
    "interest_charged_eur" numeric(16,2) DEFAULT 0 NOT NULL,
    "statement_date" "date" NOT NULL,
    "payment_due_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_card_monthly_records_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "credit_card_monthly_records_due_date_check" CHECK (("payment_due_date" >= "statement_date")),
    CONSTRAINT "credit_card_monthly_records_interest_charged_check" CHECK (("interest_charged" >= (0)::numeric)),
    CONSTRAINT "credit_card_monthly_records_interest_charged_eur_check" CHECK (("interest_charged_eur" >= (0)::numeric)),
    CONSTRAINT "credit_card_monthly_records_minimum_check" CHECK (("minimum_payment" <= "statement_balance")),
    CONSTRAINT "credit_card_monthly_records_minimum_eur_check" CHECK (("minimum_payment_eur" <= "statement_balance_eur")),
    CONSTRAINT "credit_card_monthly_records_minimum_payment_check" CHECK (("minimum_payment" >= (0)::numeric)),
    CONSTRAINT "credit_card_monthly_records_minimum_payment_eur_check" CHECK (("minimum_payment_eur" >= (0)::numeric)),
    CONSTRAINT "credit_card_monthly_records_month_start_check" CHECK (("month_start" = ("date_trunc"('month'::"text", ("month_start")::timestamp with time zone))::"date")),
    CONSTRAINT "credit_card_monthly_records_statement_balance_check" CHECK (("statement_balance" >= (0)::numeric)),
    CONSTRAINT "credit_card_monthly_records_statement_balance_eur_check" CHECK (("statement_balance_eur" >= (0)::numeric))
);


ALTER TABLE "public"."credit_card_monthly_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debt_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "debt_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(16,2) NOT NULL,
    "currency" "text" NOT NULL,
    "amount_eur" numeric(16,2) NOT NULL,
    "exchange_rate_to_eur" numeric(20,10) NOT NULL,
    "paid_at" timestamp with time zone NOT NULL,
    "notes" "text",
    "transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "debt_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "debt_payments_amount_eur_check" CHECK (("amount_eur" > (0)::numeric)),
    CONSTRAINT "debt_payments_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "debt_payments_exchange_rate_to_eur_check" CHECK (("exchange_rate_to_eur" > (0)::numeric))
);

ALTER TABLE ONLY "public"."debt_payments" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."debt_payments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."debt_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "lender" "text",
    "description" "text",
    "category" "text" NOT NULL,
    "original_balance" numeric(16,2) NOT NULL,
    "current_balance" numeric(16,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "original_balance_eur" numeric(16,2) NOT NULL,
    "current_balance_eur" numeric(16,2) NOT NULL,
    "exchange_rate_to_eur" numeric(20,10) DEFAULT 1 NOT NULL,
    "annual_interest_rate" numeric(8,4) DEFAULT 0 NOT NULL,
    "minimum_payment" numeric(16,2) DEFAULT 0 NOT NULL,
    "minimum_payment_eur" numeric(16,2) DEFAULT 0 NOT NULL,
    "payment_due_day" integer,
    "start_date" "date",
    "maturity_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "autopay" boolean DEFAULT false NOT NULL,
    "autopay_record_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "autopay_timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "autopay_enabled_at" timestamp with time zone,
    "card_last_four" "text",
    "credit_limit" numeric(16,2),
    "credit_limit_eur" numeric(16,2),
    "statement_balance" numeric(16,2),
    "statement_balance_eur" numeric(16,2),
    "statement_date" "date",
    "payment_due_date" "date",
    "interest_charged" numeric(16,2) DEFAULT 0 NOT NULL,
    "interest_charged_eur" numeric(16,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "debts_annual_interest_rate_check" CHECK (("annual_interest_rate" >= (0)::numeric)),
    CONSTRAINT "debts_card_last_four_check" CHECK ((("card_last_four" IS NULL) OR ("card_last_four" ~ '^[0-9]{4}$'::"text"))),
    CONSTRAINT "debts_credit_limit_check" CHECK ((("credit_limit" IS NULL) OR ("credit_limit" >= (0)::numeric))),
    CONSTRAINT "debts_credit_limit_eur_check" CHECK ((("credit_limit_eur" IS NULL) OR ("credit_limit_eur" >= (0)::numeric))),
    CONSTRAINT "debts_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "debts_current_balance_check" CHECK (("current_balance" >= (0)::numeric)),
    CONSTRAINT "debts_current_balance_eur_check" CHECK (("current_balance_eur" >= (0)::numeric)),
    CONSTRAINT "debts_exchange_rate_to_eur_check" CHECK (("exchange_rate_to_eur" > (0)::numeric)),
    CONSTRAINT "debts_interest_charged_check" CHECK ((("interest_charged" >= (0)::numeric) AND ("interest_charged_eur" >= (0)::numeric))),
    CONSTRAINT "debts_minimum_payment_check" CHECK (("minimum_payment" >= (0)::numeric)),
    CONSTRAINT "debts_minimum_payment_eur_check" CHECK (("minimum_payment_eur" >= (0)::numeric)),
    CONSTRAINT "debts_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 120))),
    CONSTRAINT "debts_original_balance_check" CHECK (("original_balance" >= (0)::numeric)),
    CONSTRAINT "debts_original_balance_eur_check" CHECK (("original_balance_eur" >= (0)::numeric)),
    CONSTRAINT "debts_payment_due_day_check" CHECK ((("payment_due_day" >= 1) AND ("payment_due_day" <= 31))),
    CONSTRAINT "debts_statement_balance_check" CHECK ((("statement_balance" IS NULL) OR ("statement_balance" >= (0)::numeric))),
    CONSTRAINT "debts_statement_balance_eur_check" CHECK ((("statement_balance_eur" IS NULL) OR ("statement_balance_eur" >= (0)::numeric))),
    CONSTRAINT "debts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paid_off'::"text", 'paused'::"text"])))
);

ALTER TABLE ONLY "public"."debts" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."debts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."debts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_upload_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "document_date" "date",
    "notes" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "document_upload_intents_category_check" CHECK (("category" = ANY (ARRAY['bank_statement'::"text", 'payslip'::"text", 'tax_document'::"text", 'invoice_receipt'::"text", 'insurance'::"text", 'contract'::"text", 'loan_document'::"text", 'pension_record'::"text", 'other'::"text"]))),
    CONSTRAINT "document_upload_intents_display_name_check" CHECK ((("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 160))),
    CONSTRAINT "document_upload_intents_mime_type_check" CHECK (("mime_type" = ANY (ARRAY['application/pdf'::"text", 'image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "document_upload_intents_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 1000))),
    CONSTRAINT "document_upload_intents_original_name_check" CHECK ((("char_length"("original_name") >= 1) AND ("char_length"("original_name") <= 255))),
    CONSTRAINT "document_upload_intents_size_bytes_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= 10485760)))
);


ALTER TABLE "public"."document_upload_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "document_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_documents_category_check" CHECK (("category" = ANY (ARRAY['bank_statement'::"text", 'payslip'::"text", 'tax_document'::"text", 'invoice_receipt'::"text", 'insurance'::"text", 'contract'::"text", 'loan_document'::"text", 'pension_record'::"text", 'other'::"text"]))),
    CONSTRAINT "financial_documents_display_name_check" CHECK ((("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 160))),
    CONSTRAINT "financial_documents_mime_type_check" CHECK (("mime_type" = ANY (ARRAY['application/pdf'::"text", 'image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "financial_documents_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 1000))),
    CONSTRAINT "financial_documents_original_name_check" CHECK ((("char_length"("original_name") >= 1) AND ("char_length"("original_name") <= 255))),
    CONSTRAINT "financial_documents_size_bytes_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= 10485760)))
);


ALTER TABLE "public"."financial_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_independence_settings" (
    "user_id" "uuid" NOT NULL,
    "target_monthly_spending" numeric(14,2),
    "withdrawal_rate" numeric(5,2) DEFAULT 4.00 NOT NULL,
    "annual_real_return_rate" numeric(5,2) DEFAULT 4.00 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "financial_independence_real_return_rate_check" CHECK ((("annual_real_return_rate" >= '-2.00'::numeric) AND ("annual_real_return_rate" <= 12.00))),
    CONSTRAINT "financial_independence_target_spending_check" CHECK ((("target_monthly_spending" IS NULL) OR ("target_monthly_spending" > (0)::numeric))),
    CONSTRAINT "financial_independence_withdrawal_rate_check" CHECK ((("withdrawal_rate" >= 2.00) AND ("withdrawal_rate" <= 8.00)))
);


ALTER TABLE "public"."financial_independence_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_independence_settings" IS 'Private per-user Financial Independence planning assumptions protected by RLS.';



CREATE TABLE IF NOT EXISTS "public"."goal_investments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "invested_at" timestamp with time zone NOT NULL,
    "notes" "text",
    "transaction_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_investments_amount_check" CHECK (("amount" > (0)::numeric))
);

ALTER TABLE ONLY "public"."goal_investments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."goal_investments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target_amount" numeric(14,2) NOT NULL,
    "current_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "target_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goals_current_amount_check" CHECK (("current_amount" >= (0)::numeric)),
    CONSTRAINT "goals_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 120))),
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'paused'::"text"]))),
    CONSTRAINT "goals_target_amount_check" CHECK (("target_amount" > (0)::numeric))
);

ALTER TABLE ONLY "public"."goals" REPLICA IDENTITY FULL;


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."money_entry_preferences" (
    "user_id" "uuid" NOT NULL,
    "entry_mode" "text" DEFAULT 'guided'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "money_entry_preferences_entry_mode_check" CHECK (("entry_mode" = ANY (ARRAY['simple'::"text", 'guided'::"text", 'detailed'::"text"])))
);


ALTER TABLE "public"."money_entry_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_budget_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month" "text" NOT NULL,
    "section" "text" NOT NULL,
    "label" "text" NOT NULL,
    "planned_amount" numeric(14,2) NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "monthly_budget_items_label_check" CHECK ((("char_length"("label") >= 1) AND ("char_length"("label") <= 120))),
    CONSTRAINT "monthly_budget_items_month_check" CHECK (("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::"text")),
    CONSTRAINT "monthly_budget_items_planned_amount_check" CHECK (("planned_amount" >= (0)::numeric)),
    CONSTRAINT "monthly_budget_items_section_check" CHECK (("section" = ANY (ARRAY['income'::"text", 'bills'::"text", 'expenses'::"text", 'savings'::"text", 'debt'::"text"])))
);

ALTER TABLE ONLY "public"."monthly_budget_items" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."monthly_budget_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_budget_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_budget_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month" "text" NOT NULL,
    "start_balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "monthly_budget_plans_month_check" CHECK (("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::"text"))
);

ALTER TABLE ONLY "public"."monthly_budget_plans" REPLICA IDENTITY FULL;

ALTER TABLE ONLY "public"."monthly_budget_plans" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_budget_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_usage_daily" (
    "user_id" "uuid" NOT NULL,
    "usage_date" "date" NOT NULL,
    "workspace" "text" NOT NULL,
    "active_seconds" bigint DEFAULT 0 NOT NULL,
    "sessions_count" integer DEFAULT 0 NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_usage_daily_active_seconds_check" CHECK (("active_seconds" >= 0)),
    CONSTRAINT "platform_usage_daily_sessions_count_check" CHECK (("sessions_count" >= 0)),
    CONSTRAINT "platform_usage_daily_workspace_check" CHECK (("workspace" = ANY (ARRAY['personal'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."platform_usage_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_usage_presence" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace" "text" NOT NULL,
    "module" "text" NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_usage_presence_module_check" CHECK ((("char_length"(TRIM(BOTH FROM "module")) >= 1) AND ("char_length"(TRIM(BOTH FROM "module")) <= 120))),
    CONSTRAINT "platform_usage_presence_workspace_check" CHECK (("workspace" = ANY (ARRAY['personal'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."platform_usage_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statement_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "requested_count" integer DEFAULT 0 NOT NULL,
    "imported_count" integer DEFAULT 0 NOT NULL,
    "skipped_duplicate_count" integer DEFAULT 0 NOT NULL,
    "skipped_invalid_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "statement_import_batches_file_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "file_name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "file_name")) <= 255))),
    CONSTRAINT "statement_import_batches_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."statement_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statement_import_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "fingerprint" "text" NOT NULL,
    "source_row_number" integer NOT NULL,
    "source_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "statement_import_items_source_row_number_check" CHECK (("source_row_number" > 0))
);


ALTER TABLE "public"."statement_import_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statement_import_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "delimiter" "text" DEFAULT ','::"text" NOT NULL,
    "mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "statement_import_profiles_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 80)))
);


ALTER TABLE "public"."statement_import_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "sender_role" "text" NOT NULL,
    "body" "text" NOT NULL,
    "internal_note" boolean DEFAULT false NOT NULL,
    "is_initial" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_messages_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 5000))),
    CONSTRAINT "support_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['customer'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contact_email" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "handled_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_last_read_at" timestamp with time zone,
    "admin_last_read_at" timestamp with time zone,
    CONSTRAINT "support_requests_category_check" CHECK (("category" = ANY (ARRAY['technical_issue'::"text", 'account_access'::"text", 'privacy_data'::"text", 'feature_request'::"text", 'billing_subscription'::"text", 'other'::"text"]))),
    CONSTRAINT "support_requests_contact_email_check" CHECK ((("char_length"("contact_email") >= 3) AND ("char_length"("contact_email") <= 254))),
    CONSTRAINT "support_requests_message_check" CHECK ((("char_length"("message") >= 20) AND ("char_length"("message") <= 5000))),
    CONSTRAINT "support_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text"]))),
    CONSTRAINT "support_requests_subject_check" CHECK ((("char_length"("subject") >= 3) AND ("char_length"("subject") <= 120)))
);


ALTER TABLE "public"."support_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."support_requests" IS 'Private authenticated customer concerns submitted through the FICONTER Contact Us window.';



COMMENT ON COLUMN "public"."support_requests"."contact_email" IS 'Customer-selected reply address. Never used as an authentication authority.';



COMMENT ON COLUMN "public"."support_requests"."handled_by" IS 'Administrator who last changed the support status through a protected server route.';



CREATE TABLE IF NOT EXISTS "public"."transaction_category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "match_text" "text" NOT NULL,
    "category" "text" NOT NULL,
    "transaction_type" "text" DEFAULT 'any'::"text" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transaction_category_rules_category_check" CHECK ((("char_length"(TRIM(BOTH FROM "category")) >= 1) AND ("char_length"(TRIM(BOTH FROM "category")) <= 120))),
    CONSTRAINT "transaction_category_rules_match_text_check" CHECK ((("char_length"(TRIM(BOTH FROM "match_text")) >= 2) AND ("char_length"(TRIM(BOTH FROM "match_text")) <= 80))),
    CONSTRAINT "transaction_category_rules_priority_check" CHECK ((("priority" >= '-1000'::integer) AND ("priority" <= 1000))),
    CONSTRAINT "transaction_category_rules_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['any'::"text", 'income'::"text", 'expense'::"text", 'saving'::"text"])))
);


ALTER TABLE "public"."transaction_category_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_template_postings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_key" "date" NOT NULL,
    "transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transaction_template_postings_period_key_check" CHECK (("period_key" = ("date_trunc"('month'::"text", ("period_key")::timestamp with time zone))::"date"))
);


ALTER TABLE "public"."transaction_template_postings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "amount_eur" numeric(18,6),
    "exchange_rate_to_eur" numeric(20,10),
    "exchange_rate_date" "date",
    "exchange_rate_source" "text",
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "is_favorite" boolean DEFAULT true NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "day_of_month" smallint,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transaction_templates_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transaction_templates_category_check" CHECK ((("char_length"("btrim"("category")) >= 1) AND ("char_length"("btrim"("category")) <= 100))),
    CONSTRAINT "transaction_templates_check" CHECK (((NOT "is_recurring") OR ("day_of_month" IS NOT NULL))),
    CONSTRAINT "transaction_templates_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "transaction_templates_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "transaction_templates_description_check" CHECK ((("char_length"("btrim"("description")) >= 1) AND ("char_length"("btrim"("description")) <= 120))),
    CONSTRAINT "transaction_templates_label_check" CHECK ((("char_length"("btrim"("label")) >= 1) AND ("char_length"("btrim"("label")) <= 80))),
    CONSTRAINT "transaction_templates_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'saving'::"text"])))
);


ALTER TABLE "public"."transaction_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "href" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_notifications_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 500))),
    CONSTRAINT "user_notifications_kind_check" CHECK (("kind" = ANY (ARRAY['support_reply'::"text", 'support_status'::"text", 'document_uploaded'::"text", 'document_deleted'::"text", 'system'::"text"]))),
    CONSTRAINT "user_notifications_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120)))
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."ai_insight_preferences"
    ADD CONSTRAINT "ai_insight_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."ai_insight_snapshots"
    ADD CONSTRAINT "ai_insight_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automatic_payment_runs"
    ADD CONSTRAINT "automatic_payment_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automatic_payment_runs"
    ADD CONSTRAINT "automatic_payment_runs_source_type_source_id_occurrence_key_key" UNIQUE ("source_type", "source_id", "occurrence_key");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_audit_log"
    ADD CONSTRAINT "business_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_cost_budgets"
    ADD CONSTRAINT "business_cost_budgets_business_id_category_id_budget_month_key" UNIQUE ("business_id", "category_id", "budget_month");



ALTER TABLE ONLY "public"."business_cost_budgets"
    ADD CONSTRAINT "business_cost_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_cost_categories"
    ADD CONSTRAINT "business_cost_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_cost_centres"
    ADD CONSTRAINT "business_cost_centres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_documents"
    ADD CONSTRAINT "business_documents_file_path_key" UNIQUE ("file_path");



ALTER TABLE ONLY "public"."business_documents"
    ADD CONSTRAINT "business_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_inventory_categories"
    ADD CONSTRAINT "business_inventory_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_inventory_items"
    ADD CONSTRAINT "business_inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_inventory_locations"
    ADD CONSTRAINT "business_inventory_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_inventory_movements"
    ADD CONSTRAINT "business_inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_user_id_key" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_recurring_costs"
    ADD CONSTRAINT "business_recurring_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sale_lines"
    ADD CONSTRAINT "business_sale_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_sales"
    ADD CONSTRAINT "business_sales_business_id_sale_number_key" UNIQUE ("business_id", "sale_number");



ALTER TABLE ONLY "public"."business_sales"
    ADD CONSTRAINT "business_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_business_id_supplier_id_invoice__key" UNIQUE ("business_id", "supplier_id", "invoice_number");



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_suppliers"
    ADD CONSTRAINT "business_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_user_preferences"
    ADD CONSTRAINT "business_user_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_card_activities"
    ADD CONSTRAINT "credit_card_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_card_monthly_records"
    ADD CONSTRAINT "credit_card_monthly_records_debt_month_key" UNIQUE ("debt_id", "month_start");



ALTER TABLE ONLY "public"."credit_card_monthly_records"
    ADD CONSTRAINT "credit_card_monthly_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_upload_intents"
    ADD CONSTRAINT "document_upload_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_upload_intents"
    ADD CONSTRAINT "document_upload_intents_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."financial_independence_settings"
    ADD CONSTRAINT "financial_independence_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."goal_investments"
    ADD CONSTRAINT "goal_investments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_investments"
    ADD CONSTRAINT "goal_investments_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."money_entry_preferences"
    ADD CONSTRAINT "money_entry_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."monthly_budget_items"
    ADD CONSTRAINT "monthly_budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_budget_plans"
    ADD CONSTRAINT "monthly_budget_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_budget_plans"
    ADD CONSTRAINT "monthly_budget_plans_user_id_month_key" UNIQUE ("user_id", "month");



ALTER TABLE ONLY "public"."platform_usage_daily"
    ADD CONSTRAINT "platform_usage_daily_pkey" PRIMARY KEY ("user_id", "usage_date", "workspace");



ALTER TABLE ONLY "public"."platform_usage_presence"
    ADD CONSTRAINT "platform_usage_presence_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_import_batches"
    ADD CONSTRAINT "statement_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_import_items"
    ADD CONSTRAINT "statement_import_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_import_items"
    ADD CONSTRAINT "statement_import_items_user_id_fingerprint_key" UNIQUE ("user_id", "fingerprint");



ALTER TABLE ONLY "public"."statement_import_profiles"
    ADD CONSTRAINT "statement_import_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_import_profiles"
    ADD CONSTRAINT "statement_import_profiles_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_category_rules"
    ADD CONSTRAINT "transaction_category_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_category_rules"
    ADD CONSTRAINT "transaction_category_rules_user_id_match_text_transaction_t_key" UNIQUE ("user_id", "match_text", "transaction_type");



ALTER TABLE ONLY "public"."transaction_template_postings"
    ADD CONSTRAINT "transaction_template_postings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_template_postings"
    ADD CONSTRAINT "transaction_template_postings_template_id_period_key_key" UNIQUE ("template_id", "period_key");



ALTER TABLE ONLY "public"."transaction_templates"
    ADD CONSTRAINT "transaction_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_audit_logs_admin_user_idx" ON "public"."admin_audit_logs" USING "btree" ("admin_user_id", "created_at" DESC);



CREATE INDEX "admin_audit_logs_created_at_idx" ON "public"."admin_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_audit_logs_target_user_idx" ON "public"."admin_audit_logs" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "admin_users_role_idx" ON "public"."admin_users" USING "btree" ("role", "created_at");



CREATE INDEX "ai_insight_snapshots_user_fingerprint_idx" ON "public"."ai_insight_snapshots" USING "btree" ("user_id", "data_fingerprint", "generated_at" DESC);



CREATE INDEX "ai_insight_snapshots_user_generated_idx" ON "public"."ai_insight_snapshots" USING "btree" ("user_id", "generated_at" DESC);



CREATE INDEX "automatic_payment_runs_user_processed_idx" ON "public"."automatic_payment_runs" USING "btree" ("user_id", "processed_at" DESC);



CREATE INDEX "bills_automatic_schedule_idx" ON "public"."bills" USING "btree" ("autopay", "status", "due_date") WHERE (("autopay" = true) AND ("autopay_enabled_at" IS NOT NULL));



CREATE UNIQUE INDEX "bills_unique_linked_transaction_idx" ON "public"."bills" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "bills_user_due_date_idx" ON "public"."bills" USING "btree" ("user_id", "due_date");



CREATE INDEX "bills_user_status_idx" ON "public"."bills" USING "btree" ("user_id", "status");



CREATE INDEX "business_audit_log_business_entity_idx" ON "public"."business_audit_log" USING "btree" ("business_id", "entity_type", "occurred_at" DESC);



CREATE INDEX "business_audit_log_business_time_idx" ON "public"."business_audit_log" USING "btree" ("business_id", "occurred_at" DESC);



CREATE INDEX "business_cost_budgets_month_idx" ON "public"."business_cost_budgets" USING "btree" ("business_id", "budget_month", "category_id");



CREATE INDEX "business_cost_categories_business_idx" ON "public"."business_cost_categories" USING "btree" ("business_id", "is_active", "name");



CREATE UNIQUE INDEX "business_cost_categories_name_unique" ON "public"."business_cost_categories" USING "btree" ("business_id", "lower"("name"));



CREATE INDEX "business_cost_centres_business_idx" ON "public"."business_cost_centres" USING "btree" ("business_id", "is_active", "name");



CREATE UNIQUE INDEX "business_cost_centres_name_unique" ON "public"."business_cost_centres" USING "btree" ("business_id", "lower"("name"));



CREATE INDEX "business_documents_business_category_idx" ON "public"."business_documents" USING "btree" ("business_id", "category", "created_at" DESC);



CREATE INDEX "business_documents_business_created_idx" ON "public"."business_documents" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "business_documents_business_expiry_idx" ON "public"."business_documents" USING "btree" ("business_id", "expires_on") WHERE ("expires_on" IS NOT NULL);



CREATE UNIQUE INDEX "business_inventory_categories_name_unique" ON "public"."business_inventory_categories" USING "btree" ("business_id", "lower"("name"));



CREATE INDEX "business_inventory_items_filters_idx" ON "public"."business_inventory_items" USING "btree" ("business_id", "status", "category_id", "location_id");



CREATE UNIQUE INDEX "business_inventory_items_sku_unique" ON "public"."business_inventory_items" USING "btree" ("business_id", "lower"("sku"));



CREATE UNIQUE INDEX "business_inventory_locations_name_unique" ON "public"."business_inventory_locations" USING "btree" ("business_id", "lower"("name"));



CREATE INDEX "business_inventory_movements_business_idx" ON "public"."business_inventory_movements" USING "btree" ("business_id", "movement_date" DESC, "movement_type");



CREATE INDEX "business_inventory_movements_item_idx" ON "public"."business_inventory_movements" USING "btree" ("item_id", "occurred_at" DESC);



CREATE UNIQUE INDEX "business_inventory_movements_reversal_unique" ON "public"."business_inventory_movements" USING "btree" ("reversal_of_id") WHERE ("reversal_of_id" IS NOT NULL);



CREATE UNIQUE INDEX "business_inventory_movements_transaction_unique" ON "public"."business_inventory_movements" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "business_members_business_id_idx" ON "public"."business_members" USING "btree" ("business_id", "status");



CREATE INDEX "business_members_user_id_idx" ON "public"."business_members" USING "btree" ("user_id", "status");



CREATE INDEX "business_recurring_costs_due_idx" ON "public"."business_recurring_costs" USING "btree" ("status", "next_run_at") WHERE ("status" = 'active'::"text");



CREATE INDEX "business_sale_lines_inventory_idx" ON "public"."business_sale_lines" USING "btree" ("inventory_item_id") WHERE ("inventory_item_id" IS NOT NULL);



CREATE INDEX "business_sale_lines_sale_idx" ON "public"."business_sale_lines" USING "btree" ("sale_id");



CREATE INDEX "business_sales_business_date_idx" ON "public"."business_sales" USING "btree" ("business_id", "status", "sale_date" DESC);



CREATE INDEX "business_supplier_invoices_business_due_idx" ON "public"."business_supplier_invoices" USING "btree" ("business_id", "status", "due_date");



CREATE INDEX "business_supplier_invoices_supplier_idx" ON "public"."business_supplier_invoices" USING "btree" ("supplier_id", "due_date" DESC);



CREATE INDEX "business_suppliers_business_name_idx" ON "public"."business_suppliers" USING "btree" ("business_id", "name");



CREATE INDEX "business_suppliers_business_status_idx" ON "public"."business_suppliers" USING "btree" ("business_id", "status", "category");



CREATE INDEX "business_transactions_business_date_idx" ON "public"."business_transactions" USING "btree" ("business_id", "transaction_date" DESC);



CREATE INDEX "business_transactions_business_occurred_idx" ON "public"."business_transactions" USING "btree" ("business_id", "occurred_at" DESC);



CREATE INDEX "business_transactions_business_type_idx" ON "public"."business_transactions" USING "btree" ("business_id", "type", "transaction_date" DESC);



CREATE INDEX "business_transactions_cost_control_idx" ON "public"."business_transactions" USING "btree" ("business_id", "transaction_date" DESC, "cost_category_id", "cost_centre_id") WHERE ("type" = 'expense'::"text");



CREATE UNIQUE INDEX "business_transactions_inventory_movement_unique" ON "public"."business_transactions" USING "btree" ("source_inventory_movement_id") WHERE ("source_inventory_movement_id" IS NOT NULL);



CREATE UNIQUE INDEX "business_transactions_recurring_cycle_unique" ON "public"."business_transactions" USING "btree" ("source_recurring_cost_id", "recurrence_key") WHERE (("source_recurring_cost_id" IS NOT NULL) AND ("recurrence_key" IS NOT NULL));



CREATE UNIQUE INDEX "business_transactions_sale_unique" ON "public"."business_transactions" USING "btree" ("source_sale_id") WHERE ("source_sale_id" IS NOT NULL);



CREATE INDEX "business_transactions_supplier_idx" ON "public"."business_transactions" USING "btree" ("business_id", "supplier_id", "transaction_date" DESC);



CREATE UNIQUE INDEX "business_transactions_supplier_invoice_unique" ON "public"."business_transactions" USING "btree" ("source_supplier_invoice_id") WHERE ("source_supplier_invoice_id" IS NOT NULL);



CREATE INDEX "business_user_preferences_active_idx" ON "public"."business_user_preferences" USING "btree" ("active_business_id");



CREATE INDEX "businesses_owner_id_idx" ON "public"."businesses" USING "btree" ("owner_id");



CREATE INDEX "businesses_owner_status_idx" ON "public"."businesses" USING "btree" ("owner_id", "status", "created_at");



CREATE INDEX "credit_card_activities_debt_date_idx" ON "public"."credit_card_activities" USING "btree" ("debt_id", "occurred_at" DESC);



CREATE INDEX "credit_card_activities_user_date_idx" ON "public"."credit_card_activities" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "credit_card_monthly_records_debt_month_idx" ON "public"."credit_card_monthly_records" USING "btree" ("debt_id", "month_start" DESC);



CREATE INDEX "credit_card_monthly_records_user_month_idx" ON "public"."credit_card_monthly_records" USING "btree" ("user_id", "month_start" DESC);



CREATE INDEX "debt_payments_debt_idx" ON "public"."debt_payments" USING "btree" ("debt_id", "paid_at" DESC);



CREATE INDEX "debt_payments_transaction_id_idx" ON "public"."debt_payments" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE UNIQUE INDEX "debt_payments_unique_linked_transaction_idx" ON "public"."debt_payments" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "debt_payments_user_paid_idx" ON "public"."debt_payments" USING "btree" ("user_id", "paid_at" DESC);



CREATE INDEX "debts_automatic_schedule_idx" ON "public"."debts" USING "btree" ("autopay", "status", "payment_due_day") WHERE (("autopay" = true) AND ("autopay_enabled_at" IS NOT NULL));



CREATE INDEX "debts_user_credit_cards_idx" ON "public"."debts" USING "btree" ("user_id", "current_balance_eur" DESC) WHERE ("lower"("category") = 'credit card'::"text");



CREATE INDEX "debts_user_status_idx" ON "public"."debts" USING "btree" ("user_id", "status");



CREATE INDEX "document_upload_intents_user_created_idx" ON "public"."document_upload_intents" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "financial_documents_user_category_idx" ON "public"."financial_documents" USING "btree" ("user_id", "category", "document_date" DESC);



CREATE INDEX "financial_documents_user_created_idx" ON "public"."financial_documents" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "goal_investments_goal_date_idx" ON "public"."goal_investments" USING "btree" ("goal_id", "invested_at" DESC);



CREATE INDEX "goal_investments_goal_idx" ON "public"."goal_investments" USING "btree" ("goal_id", "invested_at" DESC);



CREATE UNIQUE INDEX "goal_investments_transaction_uidx" ON "public"."goal_investments" USING "btree" ("transaction_id");



CREATE INDEX "goal_investments_user_date_idx" ON "public"."goal_investments" USING "btree" ("user_id", "invested_at" DESC);



CREATE INDEX "goals_user_id_idx" ON "public"."goals" USING "btree" ("user_id");



CREATE INDEX "goals_user_status_idx" ON "public"."goals" USING "btree" ("user_id", "status", "created_at");



CREATE INDEX "monthly_budget_items_user_month_idx" ON "public"."monthly_budget_items" USING "btree" ("user_id", "month");



CREATE INDEX "platform_usage_daily_date_workspace_idx" ON "public"."platform_usage_daily" USING "btree" ("usage_date", "workspace");



CREATE INDEX "platform_usage_daily_user_date_idx" ON "public"."platform_usage_daily" USING "btree" ("user_id", "usage_date" DESC);



CREATE INDEX "platform_usage_presence_live_idx" ON "public"."platform_usage_presence" USING "btree" ("workspace", "is_visible", "last_seen_at" DESC);



CREATE INDEX "platform_usage_presence_user_seen_idx" ON "public"."platform_usage_presence" USING "btree" ("user_id", "last_seen_at" DESC);



CREATE INDEX "statement_import_batches_user_idx" ON "public"."statement_import_batches" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "statement_import_items_batch_idx" ON "public"."statement_import_items" USING "btree" ("batch_id", "source_row_number");



CREATE INDEX "statement_import_items_transaction_idx" ON "public"."statement_import_items" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "statement_import_profiles_user_idx" ON "public"."statement_import_profiles" USING "btree" ("user_id", "updated_at" DESC);



CREATE UNIQUE INDEX "support_messages_one_initial_idx" ON "public"."support_messages" USING "btree" ("request_id") WHERE "is_initial";



CREATE INDEX "support_messages_request_created_idx" ON "public"."support_messages" USING "btree" ("request_id", "created_at");



CREATE INDEX "support_requests_status_created_idx" ON "public"."support_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "support_requests_user_created_idx" ON "public"."support_requests" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "transaction_category_rules_user_idx" ON "public"."transaction_category_rules" USING "btree" ("user_id", "priority" DESC, "updated_at" DESC);



CREATE INDEX "transaction_template_postings_user_period_idx" ON "public"."transaction_template_postings" USING "btree" ("user_id", "period_key" DESC);



CREATE INDEX "transaction_templates_user_active_idx" ON "public"."transaction_templates" USING "btree" ("user_id", "is_active", "updated_at" DESC);



CREATE INDEX "transactions_user_currency_date_idx" ON "public"."transactions" USING "btree" ("user_id", "currency", "transaction_date" DESC);



CREATE INDEX "transactions_user_date_idx" ON "public"."transactions" USING "btree" ("user_id", "transaction_date" DESC);



CREATE INDEX "transactions_user_occurred_at_idx" ON "public"."transactions" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "user_notifications_support_request_idx" ON "public"."user_notifications" USING "btree" ("user_id", (("metadata" ->> 'request_id'::"text"))) WHERE ("metadata" ? 'request_id'::"text");



CREATE INDEX "user_notifications_unread_idx" ON "public"."user_notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("read_at" IS NULL);



CREATE INDEX "user_notifications_user_created_idx" ON "public"."user_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "business_audit_business_cost_categories" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_cost_categories" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_cost_centres" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_cost_centres" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_documents" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_documents" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_document_audit"();



CREATE OR REPLACE TRIGGER "business_audit_business_inventory_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_inventory_movements" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_sales" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_sales" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_settings" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_settings" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_supplier_invoices" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_suppliers" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_business_transactions" AFTER INSERT OR DELETE OR UPDATE ON "public"."business_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_audit_businesses" AFTER INSERT OR UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."business_capture_audit_change"();



CREATE OR REPLACE TRIGGER "business_cost_budget_before_write" BEFORE INSERT OR UPDATE ON "public"."business_cost_budgets" FOR EACH ROW EXECUTE FUNCTION "public"."business_cost_budget_before_write"();



CREATE OR REPLACE TRIGGER "business_cost_budgets_touch_updated_at" BEFORE UPDATE ON "public"."business_cost_budgets" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_cost_categories_touch_updated_at" BEFORE UPDATE ON "public"."business_cost_categories" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_cost_category_after_update" AFTER UPDATE ON "public"."business_cost_categories" FOR EACH ROW EXECUTE FUNCTION "public"."business_cost_category_after_update"();



CREATE OR REPLACE TRIGGER "business_cost_centres_touch_updated_at" BEFORE UPDATE ON "public"."business_cost_centres" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_documents_touch_updated_at" BEFORE UPDATE ON "public"."business_documents" FOR EACH ROW EXECUTE FUNCTION "public"."business_documents_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_inventory_categories_before_write" BEFORE INSERT OR UPDATE ON "public"."business_inventory_categories" FOR EACH ROW EXECUTE FUNCTION "public"."business_inventory_master_before_write"();



CREATE OR REPLACE TRIGGER "business_inventory_item_before_write" BEFORE INSERT OR UPDATE ON "public"."business_inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."business_inventory_item_before_write"();



CREATE OR REPLACE TRIGGER "business_inventory_locations_before_write" BEFORE INSERT OR UPDATE ON "public"."business_inventory_locations" FOR EACH ROW EXECUTE FUNCTION "public"."business_inventory_master_before_write"();



CREATE OR REPLACE TRIGGER "business_inventory_seed_after_business" AFTER INSERT ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."business_inventory_seed_after_business"();



CREATE OR REPLACE TRIGGER "business_members_touch_updated_at" BEFORE UPDATE ON "public"."business_members" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_recurring_cost_before_write" BEFORE INSERT OR UPDATE ON "public"."business_recurring_costs" FOR EACH ROW EXECUTE FUNCTION "public"."business_recurring_cost_before_write"();



CREATE OR REPLACE TRIGGER "business_recurring_costs_touch_updated_at" BEFORE UPDATE ON "public"."business_recurring_costs" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_sale_before_write" BEFORE INSERT OR UPDATE ON "public"."business_sales" FOR EACH ROW EXECUTE FUNCTION "public"."business_sale_before_write"();



CREATE OR REPLACE TRIGGER "business_seed_cost_control_after_insert" AFTER INSERT ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."business_seed_cost_control_after_insert"();



CREATE OR REPLACE TRIGGER "business_settings_touch_updated_at" BEFORE UPDATE ON "public"."business_settings" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_supplier_before_write" BEFORE INSERT OR UPDATE ON "public"."business_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."business_supplier_before_write"();



CREATE OR REPLACE TRIGGER "business_supplier_invoice_before_write" BEFORE INSERT OR UPDATE ON "public"."business_supplier_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."business_supplier_invoice_before_write"();



CREATE OR REPLACE TRIGGER "business_transaction_before_write" BEFORE INSERT OR UPDATE ON "public"."business_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."business_transaction_before_write"();



CREATE OR REPLACE TRIGGER "business_transactions_touch_updated_at" BEFORE UPDATE ON "public"."business_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "business_user_preferences_touch_updated_at" BEFORE UPDATE ON "public"."business_user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."business_user_preference_touch_updated_at"();



CREATE OR REPLACE TRIGGER "businesses_touch_updated_at" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."business_touch_updated_at"();



CREATE OR REPLACE TRIGGER "debts_credit_card_minimum_payment_3_percent" BEFORE INSERT OR UPDATE OF "category", "statement_balance", "statement_balance_eur" ON "public"."debts" FOR EACH ROW EXECUTE FUNCTION "public"."credit_card_minimum_payment_3_percent"();



CREATE OR REPLACE TRIGGER "debts_manual_payment_confirmation" BEFORE INSERT OR UPDATE OF "category", "autopay", "autopay_enabled_at" ON "public"."debts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_manual_debt_payment_confirmation"();



CREATE OR REPLACE TRIGGER "debts_sync_credit_card_monthly_record" AFTER INSERT OR UPDATE OF "category", "currency", "statement_balance", "statement_balance_eur", "minimum_payment", "minimum_payment_eur", "interest_charged", "interest_charged_eur", "statement_date", "payment_due_date" ON "public"."debts" FOR EACH ROW EXECUTE FUNCTION "public"."sync_credit_card_monthly_record"();



CREATE OR REPLACE TRIGGER "financial_documents_set_updated_at" BEFORE UPDATE ON "public"."financial_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_financial_document_updated_at"();



CREATE OR REPLACE TRIGGER "money_entry_preferences_touch_updated_at" BEFORE UPDATE ON "public"."money_entry_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."touch_effortless_entry_updated_at"();



CREATE OR REPLACE TRIGGER "restore_debt_before_transaction_delete_trigger" BEFORE DELETE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."restore_debt_before_transaction_delete"();



CREATE OR REPLACE TRIGGER "set_admin_user_updated_at" BEFORE UPDATE ON "public"."admin_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_user_updated_at"();



CREATE OR REPLACE TRIGGER "statement_import_profiles_touch_updated_at" BEFORE UPDATE ON "public"."statement_import_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_statement_import_updated_at"();



CREATE OR REPLACE TRIGGER "support_messages_touch_request" AFTER INSERT ON "public"."support_messages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_support_request_from_message"();



CREATE OR REPLACE TRIGGER "support_requests_cleanup_notifications" BEFORE DELETE ON "public"."support_requests" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_support_request_notifications"();



CREATE OR REPLACE TRIGGER "support_requests_set_updated_at" BEFORE UPDATE ON "public"."support_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_support_request_updated_at"();



CREATE OR REPLACE TRIGGER "transaction_category_rules_touch_updated_at" BEFORE UPDATE ON "public"."transaction_category_rules" FOR EACH ROW EXECUTE FUNCTION "public"."touch_statement_import_updated_at"();



CREATE OR REPLACE TRIGGER "transaction_templates_touch_updated_at" BEFORE UPDATE ON "public"."transaction_templates" FOR EACH ROW EXECUTE FUNCTION "public"."touch_effortless_entry_updated_at"();



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_insight_preferences"
    ADD CONSTRAINT "ai_insight_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_insight_snapshots"
    ADD CONSTRAINT "ai_insight_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automatic_payment_runs"
    ADD CONSTRAINT "automatic_payment_runs_debt_payment_id_fkey" FOREIGN KEY ("debt_payment_id") REFERENCES "public"."debt_payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automatic_payment_runs"
    ADD CONSTRAINT "automatic_payment_runs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automatic_payment_runs"
    ADD CONSTRAINT "automatic_payment_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_audit_log"
    ADD CONSTRAINT "business_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_audit_log"
    ADD CONSTRAINT "business_audit_log_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_cost_budgets"
    ADD CONSTRAINT "business_cost_budgets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_cost_budgets"
    ADD CONSTRAINT "business_cost_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."business_cost_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_cost_categories"
    ADD CONSTRAINT "business_cost_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_cost_centres"
    ADD CONSTRAINT "business_cost_centres_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_documents"
    ADD CONSTRAINT "business_documents_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_documents"
    ADD CONSTRAINT "business_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_inventory_categories"
    ADD CONSTRAINT "business_inventory_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_inventory_items"
    ADD CONSTRAINT "business_inventory_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_inventory_items"
    ADD CONSTRAINT "business_inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."business_inventory_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_inventory_items"
    ADD CONSTRAINT "business_inventory_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_inventory_items"
    ADD CONSTRAINT "business_inventory_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."business_inventory_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_inventory_items"
    ADD CONSTRAINT "business_inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."business_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_inventory_locations"
    ADD CONSTRAINT "business_inventory_locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_inventory_movements"
    ADD CONSTRAINT "business_inventory_movements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_inventory_movements"
    ADD CONSTRAINT "business_inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_inventory_movements"
    ADD CONSTRAINT "business_inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."business_inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_inventory_movements"
    ADD CONSTRAINT "business_inventory_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."business_inventory_movements"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_inventory_movements"
    ADD CONSTRAINT "business_inventory_movements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."business_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_inventory_movements"
    ADD CONSTRAINT "business_inventory_movements_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_recurring_costs"
    ADD CONSTRAINT "business_recurring_costs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_recurring_costs"
    ADD CONSTRAINT "business_recurring_costs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."business_cost_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_recurring_costs"
    ADD CONSTRAINT "business_recurring_costs_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."business_cost_centres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_recurring_costs"
    ADD CONSTRAINT "business_recurring_costs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_recurring_costs"
    ADD CONSTRAINT "business_recurring_costs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."business_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_sale_lines"
    ADD CONSTRAINT "business_sale_lines_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sale_lines"
    ADD CONSTRAINT "business_sale_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."business_inventory_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_sale_lines"
    ADD CONSTRAINT "business_sale_lines_inventory_movement_id_fkey" FOREIGN KEY ("inventory_movement_id") REFERENCES "public"."business_inventory_movements"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_sale_lines"
    ADD CONSTRAINT "business_sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."business_sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sales"
    ADD CONSTRAINT "business_sales_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_sales"
    ADD CONSTRAINT "business_sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_sales"
    ADD CONSTRAINT "business_sales_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_settings"
    ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."business_cost_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."business_cost_centres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."business_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_supplier_invoices"
    ADD CONSTRAINT "business_supplier_invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."business_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_suppliers"
    ADD CONSTRAINT "business_suppliers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_suppliers"
    ADD CONSTRAINT "business_suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_cost_category_id_fkey" FOREIGN KEY ("cost_category_id") REFERENCES "public"."business_cost_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_cost_centre_id_fkey" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."business_cost_centres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_source_inventory_movement_id_fkey" FOREIGN KEY ("source_inventory_movement_id") REFERENCES "public"."business_inventory_movements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_source_recurring_cost_id_fkey" FOREIGN KEY ("source_recurring_cost_id") REFERENCES "public"."business_recurring_costs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_source_sale_id_fkey" FOREIGN KEY ("source_sale_id") REFERENCES "public"."business_sales"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_source_supplier_invoice_id_fkey" FOREIGN KEY ("source_supplier_invoice_id") REFERENCES "public"."business_supplier_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_transactions"
    ADD CONSTRAINT "business_transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."business_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_user_preferences"
    ADD CONSTRAINT "business_user_preferences_active_business_id_fkey" FOREIGN KEY ("active_business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_user_preferences"
    ADD CONSTRAINT "business_user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_card_activities"
    ADD CONSTRAINT "credit_card_activities_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_card_activities"
    ADD CONSTRAINT "credit_card_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_card_monthly_records"
    ADD CONSTRAINT "credit_card_monthly_records_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_card_monthly_records"
    ADD CONSTRAINT "credit_card_monthly_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_upload_intents"
    ADD CONSTRAINT "document_upload_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_documents"
    ADD CONSTRAINT "financial_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_independence_settings"
    ADD CONSTRAINT "financial_independence_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_investments"
    ADD CONSTRAINT "goal_investments_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_investments"
    ADD CONSTRAINT "goal_investments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_investments"
    ADD CONSTRAINT "goal_investments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."money_entry_preferences"
    ADD CONSTRAINT "money_entry_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_budget_items"
    ADD CONSTRAINT "monthly_budget_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_budget_plans"
    ADD CONSTRAINT "monthly_budget_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_usage_daily"
    ADD CONSTRAINT "platform_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_usage_presence"
    ADD CONSTRAINT "platform_usage_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_import_batches"
    ADD CONSTRAINT "statement_import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_import_items"
    ADD CONSTRAINT "statement_import_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."statement_import_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_import_items"
    ADD CONSTRAINT "statement_import_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."statement_import_items"
    ADD CONSTRAINT "statement_import_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_import_profiles"
    ADD CONSTRAINT "statement_import_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."support_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_category_rules"
    ADD CONSTRAINT "transaction_category_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_template_postings"
    ADD CONSTRAINT "transaction_template_postings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."transaction_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_template_postings"
    ADD CONSTRAINT "transaction_template_postings_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_template_postings"
    ADD CONSTRAINT "transaction_template_postings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_templates"
    ADD CONSTRAINT "transaction_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can read audit logs" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can read own role" ON "public"."admin_users" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_super_admin"()));



CREATE POLICY "Admins can view audit log" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "Customers manage own statement import profiles" ON "public"."statement_import_profiles" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Customers manage own transaction category rules" ON "public"."transaction_category_rules" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Customers read their support messages" ON "public"."support_messages" FOR SELECT TO "authenticated" USING ((("internal_note" = false) AND (EXISTS ( SELECT 1
   FROM "public"."support_requests" "request"
  WHERE (("request"."id" = "support_messages"."request_id") AND ("request"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Customers send messages to their support threads" ON "public"."support_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_role" = 'customer'::"text") AND ("sender_user_id" = "auth"."uid"()) AND ("internal_note" = false) AND ("is_initial" = false) AND (EXISTS ( SELECT 1
   FROM "public"."support_requests" "request"
  WHERE (("request"."id" = "support_messages"."request_id") AND ("request"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Customers view own statement import batches" ON "public"."statement_import_batches" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Customers view own statement import items" ON "public"."statement_import_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own bills" ON "public"."bills" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own debts" ON "public"."debts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own goals" ON "public"."goals" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own money entry preferences" ON "public"."money_entry_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own transaction template postings" ON "public"."transaction_template_postings" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."transaction_templates" "template"
  WHERE (("template"."id" = "transaction_template_postings"."template_id") AND ("template"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create own transaction templates" ON "public"."transaction_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their AI insight preference" ON "public"."ai_insight_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their AI insight snapshots" ON "public"."ai_insight_snapshots" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their financial independence settings" ON "public"."financial_independence_settings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own support requests" ON "public"."support_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("status" = 'open'::"text") AND ("handled_by" IS NULL) AND ("resolved_at" IS NULL)));



CREATE POLICY "Users can delete own bills" ON "public"."bills" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own debts" ON "public"."debts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own goals" ON "public"."goals" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own money entry preferences" ON "public"."money_entry_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own transaction template postings" ON "public"."transaction_template_postings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own transaction templates" ON "public"."transaction_templates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own transactions" ON "public"."transactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their AI insight preference" ON "public"."ai_insight_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their AI insight snapshots" ON "public"."ai_insight_snapshots" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their financial independence settings" ON "public"."financial_independence_settings" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read their AI insight preference" ON "public"."ai_insight_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their AI insight snapshots" ON "public"."ai_insight_snapshots" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their financial independence settings" ON "public"."financial_independence_settings" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own support requests" ON "public"."support_requests" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own bills" ON "public"."bills" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own debts" ON "public"."debts" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own goals" ON "public"."goals" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own money entry preferences" ON "public"."money_entry_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own transaction templates" ON "public"."transaction_templates" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own transactions" ON "public"."transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their AI insight preference" ON "public"."ai_insight_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their financial independence settings" ON "public"."financial_independence_settings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own automatic payment runs" ON "public"."automatic_payment_runs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own bills" ON "public"."bills" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own credit card activities" ON "public"."credit_card_activities" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own credit card monthly records" ON "public"."credit_card_monthly_records" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own debt payments" ON "public"."debt_payments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own debts" ON "public"."debts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own goal investments" ON "public"."goal_investments" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own goals" ON "public"."goals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own money entry preferences" ON "public"."money_entry_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own transaction template postings" ON "public"."transaction_template_postings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own transaction templates" ON "public"."transaction_templates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own transactions" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete their own financial documents" ON "public"."financial_documents" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own goals" ON "public"."goals" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own monthly budget items" ON "public"."monthly_budget_items" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own monthly plans" ON "public"."monthly_budget_plans" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users mark their own notifications read" ON "public"."user_notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users mark their support threads read" ON "public"."support_requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read their own financial documents" ON "public"."financial_documents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read their own notifications" ON "public"."user_notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users register their own financial documents" ON "public"."financial_documents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update their own financial documents" ON "public"."financial_documents" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own goal investments" ON "public"."goal_investments" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_insight_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_insight_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automatic_payment_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_audit_log_select" ON "public"."business_audit_log" FOR SELECT TO "authenticated" USING ("public"."business_member_can_manage"("business_id"));



ALTER TABLE "public"."business_cost_budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_cost_budgets_manage" ON "public"."business_cost_budgets" TO "authenticated" USING ("public"."business_member_can_manage"("business_id")) WITH CHECK ("public"."business_member_can_manage"("business_id"));



CREATE POLICY "business_cost_budgets_select" ON "public"."business_cost_budgets" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_cost_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_cost_categories_manage" ON "public"."business_cost_categories" TO "authenticated" USING ("public"."business_member_can_manage"("business_id")) WITH CHECK ("public"."business_member_can_manage"("business_id"));



CREATE POLICY "business_cost_categories_select" ON "public"."business_cost_categories" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_cost_centres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_cost_centres_manage" ON "public"."business_cost_centres" TO "authenticated" USING ("public"."business_member_can_manage"("business_id")) WITH CHECK ("public"."business_member_can_manage"("business_id"));



CREATE POLICY "business_cost_centres_select" ON "public"."business_cost_centres" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_documents_select" ON "public"."business_documents" FOR SELECT TO "authenticated" USING ("public"."business_member_can_manage"("business_id"));



ALTER TABLE "public"."business_inventory_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_inventory_categories_manage" ON "public"."business_inventory_categories" TO "authenticated" USING ("public"."business_member_can_write"("business_id")) WITH CHECK ("public"."business_member_can_write"("business_id"));



CREATE POLICY "business_inventory_categories_select" ON "public"."business_inventory_categories" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_inventory_items_manage" ON "public"."business_inventory_items" TO "authenticated" USING ("public"."business_member_can_write"("business_id")) WITH CHECK ("public"."business_member_can_write"("business_id"));



CREATE POLICY "business_inventory_items_select" ON "public"."business_inventory_items" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_inventory_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_inventory_locations_manage" ON "public"."business_inventory_locations" TO "authenticated" USING ("public"."business_member_can_write"("business_id")) WITH CHECK ("public"."business_member_can_write"("business_id"));



CREATE POLICY "business_inventory_locations_select" ON "public"."business_inventory_locations" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_inventory_movements_select" ON "public"."business_inventory_movements" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_members_select" ON "public"."business_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."business_member_can_manage"("business_id")));



ALTER TABLE "public"."business_recurring_costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_recurring_costs_manage" ON "public"."business_recurring_costs" TO "authenticated" USING ("public"."business_member_can_manage"("business_id")) WITH CHECK ("public"."business_member_can_manage"("business_id"));



CREATE POLICY "business_recurring_costs_select" ON "public"."business_recurring_costs" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_sale_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_sale_lines_select" ON "public"."business_sale_lines" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_sales_select" ON "public"."business_sales" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



ALTER TABLE "public"."business_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_settings_select" ON "public"."business_settings" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



CREATE POLICY "business_settings_update" ON "public"."business_settings" FOR UPDATE TO "authenticated" USING ("public"."business_member_can_manage"("business_id")) WITH CHECK ("public"."business_member_can_manage"("business_id"));



ALTER TABLE "public"."business_supplier_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_supplier_invoices_select" ON "public"."business_supplier_invoices" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



CREATE POLICY "business_supplier_invoices_write" ON "public"."business_supplier_invoices" TO "authenticated" USING ("public"."business_member_can_write"("business_id")) WITH CHECK ("public"."business_member_can_write"("business_id"));



ALTER TABLE "public"."business_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_suppliers_select" ON "public"."business_suppliers" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



CREATE POLICY "business_suppliers_write" ON "public"."business_suppliers" TO "authenticated" USING ("public"."business_member_can_write"("business_id")) WITH CHECK ("public"."business_member_can_write"("business_id"));



ALTER TABLE "public"."business_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_transactions_delete" ON "public"."business_transactions" FOR DELETE TO "authenticated" USING ("public"."business_member_can_write"("business_id"));



CREATE POLICY "business_transactions_insert" ON "public"."business_transactions" FOR INSERT TO "authenticated" WITH CHECK ("public"."business_member_can_write"("business_id"));



CREATE POLICY "business_transactions_select" ON "public"."business_transactions" FOR SELECT TO "authenticated" USING ("public"."business_member_has_access"("business_id"));



CREATE POLICY "business_transactions_update" ON "public"."business_transactions" FOR UPDATE TO "authenticated" USING ("public"."business_member_can_write"("business_id")) WITH CHECK ("public"."business_member_can_write"("business_id"));



ALTER TABLE "public"."business_user_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_user_preferences_select" ON "public"."business_user_preferences" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "businesses_delete_owner" ON "public"."businesses" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "businesses_select_members" ON "public"."businesses" FOR SELECT TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR "public"."business_member_has_access"("id")));



CREATE POLICY "businesses_update_managers" ON "public"."businesses" FOR UPDATE TO "authenticated" USING ("public"."business_member_can_manage"("id")) WITH CHECK ("public"."business_member_can_manage"("id"));



ALTER TABLE "public"."credit_card_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_card_monthly_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debt_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_upload_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_independence_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_investments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."money_entry_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_budget_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_budget_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_usage_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_usage_presence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statement_import_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statement_import_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statement_import_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_category_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_template_postings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_account_directory"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_account_directory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_account_directory"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_platform_overview"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_platform_overview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_platform_overview"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_safe_relation_count"("relation_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_safe_relation_count"("relation_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_usage_directory"("p_scope" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_usage_directory"("p_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_usage_directory"("p_scope" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_usage_overview"("p_scope" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_usage_overview"("p_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_usage_overview"("p_scope" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_business_workspace"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_business_workspace"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_business_workspace"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_capture_audit_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_capture_audit_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_capture_document_audit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_capture_document_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_cost_budget_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_cost_budget_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_cost_budget_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_cost_category_after_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_cost_category_after_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_cost_category_after_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_documents_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_documents_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_documents_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_inventory_item_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_inventory_item_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_inventory_item_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_inventory_master_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_inventory_master_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_inventory_master_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_inventory_seed_after_business"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_inventory_seed_after_business"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_inventory_seed_after_business"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_member_can_manage"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_member_can_manage"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."business_member_can_manage"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_member_can_manage"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_member_can_write"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_member_can_write"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."business_member_can_write"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_member_can_write"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_member_has_access"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_member_has_access"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."business_member_has_access"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_member_has_access"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."business_next_recurring_timestamp"("p_start_date" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text", "p_after" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."business_next_recurring_timestamp"("p_start_date" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text", "p_after" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_next_recurring_timestamp"("p_start_date" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text", "p_after" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."business_recurring_cost_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_recurring_cost_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_recurring_cost_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_sale_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_sale_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_sale_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_scheduled_timestamp"("p_month" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."business_scheduled_timestamp"("p_month" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_scheduled_timestamp"("p_month" "date", "p_due_day" integer, "p_record_time" time without time zone, "p_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."business_seed_cost_control_after_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_seed_cost_control_after_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_seed_cost_control_after_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_supplier_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_supplier_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_supplier_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_supplier_invoice_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_supplier_invoice_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_supplier_invoice_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_transaction_before_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_transaction_before_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_transaction_before_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."business_user_preference_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."business_user_preference_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_user_preference_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_workspace_has_financial_activity"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_workspace_has_financial_activity"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_workspace_has_financial_activity"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_support_request_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_support_request_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_support_request_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_business_document"("p_document_id" "uuid", "p_business_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_file_path" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size" bigint, "p_expires_on" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_business_document"("p_document_id" "uuid", "p_business_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_file_path" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size" bigint, "p_expires_on" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_business_document"("p_document_id" "uuid", "p_business_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_file_path" "text", "p_original_filename" "text", "p_mime_type" "text", "p_file_size" bigint, "p_expires_on" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_business_inventory_item"("p_business_id" "uuid", "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_category_id" "uuid", "p_supplier_id" "uuid", "p_location_id" "uuid", "p_unit" "text", "p_low_stock_threshold" numeric, "p_default_purchase_cost" numeric, "p_default_purchase_currency" "text", "p_default_purchase_cost_base" numeric, "p_default_exchange_rate_to_base" numeric, "p_selling_price_base" numeric, "p_opening_quantity" numeric, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_business_inventory_item"("p_business_id" "uuid", "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_category_id" "uuid", "p_supplier_id" "uuid", "p_location_id" "uuid", "p_unit" "text", "p_low_stock_threshold" numeric, "p_default_purchase_cost" numeric, "p_default_purchase_currency" "text", "p_default_purchase_cost_base" numeric, "p_default_exchange_rate_to_base" numeric, "p_selling_price_base" numeric, "p_opening_quantity" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_business_inventory_item"("p_business_id" "uuid", "p_name" "text", "p_sku" "text", "p_barcode" "text", "p_category_id" "uuid", "p_supplier_id" "uuid", "p_location_id" "uuid", "p_unit" "text", "p_low_stock_threshold" numeric, "p_default_purchase_cost" numeric, "p_default_purchase_currency" "text", "p_default_purchase_cost_base" numeric, "p_default_exchange_rate_to_base" numeric, "p_selling_price_base" numeric, "p_opening_quantity" numeric, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_business_workspace"("p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_business_workspace"("p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_business_workspace"("p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."credit_card_minimum_payment_3_percent"() TO "anon";
GRANT ALL ON FUNCTION "public"."credit_card_minimum_payment_3_percent"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."credit_card_minimum_payment_3_percent"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_all_financial_records"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_all_financial_records"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_all_financial_records"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_bill_with_transaction"("p_bill_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_bill_with_transaction"("p_bill_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_bill_with_transaction"("p_bill_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_business_document"("p_document_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_business_document"("p_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_business_document"("p_document_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_business_sale"("p_sale_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_business_sale"("p_sale_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_business_sale"("p_sale_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_business_workspace"("p_business_id" "uuid", "p_confirmation_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_business_workspace"("p_business_id" "uuid", "p_confirmation_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_business_workspace"("p_business_id" "uuid", "p_confirmation_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_debt_with_linked_transactions"("p_debt_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_debt_with_linked_transactions"("p_debt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_debt_with_linked_transactions"("p_debt_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_debt_with_payments"("p_debt_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_debt_with_payments"("p_debt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_debt_with_payments"("p_debt_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_goal_with_investments"("p_goal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_goal_with_investments"("p_goal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_goal_with_investments"("p_goal_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_transactions_with_linked_bills"("p_transaction_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_transactions_with_linked_bills"("p_transaction_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_transactions_with_linked_bills"("p_transaction_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_manual_debt_payment_confirmation"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_manual_debt_payment_confirmation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_manual_debt_payment_confirmation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ficonter_debt_due_date"("p_reference_date" "date", "p_due_day" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."ficonter_debt_due_date"("p_reference_date" "date", "p_due_day" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ficonter_debt_due_date"("p_reference_date" "date", "p_due_day" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ficonter_next_bill_due_date"("p_due_date" "date", "p_recurrence" "text", "p_anchor_day" integer, "p_anchor_month_end" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."ficonter_next_bill_due_date"("p_due_date" "date", "p_recurrence" "text", "p_anchor_day" integer, "p_anchor_month_end" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ficonter_next_bill_due_date"("p_due_date" "date", "p_recurrence" "text", "p_anchor_day" integer, "p_anchor_month_end" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ficonter_record_bill_occurrence"("p_bill_id" "uuid", "p_user_id" "uuid", "p_occurrence_date" "date", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ficonter_record_bill_occurrence"("p_bill_id" "uuid", "p_user_id" "uuid", "p_occurrence_date" "date", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ficonter_record_debt_occurrence"("p_debt_id" "uuid", "p_user_id" "uuid", "p_occurrence_key" "text", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ficonter_record_debt_occurrence"("p_debt_id" "uuid", "p_user_id" "uuid", "p_occurrence_key" "text", "p_transaction_date" "date", "p_occurred_at" timestamp with time zone, "p_trigger_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ficonter_safe_timezone"("p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ficonter_safe_timezone"("p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ficonter_safe_timezone"("p_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ficonter_scheduled_timestamp"("p_date" "date", "p_time" time without time zone, "p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ficonter_scheduled_timestamp"("p_date" "date", "p_time" time without time zone, "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ficonter_scheduled_timestamp"("p_date" "date", "p_time" time without time zone, "p_timezone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_ai_insights_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ai_insights_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_insights_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_business_overview"("p_business_id" "uuid", "p_month" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_business_overview"("p_business_id" "uuid", "p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_business_overview"("p_business_id" "uuid", "p_month" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_business_profitability_report"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_business_profitability_report"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_business_profitability_report"("p_business_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2_base"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2_base"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cash_flow_intelligence_inputs_v2_base"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_emergency_fund_intelligence_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_emergency_fund_intelligence_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_emergency_fund_intelligence_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_financial_health_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_financial_health_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_health_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_financial_independence_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_financial_independence_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_independence_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_net_worth_growth_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_net_worth_growth_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_net_worth_growth_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_savings_intelligence_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_savings_intelligence_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_savings_intelligence_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_wealth_score_inputs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_wealth_score_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_wealth_score_inputs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_active_document_upload_intent"("p_storage_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_active_document_upload_intent"("p_storage_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_document_upload_intent"("p_storage_path" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_statement_transactions"("p_file_name" "text", "p_rows" "jsonb", "p_mapping" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_statement_transactions"("p_file_name" "text", "p_rows" "jsonb", "p_mapping" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_statement_transactions"("p_file_name" "text", "p_rows" "jsonb", "p_mapping" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_statement_transactions"("p_file_name" "text", "p_rows" "jsonb", "p_mapping" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_platform_super_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_super_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_bill_paid"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone, "p_transaction_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_bill_paid"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone, "p_transaction_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_bill_paid"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone, "p_transaction_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."platform_usage_is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."platform_usage_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."platform_usage_is_admin"() TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."post_monthly_transaction_template"("p_template_id" "uuid", "p_period_key" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."post_monthly_transaction_template"("p_template_id" "uuid", "p_period_key" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."post_monthly_transaction_template"("p_template_id" "uuid", "p_period_key" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_monthly_transaction_template"("p_template_id" "uuid", "p_period_key" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_automatic_payments"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_automatic_payments"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_business_recurring_costs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_business_recurring_costs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_bill_payment_and_advance"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_bill_payment_and_advance"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_bill_payment_and_advance"("p_bill_id" "uuid", "p_paid_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_business_inventory_movement"("p_item_id" "uuid", "p_movement_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_currency" "text", "p_unit_cost_base" numeric, "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_supplier_id" "uuid", "p_movement_date" "date", "p_occurred_at" timestamp with time zone, "p_reference" "text", "p_notes" "text", "p_create_expense" boolean, "p_payment_method" "text", "p_cost_category_id" "uuid", "p_cost_centre_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_business_inventory_movement"("p_item_id" "uuid", "p_movement_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_currency" "text", "p_unit_cost_base" numeric, "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_supplier_id" "uuid", "p_movement_date" "date", "p_occurred_at" timestamp with time zone, "p_reference" "text", "p_notes" "text", "p_create_expense" boolean, "p_payment_method" "text", "p_cost_category_id" "uuid", "p_cost_centre_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_business_inventory_movement"("p_item_id" "uuid", "p_movement_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_currency" "text", "p_unit_cost_base" numeric, "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_supplier_id" "uuid", "p_movement_date" "date", "p_occurred_at" timestamp with time zone, "p_reference" "text", "p_notes" "text", "p_create_expense" boolean, "p_payment_method" "text", "p_cost_category_id" "uuid", "p_cost_centre_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_business_sale"("p_business_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_business_sale"("p_business_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_business_sale"("p_business_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_business_supplier_invoice_payment"("p_invoice_id" "uuid", "p_paid_at" timestamp with time zone, "p_payment_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_business_supplier_invoice_payment"("p_invoice_id" "uuid", "p_paid_at" timestamp with time zone, "p_payment_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_business_supplier_invoice_payment"("p_invoice_id" "uuid", "p_paid_at" timestamp with time zone, "p_payment_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_credit_card_activity"("p_debt_id" "uuid", "p_activity_type" "text", "p_description" "text", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_credit_card_activity"("p_debt_id" "uuid", "p_activity_type" "text", "p_description" "text", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_credit_card_activity"("p_debt_id" "uuid", "p_activity_type" "text", "p_description" "text", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_credit_card_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_credit_card_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_credit_card_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_debt_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_transaction_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_debt_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_transaction_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."record_debt_payment"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_transaction_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."record_debt_payment_atomic"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_debt_payment_atomic"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_debt_payment_atomic"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_notes" "text", "p_exchange_rate_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_debt_payment_with_transaction"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_exchange_rate_date" "date", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_debt_payment_with_transaction"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_exchange_rate_date" "date", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_debt_payment_with_transaction"("p_debt_id" "uuid", "p_amount" numeric, "p_amount_eur" numeric, "p_exchange_rate" numeric, "p_paid_at" timestamp with time zone, "p_exchange_rate_date" "date", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_goal_investment"("p_goal_id" "uuid", "p_amount" numeric, "p_invested_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_goal_investment"("p_goal_id" "uuid", "p_amount" numeric, "p_invested_at" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_goal_investment"("p_goal_id" "uuid", "p_amount" numeric, "p_invested_at" timestamp with time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_platform_usage_heartbeat"("p_session_id" "uuid", "p_workspace" "text", "p_module" "text", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_platform_usage_heartbeat"("p_session_id" "uuid", "p_workspace" "text", "p_module" "text", "p_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_platform_usage_heartbeat"("p_session_id" "uuid", "p_workspace" "text", "p_module" "text", "p_visible" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."refund_business_sale"("p_sale_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_business_sale"("p_sale_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_business_sale"("p_sale_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_document_upload"("p_user_id" "uuid", "p_storage_path" "text", "p_original_name" "text", "p_display_name" "text", "p_category" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_document_date" "date", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_document_upload"("p_user_id" "uuid", "p_storage_path" "text", "p_original_name" "text", "p_display_name" "text", "p_category" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_document_date" "date", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_business_sale"("p_sale_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_business_sale"("p_sale_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_business_sale"("p_sale_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_business_workspace"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_business_workspace"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_business_workspace"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_debt_before_transaction_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_debt_before_transaction_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_business_inventory_movement"("p_movement_id" "uuid", "p_occurred_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_business_inventory_movement"("p_movement_id" "uuid", "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_business_inventory_movement"("p_movement_id" "uuid", "p_occurred_at" timestamp with time zone, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_business_supplier_invoice_payment"("p_invoice_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_business_supplier_invoice_payment"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_business_supplier_invoice_payment"("p_invoice_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_credit_card_activity"("p_activity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_credit_card_activity"("p_activity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_credit_card_activity"("p_activity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_debt_payment"("p_payment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_debt_payment"("p_payment_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."reverse_debt_payment"("p_payment_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reverse_debt_payment_atomic"("p_payment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_debt_payment_atomic"("p_payment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_debt_payment_atomic"("p_payment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_goal_investment"("p_investment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverse_goal_investment"("p_investment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverse_goal_investment"("p_investment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_credit_card_monthly_record"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_credit_card_monthly_record"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_credit_card_monthly_record"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."seed_business_cost_control_defaults"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."seed_business_cost_control_defaults"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."seed_business_inventory_defaults"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."seed_business_inventory_defaults"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_active_business_workspace"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_active_business_workspace"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_active_business_workspace"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_admin_user_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_admin_user_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_financial_document_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_financial_document_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_financial_document_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_support_request_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_support_request_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_support_request_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_credit_card_monthly_record"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_credit_card_monthly_record"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_credit_card_monthly_record"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_effortless_entry_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_effortless_entry_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_effortless_entry_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_statement_import_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_statement_import_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_statement_import_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_support_request_from_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_support_request_from_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_support_request_from_message"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_business_administration_settings"("p_business_id" "uuid", "p_default_timezone" "text", "p_date_format" "text", "p_number_format" "text", "p_default_payment_method" "text", "p_default_payment_terms_days" integer, "p_default_sales_tax_rate" numeric, "p_invoice_prefix" "text", "p_next_invoice_number" bigint, "p_default_low_stock_threshold" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_business_administration_settings"("p_business_id" "uuid", "p_default_timezone" "text", "p_date_format" "text", "p_number_format" "text", "p_default_payment_method" "text", "p_default_payment_terms_days" integer, "p_default_sales_tax_rate" numeric, "p_invoice_prefix" "text", "p_next_invoice_number" bigint, "p_default_low_stock_threshold" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_business_administration_settings"("p_business_id" "uuid", "p_default_timezone" "text", "p_date_format" "text", "p_number_format" "text", "p_default_payment_method" "text", "p_default_payment_terms_days" integer, "p_default_sales_tax_rate" numeric, "p_invoice_prefix" "text", "p_next_invoice_number" bigint, "p_default_low_stock_threshold" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_business_document"("p_document_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_expires_on" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_business_document"("p_document_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_expires_on" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_business_document"("p_document_id" "uuid", "p_title" "text", "p_category" "text", "p_description" "text", "p_expires_on" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_business_sale"("p_sale_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_business_sale"("p_sale_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_business_sale"("p_sale_id" "uuid", "p_sale_number" "text", "p_customer_name" "text", "p_customer_email" "text", "p_currency" "text", "p_exchange_rate_to_base" numeric, "p_exchange_rate_date" "date", "p_exchange_rate_source" "text", "p_sale_date" "date", "p_occurred_at" timestamp with time zone, "p_payment_method" "text", "p_discount" numeric, "p_tax" numeric, "p_reference" "text", "p_notes" "text", "p_lines" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_business_workspace"("p_business_id" "uuid", "p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text", "p_tax_id" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_website" "text", "p_address_line1" "text", "p_address_line2" "text", "p_city" "text", "p_postal_code" "text", "p_logo_path" "text", "p_cover_image_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_business_workspace"("p_business_id" "uuid", "p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text", "p_tax_id" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_website" "text", "p_address_line1" "text", "p_address_line2" "text", "p_city" "text", "p_postal_code" "text", "p_logo_path" "text", "p_cover_image_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_business_workspace"("p_business_id" "uuid", "p_name" "text", "p_legal_name" "text", "p_business_type" "text", "p_country_code" "text", "p_base_currency" "text", "p_fiscal_year_start_month" integer, "p_timezone" "text", "p_tax_id" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_website" "text", "p_address_line1" "text", "p_address_line2" "text", "p_city" "text", "p_postal_code" "text", "p_logo_path" "text", "p_cover_image_path" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_credit_card_statement"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_credit_card_statement"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_credit_card_statement"("p_debt_id" "uuid", "p_statement_balance" numeric, "p_statement_balance_eur" numeric, "p_exchange_rate" numeric, "p_statement_date" "date", "p_payment_due_date" "date", "p_minimum_payment" numeric, "p_minimum_payment_eur" numeric, "p_apr" numeric, "p_interest_charged" numeric, "p_interest_charged_eur" numeric) TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."admin_audit_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."admin_users" TO "service_role";
GRANT SELECT ON TABLE "public"."admin_users" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_insight_preferences" TO "anon";
GRANT ALL ON TABLE "public"."ai_insight_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_insight_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."ai_insight_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."ai_insight_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_insight_snapshots" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."automatic_payment_runs" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."automatic_payment_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."automatic_payment_runs" TO "service_role";



GRANT ALL ON TABLE "public"."bills" TO "anon";
GRANT ALL ON TABLE "public"."bills" TO "authenticated";
GRANT ALL ON TABLE "public"."bills" TO "service_role";



GRANT ALL ON TABLE "public"."business_audit_log" TO "service_role";
GRANT SELECT ON TABLE "public"."business_audit_log" TO "authenticated";



GRANT ALL ON TABLE "public"."business_cost_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."business_cost_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."business_cost_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."business_cost_categories" TO "service_role";



GRANT ALL ON TABLE "public"."business_cost_centres" TO "authenticated";
GRANT ALL ON TABLE "public"."business_cost_centres" TO "service_role";



GRANT ALL ON TABLE "public"."business_documents" TO "service_role";
GRANT SELECT ON TABLE "public"."business_documents" TO "authenticated";



GRANT ALL ON TABLE "public"."business_inventory_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."business_inventory_categories" TO "service_role";



GRANT ALL ON TABLE "public"."business_inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."business_inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."business_inventory_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."business_inventory_locations" TO "service_role";



GRANT ALL ON TABLE "public"."business_inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."business_inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."business_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."business_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."business_inventory_item_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."business_inventory_item_balances" TO "service_role";



GRANT ALL ON TABLE "public"."business_members" TO "authenticated";
GRANT ALL ON TABLE "public"."business_members" TO "service_role";



GRANT ALL ON TABLE "public"."business_recurring_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."business_recurring_costs" TO "service_role";



GRANT ALL ON TABLE "public"."business_sale_lines" TO "service_role";
GRANT SELECT ON TABLE "public"."business_sale_lines" TO "authenticated";



GRANT ALL ON TABLE "public"."business_sales" TO "service_role";
GRANT SELECT ON TABLE "public"."business_sales" TO "authenticated";



GRANT ALL ON TABLE "public"."business_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."business_settings" TO "service_role";



GRANT ALL ON TABLE "public"."business_supplier_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."business_supplier_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."business_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."business_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."business_user_preferences" TO "service_role";
GRANT SELECT ON TABLE "public"."business_user_preferences" TO "authenticated";



GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_card_activities" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_card_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_card_activities" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_card_monthly_records" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."credit_card_monthly_records" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_card_monthly_records" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."debt_payments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."debt_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."debt_payments" TO "service_role";



GRANT ALL ON TABLE "public"."debts" TO "anon";
GRANT ALL ON TABLE "public"."debts" TO "authenticated";
GRANT ALL ON TABLE "public"."debts" TO "service_role";



GRANT ALL ON TABLE "public"."document_upload_intents" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."financial_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_documents" TO "service_role";



GRANT ALL ON TABLE "public"."financial_independence_settings" TO "anon";
GRANT ALL ON TABLE "public"."financial_independence_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_independence_settings" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."goal_investments" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_investments" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."money_entry_preferences" TO "anon";
GRANT ALL ON TABLE "public"."money_entry_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."money_entry_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_budget_items" TO "anon";
GRANT ALL ON TABLE "public"."monthly_budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_budget_items" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_budget_plans" TO "anon";
GRANT ALL ON TABLE "public"."monthly_budget_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_budget_plans" TO "service_role";



GRANT ALL ON TABLE "public"."platform_usage_daily" TO "service_role";



GRANT ALL ON TABLE "public"."platform_usage_presence" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."statement_import_batches" TO "anon";
GRANT ALL ON TABLE "public"."statement_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."statement_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."statement_import_items" TO "anon";
GRANT ALL ON TABLE "public"."statement_import_items" TO "authenticated";
GRANT ALL ON TABLE "public"."statement_import_items" TO "service_role";



GRANT ALL ON TABLE "public"."statement_import_profiles" TO "anon";
GRANT ALL ON TABLE "public"."statement_import_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."statement_import_profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON TABLE "public"."support_requests" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."support_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."support_requests" TO "service_role";



GRANT UPDATE("customer_last_read_at") ON TABLE "public"."support_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."transaction_category_rules" TO "anon";
GRANT ALL ON TABLE "public"."transaction_category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_category_rules" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_template_postings" TO "anon";
GRANT ALL ON TABLE "public"."transaction_template_postings" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_template_postings" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_templates" TO "anon";
GRANT ALL ON TABLE "public"."transaction_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_templates" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT UPDATE("read_at") ON TABLE "public"."user_notifications" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







