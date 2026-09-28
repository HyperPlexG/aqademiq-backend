-- Server push: attribute each delivery to a device, and collapse the token pile.
--
-- Background (diagnosed on production 2026-09-28): the reminder sweep joined
-- device_profiles directly, so one due task fanned out to one row per registered
-- device. Every FCM token rotates on reinstall and nothing ever deleted the old
-- row, so one account had SEVEN tokens with six dead. All seven raced for the
-- same dedup_key, one won at random, and a 6-in-7 roll spent the reminder on a
-- dead token — after which the claim blocked any retry. That account received
-- nothing from 2026-08-16 onward while the database showed a registered device
-- and enabled preferences. Reproduced live, then fixed in
-- api/services/notifications.service.ts (newest device wins + prune on
-- UNREGISTERED).

-- 1. Which device a delivery actually went to.
--
-- Deliberately NOT a foreign key to device_profiles. The sweep now deletes a
-- device row at the moment FCM declares its token dead, which is exactly when
-- the failure is most worth being able to read back later; an FK would either
-- refuse the write or null out the one field that explains the failure. A plain
-- uuid keeps the history honest after the device is gone.
alter table "notification_deliveries"
  add column if not exists "device_id"   uuid,
  add column if not exists "device_type" varchar(32);

comment on column "notification_deliveries"."device_id" is
  'device_profiles.id this delivery was sent to. Intentionally not an FK: the row may be pruned when its token dies, and the attribution must survive that.';

-- 2. One-off: keep only the newest device row per user.
--
-- Rows other than the newest are now unreachable by the sweep (newest wins), so
-- they are dead weight — but POST /me/notifications/test still sends to every
-- registered device, which means each stale token produces a guaranteed failure
-- and makes a working test button look broken. 15 rows at time of writing.
--
-- Safe to delete this statement before applying if you would rather let the
-- runtime pruning clear them out as they fail.
delete from "device_profiles" d
where exists (
  select 1 from "device_profiles" n
  where n.user_id = d.user_id
    and (n.updated_at, n.id) > (d.updated_at, d.id)
);

-- 3. The sweep's per-user newest-device lookup and the retry's fallback lookup
--    both order by (user_id, updated_at desc). Small table today, but this runs
--    every minute for every user with a due reminder.
create index if not exists "device_profiles_user_updated_idx"
  on "device_profiles" ("user_id", "updated_at" desc);
