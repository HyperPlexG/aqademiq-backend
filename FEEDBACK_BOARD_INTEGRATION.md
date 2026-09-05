# Feedback & Roadmap Board — Wiring (Flutter → Backend)

How to connect the Flutter feedback/roadmap/changelog screens to the backend.
The app's API client (base URL, Supabase auth token, snake_case JSON) is already
wired — this doc covers the board's endpoints, payloads, and rules.

- **Base URL:** whatever the app already uses; all routes are under `/v1`.
- **Auth:** `Authorization: Bearer <supabase_access_token>` on **every** call
  (browsing included — guests have a token too).
- **Casing:** snake_case in and out.
- **IDs:** posts are addressed by their public **`ref`** (an int shown as `#ref`),
  not their internal id. Comment/changelog ids are plain ints.

### Guest rule (important)
Guests may **browse/read** everything. **Voting, posting, commenting, and
subscribing require a real (non-guest) account** — those return **403** for
guests with a message like `Create an account to vote`. Gate these actions in the
UI and prompt sign-up at the point of action.

---

## 1. Error envelope (all endpoints)

```json
{
  "status_code": 409,
  "error": "CONFLICT",
  "message": "This thread is locked",
  "path": "/v1/feedback/posts/12/comments",
  "timestamp": "2026-07-18T12:34:56.789Z"
}
```
Schema-validation errors (`400`) add an `errors` array of field messages.

| status_code | When |
|---|---|
| `400` | Bad/'unknown field / malformed body (has `errors[]`) |
| `401` | Missing/invalid bearer token |
| `403` | Guest attempting a write, or non-admin hitting an admin route |
| `404` | Unknown post `ref` / comment id |
| `409` | Commenting on a **locked** thread |
| `429` | Post rate-limit hit (max **2 new posts/day/user**) |

---

## 2. Shared response shapes

**Post**
```json
{
  "ref": 42,
  "title": "Dark mode for the Focus timer",
  "body": "Please add a dark theme…",
  "status": "planned",
  "category": "focus",
  "upvotes": 17,
  "comment_count": 3,
  "pinned": false,
  "locked": false,
  "approved": true,
  "you_voted": true,
  "author": { "id": "uuid", "name": "Jane", "avatar_url": null },
  "created_at": "2026-07-18T10:00:00Z",
  "updated_at": "2026-07-18T11:00:00Z"
}
```
`author` may be `null` (deleted account). `status`/`category` are keys from
`GET /feedback/meta`.

**Comment**
```json
{ "id": 5, "parent_id": null, "body": "Yes please!", "is_team": false,
  "author": { "id": "uuid", "name": "Jane", "avatar_url": null },
  "created_at": "2026-07-18T10:05:00Z" }
```
`is_team: true` → render the "Aqademiq team" badge + ice-cube avatar.
`parent_id` = the comment it replies to (single-level threading).

**Status-change** (public activity log)
```json
{ "id": 9, "from_status": "under_review", "to_status": "planned",
  "note": "On the roadmap for Q3", "actor": { "id":"uuid","name":"Team","avatar_url":null },
  "created_at": "2026-07-18T10:10:00Z" }
```

**Changelog entry**
```json
{ "id": 3, "title": "Dark mode shipped", "body": "Now available.",
  "source_post": 42, "published_at": "2026-07-18T12:00:00Z", "is_published": true }
```

---

## 3. Endpoints

### Read / browse (works for guests)

| Method | Path | Returns |
|---|---|---|
| GET | `/v1/feedback/meta` | `{ statuses:[{key,label,color,on_roadmap}], categories:[{key,label}] }` — use for filter pills + status colors |
| GET | `/v1/feedback/posts?sort=top\|new&status=&category=&q=&cursor=` | `{ posts:[Post], next_cursor }` |
| GET | `/v1/feedback/posts/{ref}` | `Post` + `you_subscribed` + `comments:[Comment]` + `status_history:[StatusChange]` |
| GET | `/v1/feedback/roadmap` | `{ groups:[{ status:{key,label,color}, posts:[Post] }] }` (on-roadmap statuses only) |
| GET | `/v1/feedback/similar?q={title}` | `{ similar:[{ref,title,upvotes,status}] }` — live duplicate hints for the composer |
| GET | `/v1/changelog` | `{ entries:[ChangelogEntry] }` (published only, newest first) |

**List query params:** `sort` = `top` (default, most upvoted) or `new`; `status`
and `category` are keys; `q` searches title+body; `cursor` is the opaque
`next_cursor` from the previous page (null when no more). Page size 20. Pinned
posts sort first.

### Write (require a real account — 403 for guests)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/v1/feedback/posts` | `{ title, body?, category? }` | created `Post` + `you_subscribed:true` + `similar:[…]` |
| POST | `/v1/feedback/posts/{ref}/vote` | — | `{ ref, upvotes, you_voted:true }` |
| DELETE | `/v1/feedback/posts/{ref}/vote` | — | `{ ref, upvotes, you_voted:false }` |
| POST | `/v1/feedback/posts/{ref}/comments` | `{ body, parent_id? }` | created `Comment` (409 if locked) |
| POST | `/v1/feedback/posts/{ref}/subscribe` | — | `{ ref, you_subscribed:true }` |
| DELETE | `/v1/feedback/posts/{ref}/subscribe` | — | `{ ref, you_subscribed:false }` |

- **Create post:** `title` 3–140 chars, `body` ≤ 5000, `category` a meta key.
  Author is auto-subscribed. Max **2 posts/day** → `429`.
- **Vote:** idempotent and **one-per-user, server-enforced** — double POST won't
  double-count. Treat `you_voted` + `upvotes` from the response as truth.

### Admin (only user ids in `FEEDBACK_ADMIN_IDS` — else 403)

| Method | Path | Body |
|---|---|---|
| PATCH | `/v1/admin/feedback/posts/{ref}` | any of `{ status?, category?, pinned?, locked?, approved?, note? }` |
| POST | `/v1/admin/feedback/posts/{ref}/notes` | `{ body }` (private, never shown to users) |
| DELETE | `/v1/admin/feedback/posts/{ref}` | — → `{ deleted, ref, title, votes, comments, admin_notes, changelog_drafts_deleted, changelog_entries_detached }` |
| GET | `/v1/admin/feedback/queue` | — → `{ posts:[Post] }` (unapproved) |
| POST | `/v1/admin/changelog` | `{ title, body, source_ref?, publish? }` |
| PATCH | `/v1/admin/changelog/{id}` | `{ title?, body?, publish? }` |

A `status` change writes an attributed entry to the post's `status_history`,
emails subscribers, and — when moved to `shipped` — auto-drafts a changelog entry
(publish it later via `PATCH /v1/admin/changelog/{id}` with `publish:true`).

`DELETE` is for spam and off-topic submissions, and it is permanent — there is no
soft-delete column and no recycle bin. Unapproving only *hides* a post, and it
then sits in the moderation queue forever, which is what this is the way out of.
Votes, comments, comment reactions, status changes, subscriptions and admin notes
all cascade. Two things do not, and each is a deliberate choice rather than a
foreign-key error:

- **A published changelog entry survives**, detached (`source_post` → null).
  "What's new" is a public record of what shipped and must not vanish because
  someone tidied the board months later. An *unpublished* draft — the one
  `shipped` auto-creates — has no existence apart from the post and goes with it.
- **A post that others were merged into is refused with `409`.** Deleting it
  would either orphan them or quietly return them to the board, and silently
  resurfacing a suggestion someone thought was handled is worse than an error.

Subscribers are **not** emailed on delete.

---

## 4. Flutter wiring — step by step

**Step 1 — load config once** when the board opens: `GET /feedback/meta`. Cache
`statuses` (key → label + color for pills/dots) and `categories` (filter chips).

**Step 2 — Board screen:** call `GET /feedback/posts` with the current sort +
filters. Render each `Post` with an upvote control bound to `you_voted`/`upvotes`.
Paginate with `next_cursor` (stop when it's `null`).

```dart
final res = await api.get('/v1/feedback/posts', query: {
  'sort': sort,                       // 'top' | 'new'
  if (statusKey != null) 'status': statusKey,
  if (categoryKey != null) 'category': categoryKey,
  if (query.isNotEmpty) 'q': query,
  if (cursor != null) 'cursor': cursor,
});
final posts = (res.data['posts'] as List).map(Post.fromJson).toList();
final nextCursor = res.data['next_cursor'];       // String? — feed back in as `cursor`
```

**Step 3 — Upvote** (optimistic, then reconcile with the response):

```dart
if (user.isGuest) { promptCreateAccount(); return; }
final res = post.youVoted
  ? await api.delete('/v1/feedback/posts/${post.ref}/vote')
  : await api.post('/v1/feedback/posts/${post.ref}/vote');
setState(() {
  post.youVoted = res.data['you_voted'];
  post.upvotes  = res.data['upvotes'];
});
```

**Step 4 — Post detail:** `GET /feedback/posts/{ref}`. Interleave `comments` and
`status_history` by `created_at` for the activity thread. Show the composer only
for non-guests; guests get a "Create an account to comment" button. If a comment
POST returns **409**, the thread is locked — disable the composer.

**Step 5 — New suggestion sheet:** as the user types the title, debounce calls to
`GET /feedback/similar?q=` and show "Similar: #ref …". On submit:

```dart
final res = await api.post('/v1/feedback/posts', data: {
  'title': title, if (body.isNotEmpty) 'body': body, if (cat != null) 'category': cat,
});
// 429 → show "You can post up to 2 suggestions per day."
```

**Step 6 — Roadmap tab:** `GET /feedback/roadmap` → render each `group` as a
section with a colored dot header (`group.status.color`) and its `posts`.

**Step 7 — What's new:** `GET /changelog` → list `entries`. Use `published_at`
for the date and an unread dot based on the newest `id` vs. the last one the user
saw (store locally).

**Error handling** (reuse your `ApiException`):
```dart
switch (e.statusCode) {
  case 403: promptCreateAccount(); break;          // guest write
  case 409: showError('This thread is locked.'); break;
  case 429: showError('You can post up to 2 suggestions per day.'); break;
  case 400: showFieldErrors(e.errors); break;
  default:  showError('Something went wrong.');
}
```

---

## 5. Quick manual test (curl)

```bash
TOKEN="<supabase access token>"

curl -sS "$BASE_URL/v1/feedback/meta"      -H "Authorization: Bearer $TOKEN"
curl -sS "$BASE_URL/v1/feedback/posts?sort=top" -H "Authorization: Bearer $TOKEN"

# Create + vote
curl -sS -X POST "$BASE_URL/v1/feedback/posts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Dark mode for Focus","body":"please","category":"focus"}'
curl -sS -X POST "$BASE_URL/v1/feedback/posts/1/vote" -H "Authorization: Bearer $TOKEN"

curl -sS "$BASE_URL/v1/feedback/roadmap"   -H "Authorization: Bearer $TOKEN"
curl -sS "$BASE_URL/v1/changelog"          -H "Authorization: Bearer $TOKEN"
```

---

## 6. Notes / gotchas

- **Every request needs a bearer token**, even reads — an anonymous (no-token)
  call gets `401`. Guests use their guest token.
- **Address posts by `ref`**, not internal id. `#ref` is what you show in the UI.
- **Vote counts come from the server.** Don't compute them client-side; use the
  `upvotes`/`you_voted` in each response (one-vote-per-user is DB-enforced).
- **Bugs don't go here.** The board is feature-requests only — keep the separate
  "Report a bug" route pointed at support/Ada.
- **Admin actions** need the caller's user id in the backend `FEEDBACK_ADMIN_IDS`
  env allowlist; everyone else gets `403`. (Roles are a later phase.)
- **Email notifications** to subscribers are best-effort and only send when the
  backend email provider is configured; nothing for the client to do.
