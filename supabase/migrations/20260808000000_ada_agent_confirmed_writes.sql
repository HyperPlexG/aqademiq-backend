-- Ada agentic runtime: durable agent runs + human-confirmed mutations.
--
-- Two tables back the agent architecture in supabase/functions/api/agent/:
--
--   ada_agent_runs      One agent run per user turn. Holds the goal, the plan the
--                       agent committed to, and the full model-facing transcript.
--                       The transcript is what makes the agent *resumable*: when a
--                       run proposes writes it parks in `awaiting_confirmation`,
--                       and approving an action rehydrates the transcript and lets
--                       the agent keep working toward the same goal.
--
--   ada_pending_actions Every create/update/delete the agent wants to make. NOTHING
--                       is written to user data until a row here is approved by the
--                       user — the agent can only ever propose. `args` is the exact
--                       validated tool input, re-checked server-side at execution
--                       time, so an approved row cannot widen its own scope.
--
-- Both are user-scoped and carry the same `<table>_own` RLS shape as the rest of
-- the schema (defence in depth — the API connects as a bypassrls role and enforces
-- tenancy in application code via tenantDb()).

create table if not exists "ada_agent_runs" (
    "id"                 uuid not null default gen_random_uuid(),
    "user_id"            uuid not null,
    "ada_session_id"     uuid not null,
    "trigger_message_id" uuid,
    "goal"               text not null,
    -- running | awaiting_confirmation | completed | failed | cancelled
    "status"             varchar(30) not null default 'running',
    -- The steps the agent said it would take, for UI + post-hoc audit.
    "plan"               jsonb not null default '[]'::jsonb,
    -- Provider-shaped message array; replayed verbatim on resume.
    "transcript"         jsonb not null default '[]'::jsonb,
    -- Agent's own notes across steps (what it learned, what it still needs).
    "scratchpad"         jsonb not null default '[]'::jsonb,
    "turns"              integer not null default 0,
    "error"              text,
    "created_at"         timestamptz not null default current_timestamp,
    "updated_at"         timestamptz not null default current_timestamp,
    constraint "ada_agent_runs_pkey" primary key ("id"),
    constraint "ada_agent_runs_session_fkey" foreign key ("ada_session_id")
        references "ada_sessions" ("id") on delete cascade,
    constraint "ada_agent_runs_message_fkey" foreign key ("trigger_message_id")
        references "ada_messages" ("id") on delete set null
);

create index if not exists "ada_agent_runs_user_id_idx" on "ada_agent_runs" ("user_id");
create index if not exists "ada_agent_runs_session_idx" on "ada_agent_runs" ("ada_session_id");
create index if not exists "ada_agent_runs_status_idx" on "ada_agent_runs" ("status");

create table if not exists "ada_pending_actions" (
    "id"             uuid not null default gen_random_uuid(),
    "user_id"        uuid not null,
    "ada_session_id" uuid not null,
    "run_id"         uuid,
    "message_id"     uuid,
    "tool_name"      varchar(60) not null,
    -- create | update | delete
    "operation"      varchar(10) not null,
    -- task | subject | semester | study_tag | mood | profile | settings | focus
    "resource"       varchar(40) not null,
    -- One-line human summary rendered on the confirmation card.
    "title"          varchar(300) not null,
    -- { fields: [{ label, from, to }], warning?: string } — the diff the user sees.
    "detail"         jsonb not null default '{}'::jsonb,
    -- Exact validated tool input; re-validated at execution time.
    "args"           jsonb not null default '{}'::jsonb,
    -- pending | approved | rejected | executed | failed | superseded
    "status"         varchar(20) not null default 'pending',
    "result"         jsonb,
    "error"          text,
    "created_at"     timestamptz not null default current_timestamp,
    "decided_at"     timestamptz,
    "executed_at"    timestamptz,
    constraint "ada_pending_actions_pkey" primary key ("id"),
    constraint "ada_pending_actions_session_fkey" foreign key ("ada_session_id")
        references "ada_sessions" ("id") on delete cascade,
    constraint "ada_pending_actions_run_fkey" foreign key ("run_id")
        references "ada_agent_runs" ("id") on delete cascade,
    constraint "ada_pending_actions_message_fkey" foreign key ("message_id")
        references "ada_messages" ("id") on delete set null,
    constraint "ada_pending_actions_operation_check"
        check ("operation" in ('create', 'update', 'delete'))
);

create index if not exists "ada_pending_actions_user_id_idx" on "ada_pending_actions" ("user_id");
create index if not exists "ada_pending_actions_session_idx" on "ada_pending_actions" ("ada_session_id");
create index if not exists "ada_pending_actions_run_idx" on "ada_pending_actions" ("run_id");
-- The hot path: "what is still awaiting this user's decision?"
create index if not exists "ada_pending_actions_user_status_idx"
    on "ada_pending_actions" ("user_id", "status");

-- ---- RLS (matches the existing <table>_own convention) ----

alter table "ada_agent_runs" enable row level security;
alter table "ada_pending_actions" enable row level security;

drop policy if exists "ada_agent_runs_own" on "ada_agent_runs";
create policy "ada_agent_runs_own" on "ada_agent_runs"
    for all to authenticated
    using ("user_id" = auth.uid())
    with check ("user_id" = auth.uid());

drop policy if exists "ada_pending_actions_own" on "ada_pending_actions";
create policy "ada_pending_actions_own" on "ada_pending_actions"
    for all to authenticated
    using ("user_id" = auth.uid())
    with check ("user_id" = auth.uid());
