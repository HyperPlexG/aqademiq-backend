-- Make tasks.task_type free-form so the client's study-tag id round-trips.
--
-- Root cause of "tasks show under 'Other'": the app carries the selected study
-- tag in the wire `category` field, which maps to tasks.task_type. The CHECK
-- constraint `tasks_task_type_check` only permitted a fixed enum, so the service
-- coerced every real tag id to 'other' before insert — and the plan screen then
-- couldn't resolve the tag and rendered "Other". task_type is not used
-- semantically anywhere in the API, so relaxing it is safe.
alter table public.tasks
  drop constraint if exists tasks_task_type_check;
