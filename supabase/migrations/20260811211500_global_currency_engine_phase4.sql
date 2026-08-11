-- FICONTER Currency Engine — Phase 4
-- Goal investments preserve the user's entered original amount/currency while
-- goals themselves remain on FICONTER's canonical EUR planning layer.

begin;

create or replace function public.record_goal_investment(
  p_goal_id uuid,
  p_amount_eur numeric,
  p_original_amount numeric,
  p_currency text,
  p_exchange_rate numeric,
  p_invested_at timestamptz,
  p_notes text,
  p_exchange_rate_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.goals;
  v_investment public.goal_investments;
  v_transaction public.transactions;
  v_next_amount numeric;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_amount_eur is null or p_amount_eur <= 0 then
    raise exception 'Enter a valid investment amount.';
  end if;

  if p_original_amount is null or p_original_amount <= 0 then
    raise exception 'Enter a valid original investment amount.';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Use a valid three-letter currency code.';
  end if;

  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'A valid exchange rate is required.';
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

  if p_amount_eur > greatest(0, v_goal.target_amount - v_goal.current_amount) then
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
    p_original_amount,
    v_currency,
    p_amount_eur,
    p_exchange_rate,
    coalesce(p_exchange_rate_date, p_invested_at::date),
    'Goal investment',
    'saving',
    'General savings',
    p_invested_at::date,
    p_invested_at
  )
  returning * into v_transaction;

  v_next_amount := least(v_goal.target_amount, v_goal.current_amount + p_amount_eur);

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
    p_amount_eur,
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

revoke all on function public.record_goal_investment(
  uuid, numeric, numeric, text, numeric, timestamptz, text, date
) from public, anon;

grant execute on function public.record_goal_investment(
  uuid, numeric, numeric, text, numeric, timestamptz, text, date
) to authenticated;

notify pgrst, 'reload schema';

commit;
