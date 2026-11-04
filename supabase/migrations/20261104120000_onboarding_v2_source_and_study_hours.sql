-- Onboarding v2 (design v11): "How did you hear about us?" and Study hours.
--
-- Both are answered once, in onboarding, and are additive: every column is
-- nullable with no default, so existing rows and the v1 app are untouched.
--
--   heard_from        the chip picked on ob-source (a slug, see
--                     onboarding.service.ts HEARD_FROM), or null when skipped
--   heard_from_other  the optional "A word or two is plenty." text for Other
--   study_days        ISO weekdays, 1 = Monday … 7 = Sunday (ob-hours)
--   study_from_min    minutes after local midnight the study hours start
--   study_until_min   … and end; until <= from runs overnight
--
-- The study hours are also the phone's own App freeze frosts, but those live
-- on the device (the design promises "We never see your picks"); these
-- columns hold only the hours the student told Ada about, so the planner can
-- read them. Nothing about which apps are frozen is ever stored here.
--
-- The edge function writes these best-effort, after onboarding's transaction,
-- so deploying the function before this migration cannot break onboarding —
-- it only drops these answers until the migration is applied.

alter table public.user_profiles
  add column if not exists heard_from varchar(40),
  add column if not exists heard_from_other varchar(60),
  add column if not exists study_days smallint[],
  add column if not exists study_from_min smallint,
  add column if not exists study_until_min smallint;

alter table public.user_profiles
  drop constraint if exists user_profiles_study_from_min_check,
  add constraint user_profiles_study_from_min_check check (study_from_min is null or (study_from_min between 0 and 1439)),
  drop constraint if exists user_profiles_study_until_min_check,
  add constraint user_profiles_study_until_min_check check (study_until_min is null or (study_until_min between 0 and 1440)),
  drop constraint if exists user_profiles_study_days_check,
  add constraint user_profiles_study_days_check check (study_days is null or study_days <@ array[1,2,3,4,5,6,7]::smallint[]);
