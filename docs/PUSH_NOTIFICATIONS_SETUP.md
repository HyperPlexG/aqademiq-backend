# Push Notifications — Setup Guide

Full push (FCM for Android, APNs for iOS via Firebase). Cost: **$0** — FCM is free
and unlimited; APNs is free under the Apple Developer membership you already have.
Do **not** upgrade Firebase to the Blaze plan; FCM works on the free Spark plan.

Delivery transport is FCM for both platforms (Firebase proxies iOS → APNs once you
upload an APNs key), so the client uses a single SDK (`firebase_messaging`).

---

## 1. Firebase project (you)

1. https://console.firebase.google.com → **Add project** → name it `Aqademiq`
   (disable Google Analytics — not needed). Stay on the free **Spark** plan.
2. **Add an Android app**
   - Package name: **`com.r13.aqademiq`** — this must match the Android `applicationId`,
     which is currently `com.r13.aqademiq` (`android/app/build.gradle.kts`).
   - ⚠️ Unresolved from earlier: the Play Store listing is registered under
     `com.aqademiq.aqademiq`. If you revert the `applicationId` back to that for Play,
     the Firebase Android app package must match — add **both** package names to the
     same Firebase project (Firebase supports multiple Android apps) so either build
     works, or settle the package first.
   - Download **`google-services.json`** → it goes in `android/app/`.
3. **Add an iOS app**
   - Bundle ID: `com.r13.aqademiq`
   - Download **`GoogleService-Info.plist`** → it goes in `ios/Runner/`.

> ⚠️ Send me both files (or drop them in place). The frontend wiring is **on hold
> until these exist** — adding the Firebase Gradle plugin without `google-services.json`
> breaks the Android build, and I don't want to break your current TestFlight build.

## 2. APNs auth key (you) — enables iOS delivery

1. https://developer.apple.com/account → **Certificates, IDs & Profiles → Keys → +**
2. Name `Aqademiq APNs`, tick **Apple Push Notifications service (APNs)**, Continue → Register.
3. **Download the `.p8`** (one-time download) and note the **Key ID**. Also note your
   **Team ID** (top-right of the developer portal).
4. Firebase Console → Project Settings → **Cloud Messaging** → **Apple app config** →
   **APNs Authentication Key** → upload the `.p8` + Key ID + Team ID.

## 3. Backend secrets (you) — wakes up the dormant sender

The backend push sender (`supabase/functions/_shared/push.ts`) stays in
`skipped_no_provider` mode until these are set.

1. Firebase Console → Project Settings → **Service accounts** → **Generate new private
   key** → downloads a JSON.
2. From that JSON, set three Supabase Function secrets (Dashboard → Project Settings →
   Edge Functions → Secrets, or CLI):
   ```bash
   supabase secrets set \
     FCM_PROJECT_ID="<project_id from JSON>" \
     FCM_CLIENT_EMAIL="<client_email from JSON>" \
     FCM_PRIVATE_KEY="<private_key from JSON, keep the \n escapes>"
   ```
3. Also set a shared secret the cron job uses to call the sweep:
   ```bash
   supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
   ```
   Keep this value — you paste it into the pg_cron SQL in step 5.

## 4. Deploy the backend

The reminder scheduler is already coded:
- `supabase/migrations/20260720010000_notification_deliveries.sql` — delivery ledger.
- `notifications.service.ts` → `runReminderSweep()` — finds due `tasks.reminder_at`
  reminders for users with push + before-task enabled and a registered device, sends
  once (race-safe dedup), records the result.
- `index.ts` → `POST /cron/notifications` — system-wide sweep, gated by `x-cron-secret`.

Apply + deploy:
```bash
cd aqademiq-backend
npm install && npm run prisma:generate     # generates the gitignored Deno edge client
supabase db push                           # applies the new migration
supabase functions deploy api
```

## 5. Schedule the sweep (you) — pg_cron

In **Supabase Dashboard → SQL Editor**, enable the extensions (Database → Extensions,
or run the `create extension` lines), then schedule the minute sweep. Replace
`<CRON_SECRET>` with the value from step 3:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'aqademiq-reminder-sweep',
  '* * * * *',                              -- every minute
  $$
  select net.http_post(
    url := 'https://qwvuoooentacjslzpbqy.supabase.co/functions/v1/api/v1/cron/notifications',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```
To change/remove later: `select cron.unschedule('aqademiq-reminder-sweep');`

## 6. Frontend integration (me, after step 1)

Once `google-services.json` + `GoogleService-Info.plist` are in place I will add:
- `firebase_core`, `firebase_messaging`, `flutter_local_notifications` to pubspec.
- A `PushService`: request permission → get FCM token → `POST /devices` → refresh on
  rotate; foreground handler shows a local notification; tap opens the task.
- Android: `google-services` Gradle plugin + `POST_NOTIFICATIONS` permission (Android 13+).
- iOS: Push Notifications + Background Modes (remote notifications) capability in Xcode,
  APNs entitlement.

## Testing end-to-end
1. Run the app on a **real device** (push doesn't work on the iOS simulator), grant the
   permission prompt → the device registers via `POST /devices`.
2. `POST /me/notifications/test` (with your bearer token) → immediate test push.
3. Create a task with a `reminder_at` a couple of minutes out → the pg_cron sweep
   delivers it within ~1 minute of the time.

## Notes / follow-ups
- The sweep covers **before-task** reminders (`tasks.reminder_at`) and, when enabled,
  Ada's proactive check-ins (below). Weekly review is still a follow-up.
- APNs-direct (no Firebase) is intentionally not used; routing iOS through FCM keeps a
  single client SDK and a single backend sender.

## 6. Ada's proactive check-ins (opt-in)

The same minute sweep also runs `agent/proactive.ts`, which lets Ada start a
conversation instead of only answering one. **It is off by default** — a system
that messages real users unprompted should be switched on deliberately, not by a
deploy. No new cron entry is needed; it rides the schedule from step 5.

Set in **Supabase → Edge Functions → Secrets**:

| Secret | Default | What it does |
|---|---|---|
| `ADA_NUDGES_ENABLED` | *(off)* | `1` turns proactive check-ins on. Nothing runs without it. |
| `ADA_NUDGE_ONLY_USERS` | *(unset)* | Comma-separated user ids. When set, **only** those users get check-ins — everyone else is skipped. Use it to try the feature on one account before widening. Set-but-invalid nudges nobody, never everybody. |
| `ADA_NUDGE_DAILY_CAP` | `50` | Hard ceiling on agent runs per day across **all** users. The main cost control. |
| `ADA_NUDGE_DEADLINE_MS` | `18000` | Wall-clock budget for one check-in run. |
| `ADA_NUDGE_MAX_CALLS` | `4` | Provider calls one check-in may make. |

How a check-in is decided, cheapest test first:

1. Is the user within 15 minutes of their `morning_checkin_time` or
   `evening_review_time` **in their own timezone**, with push enabled and a
   device token? (One indexed query for all users; returns nothing on almost
   every one of the day's 1,440 sweeps.)
2. Do they actually have something worth saying — work due within 3 days, or
   overdue? If not, Ada stays quiet. A check-in with nothing to check in on
   teaches people to ignore the notification.
3. Do they already have proposals waiting for a decision? If so, skip; don't pile on.
4. Win the atomic claim in `notification_deliveries`
   (`nudge:<user>:<local-date>:<kind>`), which caps it at one per kind per user
   per day and makes overlapping sweeps safe.

Only then does the agent run. Its reply is saved as a real Ada message (with any
proposed changes attached as normal confirmation cards) and a short form is
pushed. The message is persisted **before** the push, so a delivery failure still
leaves it waiting in the app.

Roll it out narrowly first. `ADA_NUDGES_ENABLED=1` alone means every eligible
user hears from Ada on the next minute tick, before anyone has read a single
generated message — set `ADA_NUDGE_ONLY_USERS` to your own id, read a few, then
widen or unset it.

Turning it off is just removing `ADA_NUDGES_ENABLED`; in-flight state is only ever
one sweep deep.

To watch what it costs:

```sql
select date_trunc('day', created_at) as day, status, count(*)
from notification_deliveries where kind = 'ada_nudge'
group by 1, 2 order by 1 desc;
```
