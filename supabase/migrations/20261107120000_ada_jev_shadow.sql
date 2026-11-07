-- Ada × Jev in shadow (supabase/functions/api/agent/jev_shadow.ts).
--
-- One row per chat run: what Jev (a decision model) would have decided for the
-- run's tier, intent and each card's tag, subject and "did the student ask for
-- this?", next to what Ada actually did. Nothing here changes what a student
-- sees; it is the evidence for deciding whether Jev takes those decisions over
-- (docs/JEV.md). The cards' later fate (approved / declined) lives in
-- ada_pending_actions and is joined in at report time.
--
-- The edge function writes here best-effort after the reply is sent, so
-- deploying it before this migration only drops shadow rows (with a log line).
-- Server-only: RLS on and no policies, so only the service role reads or
-- writes it, as with ada_agent_runs' internals.

create table if not exists public.ada_jev_shadow (
  id                      uuid primary key default gen_random_uuid(),
  run_id                  uuid not null references public.ada_agent_runs(id) on delete cascade,
  user_id                 uuid not null,
  created_at              timestamptz not null default now(),
  model                   varchar(80) not null,
  ms                      integer,
  input_tokens            integer,
  cost_usd                numeric(12, 8),
  rule_tier               varchar(10) not null,
  jev_tier                varchar(10),
  tier_agree              boolean,
  likely_invented         smallint,
  confident_disagreements smallint,
  questions               jsonb,
  answers                 jsonb,
  comparison              jsonb,
  error                   text
);

create index if not exists ada_jev_shadow_run_id_idx on public.ada_jev_shadow (run_id);
create index if not exists ada_jev_shadow_created_at_idx on public.ada_jev_shadow (created_at);

alter table public.ada_jev_shadow enable row level security;
