-- Core schema baseline — the pre-2026-07-18 public schema of the live Supabase
-- project (xqnjquozcnwmogipowpf), generated from prisma/schema.prisma minus the
-- objects added by the two later migrations (feedback board, consent+age).
-- ALREADY APPLIED on the live project — for fresh environments only.
calendar_events-- Locally: apply scripts/dev-auth-shim.sql first (npm run db:bootstrap -- --local).

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "full_name" VARCHAR(255),
    "display_name" VARCHAR(100),
    "gender" VARCHAR(50),
    "date_of_birth" DATE,
    "avatar_url" TEXT,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "account_status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_step" SMALLINT NOT NULL DEFAULT 0,
    "referral_code" VARCHAR(50),
    "referred_by" UUID,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" DATE,
    "last_login_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "university" VARCHAR(255),
    "program" VARCHAR(255),
    "study_level" VARCHAR(100),
    "peak_time" VARCHAR(50),
    "daily_focus_goal_mins" INTEGER NOT NULL DEFAULT 60,
    "focus_duration_mins" INTEGER NOT NULL DEFAULT 25,
    "break_duration_mins" INTEGER NOT NULL DEFAULT 5,
    "haptics_enabled" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_completed_at" TIMESTAMPTZ,
    "referral_code_used" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_app_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "appearance" VARCHAR(20) NOT NULL DEFAULT 'system',
    "accent_color" VARCHAR(7) NOT NULL DEFAULT '#6b5cf0',
    "subjects_layout" VARCHAR(20) NOT NULL DEFAULT 'list',
    "focus_timer_style" VARCHAR(50) NOT NULL DEFAULT 'ice_melt',
    "haptics_enabled" BOOLEAN NOT NULL DEFAULT true,
    "play_prism_in_focus" BOOLEAN NOT NULL DEFAULT true,
    "in_app_sounds_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_create_task_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_complete_task_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_task_countdown_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_subtask_complete_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "before_task_enabled" BOOLEAN NOT NULL DEFAULT true,
    "when_task_starts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "halfway_through_enabled" BOOLEAN NOT NULL DEFAULT false,
    "when_task_finished_enabled" BOOLEAN NOT NULL DEFAULT false,
    "morning_checkin_enabled" BOOLEAN NOT NULL DEFAULT true,
    "morning_checkin_time" TIME NOT NULL DEFAULT '08:00:00'::time without time zone,
    "evening_review_enabled" BOOLEAN NOT NULL DEFAULT true,
    "evening_review_time" TIME NOT NULL DEFAULT '20:00:00'::time without time zone,
    "weekly_review_enabled" BOOLEAN NOT NULL DEFAULT true,
    "weekly_review_day" SMALLINT NOT NULL DEFAULT 0,
    "weekly_review_time" TIME NOT NULL DEFAULT '15:00:00'::time without time zone,
    "state_of_mind_reminder" BOOLEAN NOT NULL DEFAULT true,
    "motivational_enabled" BOOLEAN NOT NULL DEFAULT true,
    "product_updates_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notification_sound" VARCHAR(100) NOT NULL DEFAULT 'Chime',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT,
    "token_expires_at" TIMESTAMPTZ,
    "calendar_email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_name" VARCHAR(255),
    "device_type" VARCHAR(100),
    "push_token" TEXT,
    "biometric_sync" BOOLEAN NOT NULL DEFAULT false,
    "registered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "term_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50),
    "professor" VARCHAR(255),
    "color" VARCHAR(7),
    "credits" DECIMAL(4,1),
    "grade_system" VARCHAR(20) NOT NULL DEFAULT 'letter',
    "target_grade_text" VARCHAR(20),
    "target_gpa" DECIMAL(3,2),
    "target_percentage" DECIMAL(5,2),
    "current_gpa" DECIMAL(3,2),
    "current_percentage" DECIMAL(5,2),
    "subject_feeling" SMALLINT,
    "syllabus_status" VARCHAR(30) NOT NULL DEFAULT 'missing',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "material_type" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(500),
    "file_url" TEXT,
    "mime_type" VARCHAR(255),
    "file_size_bytes" BIGINT,
    "processing_status" VARCHAR(30) NOT NULL DEFAULT 'uploaded',
    "extracted_text" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "label" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID,
    "parent_task_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "task_type" VARCHAR(50) NOT NULL DEFAULT 'assignment',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "planner_section" VARCHAR(20) NOT NULL DEFAULT 'anytime',
    "scheduled_start_at" TIMESTAMPTZ,
    "scheduled_end_at" TIMESTAMPTZ,
    "due_at" TIMESTAMPTZ,
    "estimated_duration_mins" INTEGER,
    "actual_duration_mins" INTEGER,
    "reminder_at" TIMESTAMPTZ,
    "repeat_rule" TEXT,
    "is_micro_task" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tag_links" (
    "task_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_tag_links_pkey" PRIMARY KEY ("task_id","tag_id")
);

-- CreateTable
CREATE TABLE "task_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reschedule_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "old_scheduled_start_at" TIMESTAMPTZ,
    "old_scheduled_end_at" TIMESTAMPTZ,
    "new_scheduled_start_at" TIMESTAMPTZ,
    "new_scheduled_end_at" TIMESTAMPTZ,
    "reason" TEXT,
    "changed_by" VARCHAR(30) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reschedule_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prism_presets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prism_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prism_audio_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "default_preset_id" UUID,
    "volume_level" SMALLINT NOT NULL DEFAULT 50,
    "adaptive_audio" BOOLEAN NOT NULL DEFAULT true,
    "play_in_focus" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prism_audio_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "course_id" UUID,
    "prism_preset_id" UUID,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "planned_duration_mins" INTEGER,
    "actual_duration_mins" INTEGER,
    "paused_duration_mins" INTEGER NOT NULL DEFAULT 0,
    "interruption_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'completed',
    "was_completed" BOOLEAN NOT NULL DEFAULT false,
    "mood_before" SMALLINT,
    "mood_after" SMALLINT,
    "session_rating" SMALLINT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_checkins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "focus_session_id" UUID,
    "checkin_type" VARCHAR(30) NOT NULL,
    "mood_score" SMALLINT NOT NULL,
    "mood_label" VARCHAR(50),
    "note" TEXT,
    "checkin_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "focus_minutes_total" INTEGER NOT NULL DEFAULT 0,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "tasks_created" INTEGER NOT NULL DEFAULT 0,
    "productivity_score" DECIMAL(5,2),
    "session_count" INTEGER NOT NULL DEFAULT 0,
    "avg_mood" DECIMAL(4,2),
    "streak_at_snapshot" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_activity_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_date" DATE NOT NULL,
    "focus_minutes_total" INTEGER NOT NULL DEFAULT 0,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "tasks_created" INTEGER NOT NULL DEFAULT 0,
    "mood_score_avg" DECIMAL(4,2),
    "focus_session_count" INTEGER NOT NULL DEFAULT 0,
    "streak_day_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_activity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ada_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID,
    "task_id" UUID,
    "session_type" VARCHAR(50) NOT NULL DEFAULT 'general',
    "title" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "context" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ada_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ada_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ada_session_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "model" VARCHAR(100),
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ada_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ada_generated_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ada_session_id" UUID NOT NULL,
    "task_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "planned_start_at" TIMESTAMPTZ,
    "planned_end_at" TIMESTAMPTZ,
    "status" VARCHAR(30) NOT NULL DEFAULT 'suggested',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ada_generated_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_connection_id" UUID NOT NULL,
    "user_id" UUID,
    "task_id" UUID,
    "external_event_id" VARCHAR(500),
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "is_all_day" BOOLEAN NOT NULL DEFAULT false,
    "event_source" VARCHAR(30) NOT NULL DEFAULT 'external',
    "sync_status" VARCHAR(30) NOT NULL DEFAULT 'synced',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_code_id" UUID NOT NULL,
    "referred_user_id" UUID NOT NULL,
    "redeemed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "share_type" VARCHAR(50) NOT NULL,
    "task_id" UUID,
    "channel" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "rating" SMALLINT NOT NULL,
    "platform" VARCHAR(20),
    "app_version" VARCHAR(50),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "feedback_type" VARCHAR(50) NOT NULL DEFAULT 'general',
    "text" TEXT NOT NULL,
    "platform" VARCHAR(20),
    "app_version" VARCHAR(50),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_referral_code_key" ON "profiles"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_app_settings_user_id_key" ON "user_app_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_user_id_name_key" ON "academic_terms"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "prism_presets_name_key" ON "prism_presets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "prism_audio_profiles_user_id_key" ON "prism_audio_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_user_id_week_start_key" ON "analytics_snapshots"("user_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "daily_activity_snapshots_user_id_activity_date_key" ON "daily_activity_snapshots"("user_id", "activity_date");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_user_id_key" ON "referral_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_redemptions_referred_user_id_key" ON "referral_redemptions"("referred_user_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_materials" ADD CONSTRAINT "subject_materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tag_links" ADD CONSTRAINT "task_tag_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tag_links" ADD CONSTRAINT "task_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "task_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reschedule_history" ADD CONSTRAINT "task_reschedule_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prism_audio_profiles" ADD CONSTRAINT "prism_audio_profiles_default_preset_id_fkey" FOREIGN KEY ("default_preset_id") REFERENCES "prism_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_prism_preset_id_fkey" FOREIGN KEY ("prism_preset_id") REFERENCES "prism_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_focus_session_id_fkey" FOREIGN KEY ("focus_session_id") REFERENCES "focus_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ada_sessions" ADD CONSTRAINT "ada_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ada_sessions" ADD CONSTRAINT "ada_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ada_messages" ADD CONSTRAINT "ada_messages_ada_session_id_fkey" FOREIGN KEY ("ada_session_id") REFERENCES "ada_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ada_generated_plan_items" ADD CONSTRAINT "ada_generated_plan_items_ada_session_id_fkey" FOREIGN KEY ("ada_session_id") REFERENCES "ada_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ada_generated_plan_items" ADD CONSTRAINT "ada_generated_plan_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_connection_id_fkey" FOREIGN KEY ("calendar_connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

