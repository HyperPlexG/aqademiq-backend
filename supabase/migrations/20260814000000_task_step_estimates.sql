-- Task steps: give a step its own time estimate.
--
-- `breakdown` already asked the model to split the parent's duration across the
-- steps, then dropped the answer on the floor: the rows carried only a title and
-- an order, and the API serialised every step as `duration_seconds: 0`. So the
-- one number that makes a breakdown actionable — "this bit is 20 minutes, that
-- bit is 5" — was computed and discarded on every call.
--
-- `description` already exists on the table and was never written by breakdown.
-- It is the natural home for the one-line "what this step actually involves"
-- that separates a real breakdown from a restatement of the title, so it starts
-- being populated rather than gaining a duplicate column.

alter table public.task_steps
  add column if not exists estimated_seconds integer;

comment on column public.task_steps.estimated_seconds is
  'Planned length of this step in seconds. Null when unknown; the sum is not required to equal the parent task''s estimate.';

-- Guards the obvious nonsense (negative time) and a step longer than a day,
-- which is a parsing bug rather than a plan.
alter table public.task_steps
  drop constraint if exists task_steps_estimated_seconds_check;
alter table public.task_steps
  add constraint task_steps_estimated_seconds_check
  check (estimated_seconds is null or (estimated_seconds >= 0 and estimated_seconds <= 86400));
