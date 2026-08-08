-- Ada's real token cost, before vs after a change.
--
-- The offline bench (api/agent/tokens_bench.ts) predicts what a change should
-- save. This measures what it actually saved, on real traffic. Run it in the
-- Supabase SQL editor a few days after a deploy.
--
-- ► Edit the `params` CTE in each query: `cutoff` = your deploy time (UTC).
--   (A CTE rather than psql's \set, so this runs unchanged in the Supabase SQL
--   editor, psql, and MCP execute_sql.)
--
-- ⚠ Runs that predate the token instrumentation
--   (20260808100000_ada_run_budget_and_planner_section.sql) have llm_calls = 0
--   and prompt_tokens = 0 — **not NULL**. `where prompt_tokens is not null`
--   does NOT exclude them, and averaging them in halves every number. Cost
--   queries below filter `llm_calls > 0`; keep that when adapting them.


-- ---------------------------------------------------------------------------
-- 1. The headline: cost per Ada message, before vs after.
--
-- Read BOTH columns. prompt_tokens is what a TPM limit sees; llm_calls is what
-- an RPM/RPD limit sees. An optimisation can improve one and not the other, and
-- which matters depends on which limit is actually benching your keys.
-- ---------------------------------------------------------------------------
with params as (
  select timestamptz '2026-08-09 00:00:00+00' as cutoff
),
runs as (
  select r.*,
         case when r.created_at < p.cutoff then '1_before' else '2_after' end as period
  from ada_agent_runs r, params p
  where r.llm_calls > 0                            -- excludes pre-instrumentation rows
    and r.created_at >= p.cutoff - interval '14 days'
    and r.created_at <  p.cutoff + interval '14 days'
)
select
  period,
  count(*)                                                          as runs,
  round(avg(llm_calls), 2)                                          as avg_calls,
  round(avg(prompt_tokens))                                         as avg_prompt_tokens,
  percentile_cont(0.5) within group (order by prompt_tokens)::int   as median_prompt_tokens,
  percentile_cont(0.95) within group (order by prompt_tokens)::int  as p95_prompt_tokens,
  round(sum(prompt_tokens)::numeric / nullif(sum(llm_calls), 0))    as tokens_per_call,
  round(avg(completion_tokens))                                     as avg_completion_tokens,
  sum(prompt_tokens + coalesce(completion_tokens, 0))               as total_tokens
from runs
group by period
order by period;


-- ---------------------------------------------------------------------------
-- 2. The guard against a fake win.
--
-- Prompt tokens can fall for a bad reason: runs hitting the deadline or the
-- call ceiling earlier and giving up. That looks like a saving and is actually
-- a regression in usefulness. `completed` should hold steady or rise — if
-- `failed`, `deadline` or `call_budget` grew, the change made Ada worse, not
-- cheaper. Deliberately NOT filtered on llm_calls: a run that never reached the
-- model is the most important outcome to see.
-- ---------------------------------------------------------------------------
with params as (
  select timestamptz '2026-08-09 00:00:00+00' as cutoff
),
runs as (
  select r.*,
         case when r.created_at < p.cutoff then '1_before' else '2_after' end as period
  from ada_agent_runs r, params p
  where r.created_at >= p.cutoff - interval '14 days'
    and r.created_at <  p.cutoff + interval '14 days'
)
select
  period,
  status,
  coalesce(stopped_reason, '—')                                         as stopped_reason,
  count(*)                                                              as runs,
  round(100.0 * count(*) / sum(count(*)) over (partition by period), 1) as pct
from runs
group by period, status, stopped_reason
order by period, runs desc;


-- ---------------------------------------------------------------------------
-- 3. Did Ada actually reach a model?
--
-- The failure mode that matters most to a user is not an expensive run — it is
-- "I couldn't reach my planning brain". Provider exhaustion shows up here as a
-- high never_reached_model count with a 429/402 error, and no stopped_reason
-- (the run threw rather than exiting on budget).
-- ---------------------------------------------------------------------------
select
  date_trunc('day', created_at)::date                                    as day,
  count(*)                                                               as runs,
  count(*) filter (where status = 'failed')                              as failed,
  count(*) filter (where llm_calls = 0 and status = 'failed')            as never_reached_model,
  round(100.0 * count(*) filter (where status = 'failed') / count(*), 1) as fail_pct,
  count(*) filter (where error ilike '%429%')                            as rate_limited,
  count(*) filter (where error ilike '%402%')                            as out_of_credit
from ada_agent_runs
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;


-- ---------------------------------------------------------------------------
-- 4. Daily cost trend — a quota wall shows up as a cliff, not a slope.
-- ---------------------------------------------------------------------------
select
  date_trunc('day', created_at)::date                            as day,
  count(*)                                                       as billable_runs,
  sum(llm_calls)                                                 as provider_calls,
  sum(prompt_tokens)                                             as prompt_tokens,
  round(sum(prompt_tokens)::numeric / nullif(sum(llm_calls), 0)) as tokens_per_call
from ada_agent_runs
where created_at >= now() - interval '30 days'
  and llm_calls > 0
group by 1
order by 1 desc;
