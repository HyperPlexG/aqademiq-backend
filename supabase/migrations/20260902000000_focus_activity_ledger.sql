-- Focus sessions join the activity ledger, and the history is repaired.
--
-- `daily_activity_snapshots` is the only table anything reads to answer "did
-- this day happen": streaks, the activity calendar, and the weekly report all
-- derive from it. Two things wrote to it — a task being completed and a mood
-- check-in — and a focus session wrote nothing. A session linked to no task did
-- not even reach it indirectly, because focus.service.ts only called
-- `tasksService.setDone` when `task_id` was set, and 67% of completed sessions
-- on production are unlinked.
--
-- Measured here before this ran: of the 48 days on which someone finished a
-- focus session, 31 had no ledger row, across 23 users. Two thirds of real
-- focus days were invisible, and a weekly report drawn from the ledger would
-- have told those students nothing happened on days they worked.
--
-- The service change stops it happening again. This file repairs what already
-- happened, because the first report a student opens covers a week that is
-- already in the past.

-- 1. Backfill. Written as an upsert over the full aggregate rather than an
--    insert over the missing rows, so it also fills focus_minutes_total and
--    focus_session_count — columns that have existed since the baseline schema
--    and were set on exactly zero rows.
--
--    `greatest` rather than plain assignment makes it safe to run twice: a
--    re-run recomputes the same totals from the same source and cannot inflate
--    a counter that live traffic has since moved past.
with agg as (
  select
    user_id,
    (started_at at time zone 'UTC')::date as activity_date,
    coalesce(sum(actual_duration_mins), 0)::int as focus_minutes_total,
    count(*)::int as focus_session_count
  from public.focus_sessions
  where was_completed
  group by 1, 2
)
insert into public.daily_activity_snapshots
  (user_id, activity_date, focus_minutes_total, focus_session_count)
select user_id, activity_date, focus_minutes_total, focus_session_count
from agg
on conflict (user_id, activity_date) do update set
  focus_minutes_total = greatest(
    public.daily_activity_snapshots.focus_minutes_total,
    excluded.focus_minutes_total
  ),
  focus_session_count = greatest(
    public.daily_activity_snapshots.focus_session_count,
    excluded.focus_session_count
  ),
  updated_at = now();

-- 2. The weekly report names the tasks someone finished, which is a read of
--    `completed_at` inside a window, per user. Every other index on `tasks` is
--    either the whole-table `user_id` btree or a status/date column on its own,
--    so without this the report filters a user's entire task history in memory
--    to find one week. Partial because a task that was never completed can
--    never match.
create index if not exists tasks_user_completed_at_idx
  on public.tasks (user_id, completed_at desc)
  where completed_at is not null;

comment on column public.daily_activity_snapshots.focus_minutes_total is
  'Minutes studied that day, summed across completed focus sessions. Written by focus.service.ts complete().';
comment on column public.daily_activity_snapshots.focus_session_count is
  'Completed focus sessions that day. Written by focus.service.ts complete().';
