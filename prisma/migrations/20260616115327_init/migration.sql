-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_guest" BOOLEAN NOT NULL DEFAULT true,
    "active_semester_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" TEXT NOT NULL,
    "name" TEXT,
    "gender" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "university" TEXT,
    "program" TEXT,
    "avatar_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "family_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reset_code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_sub" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "color_hex" TEXT NOT NULL,
    "credits" DOUBLE PRECISION,
    "prof" TEXT NOT NULL DEFAULT '',
    "target_grade" TEXT NOT NULL DEFAULT '',
    "mood" INTEGER NOT NULL DEFAULT 2,
    "files_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_files" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "s3_key" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "scan_status" TEXT NOT NULL DEFAULT 'none',
    "ocr_status" TEXT NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "subject_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_series" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL DEFAULT 300,
    "scheduled_at" TEXT,
    "category" TEXT,
    "anchor_date" DATE NOT NULL,
    "repeat_kind" TEXT NOT NULL DEFAULT 'none',
    "repeat_interval" INTEGER NOT NULL DEFAULT 1,
    "until_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "task_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occurrence_overrides" (
    "series_id" TEXT NOT NULL,
    "occurrence_date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT,
    "scheduled_at" TEXT,
    "moved_to_date" DATE,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occurrence_overrides_pkey" PRIMARY KEY ("series_id","occurrence_date")
);

-- CreateTable
CREATE TABLE "task_steps" (
    "id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "occurrence_date" DATE,
    "title" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "order_idx" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood_index" INTEGER,
    "intention" TEXT,
    "reflection" TEXT,

    CONSTRAINT "mood_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "study_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "planned_min" INTEGER NOT NULL DEFAULT 25,
    "elapsed_sec" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "prism_mode" TEXT,
    "task_id" TEXT,
    "task_date" DATE,
    "mood_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ada_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ada_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ada_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "is_user" BOOLEAN NOT NULL,
    "text" TEXT,
    "plan" JSONB,
    "plan_footer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ada_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "push_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token_provider" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'granted',
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "channel_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "code" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_identities_provider_provider_sub_key" ON "oauth_identities"("provider", "provider_sub");

-- CreateIndex
CREATE UNIQUE INDEX "mood_entries_user_id_date_key" ON "mood_entries"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "study_tags_user_id_label_key" ON "study_tags"("user_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "activity_events_user_id_source_ref_id_key" ON "activity_events"("user_id", "source", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_idempotency_key_key" ON "notification_logs"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_owner_user_id_key" ON "referrals"("owner_user_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_files" ADD CONSTRAINT "subject_files_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_series" ADD CONSTRAINT "task_series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_series" ADD CONSTRAINT "task_series_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occurrence_overrides" ADD CONSTRAINT "occurrence_overrides_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "task_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "task_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_entries" ADD CONSTRAINT "mood_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_tags" ADD CONSTRAINT "study_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ada_conversations" ADD CONSTRAINT "ada_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ada_messages" ADD CONSTRAINT "ada_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ada_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
