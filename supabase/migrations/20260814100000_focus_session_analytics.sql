-- focus_sessions: the two columns the Prism analytics design needs and the
-- table never had.
--
-- Everything else the analytics are blocked on (ended_at, actual_duration_mins,
-- course_id, paused_duration_mins, interruption_count) already has a column —
-- the write path simply never filled it. Measured on production before this
-- landed, over 84 rows / 47 completed:
--
--   ended_at set ............  0    (never written by complete())
--   course_id set ...........  0    (never derived from the task)
--   paused_duration_mins .... 0 rows non-zero
--   interruption_count ...... 0 rows non-zero
--   completed with 0 mins ... 40 of 47
--
-- So this migration is deliberately small: SQL cannot recover study time that
-- was never recorded, and guessing it from planned_duration_mins would write
-- fiction into the very table the analytics are supposed to trust. The fix is
-- in focus.service.ts; this only adds what has nowhere to go today.

alter table public.focus_sessions
  add column if not exists control_arm boolean not null default false;

alter table public.focus_sessions
  add column if not exists engine_version text;

comment on column public.focus_sessions.control_arm is
  'true = Prism actuation was cut for this session (control arm of the holdout).';
comment on column public.focus_sessions.engine_version is
  'Prism engine build that ran this session. Null for sessions with no audio.';

-- The analytics read completed sessions in a date window, per user. Without
-- this every Effective-Focus-Minutes query is a seq scan over the whole table.
create index if not exists focus_sessions_user_completed_started_idx
  on public.focus_sessions (user_id, started_at desc)
  where was_completed;
