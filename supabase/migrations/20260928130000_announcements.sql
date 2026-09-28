-- Broadcast push: one row per announcement, delivered by the minute sweep.
--
-- Why a table and not an endpoint: a broadcast cannot be recalled. Making the
-- trigger a row an operator inserts with SQL — rather than an HTTP call guarded
-- by a shared header — means firing one is a deliberate, reviewable act, and the
-- same row records what was sent and how it went.
--
-- Delivery is spread across ticks (ANNOUNCE_BATCH per pass). Each recipient is
-- claimed by a per-user dedup key in notification_deliveries, so a pass killed
-- half-way is harmless: the next tick reaches exactly the accounts that were
-- missed, and nobody receives the same announcement twice.

create table if not exists "announcements" (
  "id"           uuid        primary key default gen_random_uuid(),
  -- Stable identity for the dedup key. Changing a slug re-sends to everyone, so
  -- treat it as immutable once the row is active.
  "slug"         text        not null unique,
  "title"        text        not null,
  "body"         text        not null,
  -- 'opted_in' = accounts that explicitly enabled push.
  -- 'all'      = also accounts that never expressed a preference.
  -- Neither reaches an account that explicitly turned push OFF.
  "audience"     varchar(16) not null default 'opted_in',
  "status"       varchar(16) not null default 'active',
  "sent_count"   integer     not null default 0,
  "failed_count" integer     not null default 0,
  "created_at"   timestamptz not null default now(),
  "updated_at"   timestamptz not null default now(),
  constraint "announcements_audience_chk" check ("audience" in ('opted_in', 'all')),
  constraint "announcements_status_chk"   check ("status" in ('active', 'paused', 'done'))
);

-- The sweep asks for the oldest active row on every tick, once a minute forever.
create index if not exists "announcements_active_idx"
  on "announcements" ("created_at") where "status" = 'active';

-- RLS with NO policies, which is the point: every table in this schema is
-- exposed through PostgREST, so a table left unguarded is readable by anyone
-- holding the publishable anon key. Nothing client-side has any business
-- reading or writing announcements. The edge function connects as `postgres`
-- and bypasses RLS, so the sweep is unaffected.
alter table "announcements" enable row level security;
