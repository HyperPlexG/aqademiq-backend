-- Two unrelated-looking fixes that share a root cause: writes that were being
-- attempted but silently rejected, and LLM spend that was invisible.
--
-- 1. tasks.planner_section — widen the check constraint to the values the app
--    actually sends. Commit 092918b ("tasks: persist time-of-day bucket on
--    planner_section") started writing morning/afternoon/evening but never
--    updated this constraint, which still only allowed the pre-existing
--    anytime|planned pair. Every attempt to set a time-of-day bucket has failed
--    ever since — from the planner UI and from Ada's create_task alike — which
--    is why 100% of rows are 'anytime'. `planned` is kept so any historic row
--    (and the older wire value) stays valid.
--
-- 2. ada_agent_runs token accounting — a run that dies part-way has already
--    spent its provider quota, and until now nothing recorded how much. These
--    columns make the free-tier burn measurable per run, and `stopped_reason`
--    distinguishes a run that finished from one the server cut short.

-- ---- 1. planner_section ----

alter table "tasks" drop constraint if exists "tasks_planner_section_check";

alter table "tasks" add constraint "tasks_planner_section_check"
    check ("planner_section" in ('anytime', 'planned', 'morning', 'afternoon', 'evening'));

-- ---- 2. agent run accounting ----

alter table "ada_agent_runs"
    add column if not exists "prompt_tokens"     integer not null default 0,
    add column if not exists "completion_tokens" integer not null default 0,
    -- How many provider calls this run actually made. The prompt is replayed in
    -- full every turn, so cost grows superlinearly in this number — it is the
    -- figure to watch, not wall-clock.
    add column if not exists "llm_calls"         integer not null default 0,
    -- null = ran to a natural end (finish / no more tool calls).
    -- 'deadline' | 'call_budget' | 'turn_budget' when the server stopped it.
    add column if not exists "stopped_reason"    varchar(20);

-- Answering "how much quota did we burn today, and on what?" without a scan.
create index if not exists "ada_agent_runs_created_at_idx"
    on "ada_agent_runs" ("created_at");
