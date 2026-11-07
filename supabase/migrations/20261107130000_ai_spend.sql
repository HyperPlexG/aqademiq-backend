-- What Ada spends on the Anthropic API, so it never passes the monthly cap
-- (supabase/functions/_shared/anthropic.ts).
--
-- The account gets a monthly API credit; Ada spends at most ANTHROPIC_MONTHLY_BUDGET_USD
-- of it (default $99) and falls back to Gemini on Vertex for the rest of the
-- period. This lives in Postgres, not Redis, because Redis fails open — fine for
-- a rate limit, not for money.
--
-- Every call RESERVES its worst case before it is sent (all of max_tokens at the
-- output price, the prompt at the cache-write price) and SETTLES to the real
-- cost from the response's usage. A call that dies in flight keeps its
-- reservation, so the ledger can only over-count, never under-count.
--
-- Two scopes share the table:
--   'anthropic'                monthly, period_start = the period's first day
--   'anthropic:user:<uuid>'    daily per student, period_start = that UTC day,
--                              so one student cannot spend everyone's month
--
-- Server-only: RLS on and no policies; the edge function calls the two
-- functions with its own database role.

create table if not exists public.ai_spend (
  scope        varchar(80)    not null,
  period_start date           not null,
  spent_usd    numeric(14, 6) not null default 0,
  calls        integer        not null default 0,
  updated_at   timestamptz    not null default now(),
  primary key (scope, period_start)
);

alter table public.ai_spend enable row level security;

-- Reserve p_amount against the monthly cap and, when p_user_scope is given,
-- the student's daily cap. Both or neither: returns the new monthly total;
-- null when the MONTHLY cap would be passed (Claude is off for everyone until
-- the next period); -1 when only the student's daily cap would (Claude is off
-- for that student today). Nothing is reserved in either case. The
-- conditional UPDATE takes the row lock, so concurrent calls cannot both
-- squeeze under.
create or replace function public.ai_spend_reserve(
  p_scope        text,
  p_period       date,
  p_amount       numeric,
  p_cap          numeric,
  p_user_scope   text default null,
  p_user_day     date default null,
  p_user_cap     numeric default null
) returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_total numeric;
  v_user  numeric;
begin
  if p_amount < 0 then
    raise exception 'ai_spend_reserve: amount must not be negative';
  end if;

  insert into ai_spend (scope, period_start) values (p_scope, p_period)
  on conflict do nothing;
  update ai_spend
     set spent_usd = spent_usd + p_amount, calls = calls + 1, updated_at = now()
   where scope = p_scope and period_start = p_period
     and spent_usd + p_amount <= p_cap
  returning spent_usd into v_total;
  if v_total is null then
    return null;
  end if;

  if p_user_scope is not null and p_user_cap is not null and p_user_cap > 0 then
    insert into ai_spend (scope, period_start) values (p_user_scope, p_user_day)
    on conflict do nothing;
    update ai_spend
       set spent_usd = spent_usd + p_amount, calls = calls + 1, updated_at = now()
     where scope = p_user_scope and period_start = p_user_day
       and spent_usd + p_amount <= p_user_cap
    returning spent_usd into v_user;
    if v_user is null then
      -- Give the monthly reservation back: neither cap is charged.
      update ai_spend
         set spent_usd = spent_usd - p_amount, calls = calls - 1, updated_at = now()
       where scope = p_scope and period_start = p_period;
      return -1;
    end if;
  end if;

  return v_total;
end;
$$;

-- Move a reservation to the real cost: p_delta = actual - reserved (usually
-- negative), or -reserved to release a call that was never billed.
create or replace function public.ai_spend_settle(
  p_scope      text,
  p_period     date,
  p_delta      numeric,
  p_user_scope text default null,
  p_user_day   date default null
) returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_total numeric;
begin
  update ai_spend
     set spent_usd = greatest(0, spent_usd + p_delta), updated_at = now()
   where scope = p_scope and period_start = p_period
  returning spent_usd into v_total;
  if p_user_scope is not null then
    update ai_spend
       set spent_usd = greatest(0, spent_usd + p_delta), updated_at = now()
     where scope = p_user_scope and period_start = p_user_day;
  end if;
  return v_total;
end;
$$;

revoke all on function public.ai_spend_reserve(text, date, numeric, numeric, text, date, numeric) from public, anon, authenticated;
revoke all on function public.ai_spend_settle(text, date, numeric, text, date) from public, anon, authenticated;
