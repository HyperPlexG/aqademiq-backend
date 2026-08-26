-- Evaluate auth.uid() once per query instead of once per row.
--
-- `user_id = auth.uid()` makes Postgres treat auth.uid() as a volatile function
-- of the row, so it is re-executed for EVERY row the scan touches. Wrapping it
-- in a scalar subquery turns it into an InitPlan: evaluated a single time, and
-- the result reused for the whole scan. Supabase's own performance advisor
-- flags the unwrapped form as `auth_rls_initplan`; it had 41 hits here, one for
-- every policy in this file.
--
-- This is purely an evaluation-strategy change. The predicate is identical, so
-- no policy grants or revokes access it did not before. ALTER (not DROP/CREATE)
-- is deliberate: it keeps each policy's name, role and command untouched, and
-- never leaves a table momentarily without a policy.

-- ---- owned directly by user_id, one ALL policy ----------------------------
alter policy academic_terms_own            on academic_terms            using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy ada_agent_runs_own            on ada_agent_runs            using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy ada_memories_own              on ada_memories              using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy ada_pending_actions_own       on ada_pending_actions       using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy ada_sessions_own              on ada_sessions              using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy analytics_snapshots_own       on analytics_snapshots       using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy calendar_connections_own      on calendar_connections      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy calendar_events_own           on calendar_events           using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy courses_own                   on courses                   using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy daily_activity_snapshots_own  on daily_activity_snapshots  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy device_profiles_own           on device_profiles           using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy focus_sessions_own            on focus_sessions            using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy mood_checkins_own             on mood_checkins             using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy notification_preferences_own  on notification_preferences  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy prism_audio_profiles_own      on prism_audio_profiles      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy referral_codes_own            on referral_codes            using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy share_events_own              on share_events              using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy subject_materials_own         on subject_materials         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy tasks_own                     on tasks                     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy user_app_settings_own         on user_app_settings         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy user_profiles_own             on user_profiles             using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- owned via a differently-named column ---------------------------------
alter policy profiles_own              on profiles              using (id = (select auth.uid()))               with check (id = (select auth.uid()));
alter policy referral_redemptions_own  on referral_redemptions  using (referred_user_id = (select auth.uid())) with check (referred_user_id = (select auth.uid()));

-- ---- owned indirectly, through a parent row -------------------------------
-- The EXISTS shape stays; only the uid lookup inside it is hoisted.
alter policy ada_plan_items_own on ada_generated_plan_items
  using       (exists (select 1 from ada_sessions s where s.id = ada_generated_plan_items.ada_session_id and s.user_id = (select auth.uid())))
  with check  (exists (select 1 from ada_sessions s where s.id = ada_generated_plan_items.ada_session_id and s.user_id = (select auth.uid())));

alter policy ada_messages_own on ada_messages
  using       (exists (select 1 from ada_sessions s where s.id = ada_messages.ada_session_id and s.user_id = (select auth.uid())))
  with check  (exists (select 1 from ada_sessions s where s.id = ada_messages.ada_session_id and s.user_id = (select auth.uid())));

alter policy task_reschedule_own on task_reschedule_history
  using       (exists (select 1 from tasks where tasks.id = task_reschedule_history.task_id and tasks.user_id = (select auth.uid())))
  with check  (exists (select 1 from tasks where tasks.id = task_reschedule_history.task_id and tasks.user_id = (select auth.uid())));

alter policy task_steps_own on task_steps
  using       (exists (select 1 from tasks where tasks.id = task_steps.task_id and tasks.user_id = (select auth.uid())))
  with check  (exists (select 1 from tasks where tasks.id = task_steps.task_id and tasks.user_id = (select auth.uid())));

alter policy task_tag_links_own on task_tag_links
  using       (exists (select 1 from tasks where tasks.id = task_tag_links.task_id and tasks.user_id = (select auth.uid())))
  with check  (exists (select 1 from tasks where tasks.id = task_tag_links.task_id and tasks.user_id = (select auth.uid())));

-- ---- split per-command policies -------------------------------------------
-- Tag reads keep the `OR is_system` arm: the seeded system tags are readable by
-- everyone, and dropping that would empty the tag picker for every user.
alter policy study_tags_read   on study_tags using ((user_id = (select auth.uid())) or is_system);
alter policy study_tags_write  on study_tags with check (user_id = (select auth.uid()));
alter policy study_tags_update on study_tags using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy study_tags_delete on study_tags using (user_id = (select auth.uid()));

alter policy task_tags_read    on task_tags using ((user_id = (select auth.uid())) or is_system);
alter policy task_tags_write   on task_tags with check (user_id = (select auth.uid()));
alter policy task_tags_update  on task_tags using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy task_tags_delete  on task_tags using (user_id = (select auth.uid()));

alter policy app_feedback_read   on app_feedback using (user_id = (select auth.uid()));
alter policy app_feedback_insert on app_feedback with check (user_id = (select auth.uid()));

alter policy app_ratings_read   on app_ratings using (user_id = (select auth.uid()));
alter policy app_ratings_insert on app_ratings with check (user_id = (select auth.uid()));

-- Granted TO public rather than TO authenticated; ALTER leaves that as it was.
alter policy experiment_assignments_own on experiment_assignments using (user_id = (select auth.uid()));
