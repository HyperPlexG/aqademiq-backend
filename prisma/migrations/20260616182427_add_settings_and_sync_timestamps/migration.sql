-- AlterTable
ALTER TABLE "mood_entries" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "semesters" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "study_tags" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "task_series" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "settings_prefs" (
    "user_id" TEXT NOT NULL,
    "theme_mode" TEXT NOT NULL DEFAULT 'system',
    "prism_default_mode" TEXT,
    "notification_sound" TEXT NOT NULL DEFAULT 'Chime',
    "notification_time" TEXT NOT NULL DEFAULT '07:00',
    "notification_time_morning" TEXT NOT NULL DEFAULT '08:00',
    "notification_time_review" TEXT NOT NULL DEFAULT '20:00',
    "daily_focus_goal_min" INTEGER NOT NULL DEFAULT 120,
    "work_best_times" JSONB,
    "education_level" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_prefs_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "email_preferences" (
    "user_id" TEXT NOT NULL,
    "product_updates" BOOLEAN NOT NULL DEFAULT true,
    "study_tips" BOOLEAN NOT NULL DEFAULT true,
    "offers" BOOLEAN NOT NULL DEFAULT false,
    "surveys" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notification_channel_prefs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "send_time" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_channel_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_channel_prefs_user_id_channel_key_key" ON "notification_channel_prefs"("user_id", "channel_key");

-- AddForeignKey
ALTER TABLE "settings_prefs" ADD CONSTRAINT "settings_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_channel_prefs" ADD CONSTRAINT "notification_channel_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
