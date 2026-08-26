-- Two classes of missing index: one hot path, and 27 unindexed foreign keys.
--
-- 1. tasks(reminder_at). The pg_cron reminder sweep runs every minute and
--    selects on reminder_at. With no index that is a full scan of `tasks`, 1440
--    times a day, and it grows with every task any user ever creates.
--
-- 2. Unindexed FK columns. Postgres indexes the PRIMARY key side of a foreign
--    key automatically but never the REFERENCING side, so each of these costs a
--    sequential scan on join — and, worse, on cascade: deleting one parent row
--    scans the whole child table to find dependents. Account deletion touches
--    most of these at once.
--
-- Plain CREATE INDEX rather than CONCURRENTLY: this runs inside the migration
-- transaction, and at 36 MB every table here builds in well under a second. If
-- these tables grow past a few hundred MB, later index work should switch to
-- CONCURRENTLY and run outside a transaction.

-- ---- 1. the minute-by-minute reminder sweep -------------------------------
-- Partial: only rows with a reminder set are ever candidates, and most are null.
create index if not exists idx_tasks_reminder_at
  on tasks (reminder_at)
  where reminder_at is not null;

-- ---- 2. foreign keys, by table --------------------------------------------
create index if not exists idx_ada_agent_runs_trigger_message_id       on ada_agent_runs (trigger_message_id);
create index if not exists idx_ada_generated_plan_items_task_id        on ada_generated_plan_items (task_id);
create index if not exists idx_ada_pending_actions_message_id          on ada_pending_actions (message_id);
create index if not exists idx_ada_sessions_course_id                  on ada_sessions (course_id);
create index if not exists idx_ada_sessions_task_id                    on ada_sessions (task_id);
create index if not exists idx_calendar_connections_user_id            on calendar_connections (user_id);
create index if not exists idx_calendar_events_task_id                 on calendar_events (task_id);
create index if not exists idx_changelog_entries_source_post           on changelog_entries (source_post);
create index if not exists idx_device_profiles_user_id                 on device_profiles (user_id);
create index if not exists idx_feedback_admin_notes_author_id          on feedback_admin_notes (author_id);
create index if not exists idx_feedback_admin_notes_post_id            on feedback_admin_notes (post_id);
create index if not exists idx_feedback_comment_reactions_user_id      on feedback_comment_reactions (user_id);
create index if not exists idx_feedback_comments_author_id             on feedback_comments (author_id);
create index if not exists idx_feedback_comments_parent_id             on feedback_comments (parent_id);
create index if not exists idx_feedback_posts_author_id                on feedback_posts (author_id);
create index if not exists idx_feedback_posts_merged_into              on feedback_posts (merged_into);
create index if not exists idx_feedback_status_changes_actor_id        on feedback_status_changes (actor_id);
create index if not exists idx_feedback_subscriptions_user_id          on feedback_subscriptions (user_id);
create index if not exists idx_feedback_votes_user_id                  on feedback_votes (user_id);
create index if not exists idx_focus_sessions_course_id                on focus_sessions (course_id);
create index if not exists idx_focus_sessions_prism_preset_id          on focus_sessions (prism_preset_id);
create index if not exists idx_mood_checkins_focus_session_id          on mood_checkins (focus_session_id);
create index if not exists idx_prism_audio_profiles_default_preset_id  on prism_audio_profiles (default_preset_id);
create index if not exists idx_profiles_referred_by                    on profiles (referred_by);
create index if not exists idx_referral_redemptions_referral_code_id   on referral_redemptions (referral_code_id);
create index if not exists idx_share_events_task_id                    on share_events (task_id);
create index if not exists idx_task_tag_links_tag_id                   on task_tag_links (tag_id);
