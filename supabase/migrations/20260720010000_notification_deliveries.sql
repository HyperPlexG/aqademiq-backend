-- Notification scheduler: delivery ledger.
--
-- The reminder sweep (POST /api/v1/cron/notifications, triggered by pg_cron)
-- claims a row here BEFORE sending, keyed by a unique `dedup_key`, so a task
-- reminder is delivered exactly once even if two sweeps overlap. Accessed via
-- raw SQL from notifications.service.ts (not a Prisma model — keeps the edge
-- client schema unchanged).
create table if not exists "notification_deliveries" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kind" varchar(40) not null,          -- 'before_task' | 'morning_checkin' | ...
    "task_id" uuid,                        -- set for task reminders
    "dedup_key" text not null,             -- e.g. 'before_task:<task_id>'
    "status" varchar(20) not null,         -- 'pending'|'sent'|'failed'|'skipped_no_provider'|'unsupported_provider'
    "provider_message_id" text,
    "error" text,
    "created_at" timestamptz not null default current_timestamp,
    constraint "notification_deliveries_pkey" primary key ("id")
);

create unique index if not exists "notification_deliveries_dedup_key_key"
    on "notification_deliveries" ("dedup_key");
create index if not exists "notification_deliveries_user_id_idx"
    on "notification_deliveries" ("user_id");
create index if not exists "notification_deliveries_created_at_idx"
    on "notification_deliveries" ("created_at");
