-- experiment_assignments — randomized holdouts (ANALYTICS_INVESTOR_METRICS §2.7).
--
-- focus_sessions.control_arm records what happened for one session, but a
-- per-session flag cannot be the source of truth: the causal design in §4.3
-- requires assignment to be **per user and stable**. A coin flip at each session
-- would give every user a mix of both arms, and the intent-to-treat comparison
-- would measure nothing.
--
-- Assignment is therefore a deterministic hash of (experiment_key, user_id) into
-- 1000 buckets, persisted here on first use so it is auditable and survives any
-- change to the hashing later. Nothing about it is shown to the user — §4.3
-- requires the holdout be silent, or awareness becomes the confound.

create table if not exists public.experiment_assignments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  experiment_key  varchar(80) not null,
  variant         varchar(40) not null,
  -- Deterministic hash bucket 0-999. Stored so a later change to bucket
  -- boundaries is visible as a diff rather than silently re-randomising history.
  bucket          smallint not null,
  assigned_at     timestamptz not null default now(),
  unique (user_id, experiment_key)
);

alter table public.experiment_assignments
  drop constraint if exists experiment_assignments_variant_check;
alter table public.experiment_assignments
  add constraint experiment_assignments_variant_check
  check (variant in ('control', 'treatment', 'holdout'));

alter table public.experiment_assignments
  drop constraint if exists experiment_assignments_bucket_check;
alter table public.experiment_assignments
  add constraint experiment_assignments_bucket_check
  check (bucket >= 0 and bucket <= 999);

create index if not exists experiment_assignments_key_variant_idx
  on public.experiment_assignments (experiment_key, variant);

-- Own-rows-only, matching every other user-scoped table. Deliberately no
-- INSERT/UPDATE policy: assignment happens server-side under the service role,
-- and a user who could write their own row could opt themselves out of the
-- holdout, which is precisely the selection bias the design exists to avoid.
alter table public.experiment_assignments enable row level security;

drop policy if exists experiment_assignments_own on public.experiment_assignments;
create policy experiment_assignments_own
  on public.experiment_assignments
  for select
  using (user_id = auth.uid());

comment on table public.experiment_assignments is
  'Randomized experiment assignment, one row per (user, experiment). Stable for the life of the user.';
