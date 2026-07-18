# Onboarding — Consent + Age Wiring (Flutter → Backend)

How to connect the Flutter onboarding flow to the backend fields added for
**data-use consent** and **age**. The rest of the app's API client (base URL,
auth token, snake_case JSON) is already wired — this doc only covers the two new
pieces on the existing onboarding-completion call.

> **One endpoint changes:** `POST /v1/onboarding/complete`. No new endpoints.

---

## 1. Contract basics (already true for every call)

| Thing | Value |
|---|---|
| Base URL | Whatever the app already uses, e.g. `{BASE_URL}` = `http://localhost:8080` in dev (all routes are under the global `/v1` prefix) |
| Full path | `{BASE_URL}/v1/onboarding/complete` |
| Method | `POST` |
| Auth | `Authorization: Bearer <supabase_access_token>` (same token the app already sends) |
| Content-Type | `application/json` |
| Casing | **snake_case** in and out — no camelCase conversion |

The request is **strict**: unknown fields are rejected with `400`. Send only the
documented keys.

---

## 2. Request body

The two new fields are `consent_given`, `consent_version`, and `age`. Everything
else is unchanged from what the app already sends.

```json
{
  "consent_given": true,
  "consent_version": "2026-07-01",
  "age": 20,

  "name": "Jane Doe",
  "education_level": "undergraduate",
  "referral_code": "ABC123",
  "daily_focus_goal_min": 60,
  "semester": { "name": "Fall 2026", "start": "2026-09-01", "end": "2027-01-15" },
  "subjects": [
    { "name": "Calculus", "color_hex": "#6b5cf0", "mood": 3 }
  ],
  "work_best_times": null
}
```

### Field reference (new fields in **bold**)

| Field | Type | Required | Rules |
|---|---|---|---|
| **`consent_given`** | bool | **Yes** | Must be `true`. Anything else → onboarding is rejected and **not** completed. |
| **`consent_version`** | string | No | The Privacy Policy / Terms version the user accepted (1–100 chars). Send the version string your consent screen displayed, e.g. `"2026-07-01"`. Stored for the PDPL audit trail. |
| **`age`** | int | **Yes** | `1`–`120` (sanity bounds). Must be **≥ 18** or onboarding is rejected. |
| `name` | string | No | 0–120 chars. |
| `education_level` | string | No | |
| `referral_code` | string | No | |
| `daily_focus_goal_min` | int | No | 0–1440. |
| `semester` | object | No | `{ name, start: "YYYY-MM-DD", end: "YYYY-MM-DD" }`. |
| `subjects` | array | No | `[{ name, color_hex?: "#RRGGBB", mood?: 0–4, syllabus_staging_key?, syllabus_file_name?, syllabus_mime_type? }]`. |
| `work_best_times` | any | No | Passthrough. |

**Do not send a consent timestamp.** It is stamped **server-side** at the moment
the record is written; any client-supplied timestamp is ignored.

---

## 3. Success response — `201 Created`

```json
{
  "profile_name": "User",
  "semesters": 1,
  "subjects": 1,
  "daily_focus_goal_min": 60,
  "status": "completed"
}
```

- `status` is `"completed"` on first completion, or `"already_completed"` if the
  user had already finished onboarding (idempotent — safe to retry).

---

## 4. Error responses

All errors share this envelope:

```json
{
  "status_code": 403,
  "error": "FORBIDDEN",
  "message": "Consent is required to complete onboarding",
  "path": "/v1/onboarding/complete",
  "timestamp": "2026-07-18T12:34:56.789Z"
}
```

| Case | status_code | `message` (exact) | What the UI should do |
|---|---|---|---|
| Consent not granted (`consent_given` missing/false) | **403** | `Consent is required to complete onboarding` | Keep the user on the consent step; do not advance. |
| Under legal age (`age < 18`) | **403** | `You must be at least 18 years old to complete onboarding` | Show an age-restriction message; block completion. |
| `age` out of bounds (`<1` or `>120`), or `age`/`consent_given` missing/wrong type, or unknown field | **400** | `Bad Request` with an `errors` array of per-field messages (e.g. `["age must not be greater than 120"]`) | Treat as a form-validation error; surface field errors. |
| Missing/invalid bearer token | **401** | `Missing bearer token` / `Invalid token` | Re-auth. |

> `403` (consent / age) are **business-rule** rejections and do **not** carry an
> `errors` array — switch on `status_code` + `message`. `400` is **schema**
> validation and **does** carry `errors`.

Because the consent and age checks run **before any write**, a rejected request
leaves the account untouched — the user simply cannot finish onboarding until
both pass.

---

## 5. Flutter wiring — step by step

**Step 1 — collect on the consent + age screens.** You already do this. Hold:
- `bool consentGiven` (the checkbox/toggle the user must tick),
- `String consentVersion` (the version string of the policy you rendered),
- `int age` (or derive it from a birthdate picker).

**Step 2 — add the fields to your onboarding request model.**

```dart
class CompleteOnboardingRequest {
  final bool consentGiven;
  final String? consentVersion;
  final int age;
  // ...existing fields (name, educationLevel, semester, subjects, ...)

  Map<String, dynamic> toJson() => {
    'consent_given': consentGiven,          // must be true
    if (consentVersion != null) 'consent_version': consentVersion,
    'age': age,                              // 1..120, must be >= 18
    // ...existing snake_case fields
  };
}
```

**Step 3 — gate the "Finish" button client-side (fail fast), but let the server
be the source of truth.**

```dart
if (!consentGiven) {
  showError('Please accept the privacy policy to continue.');
  return;
}
if (age < 18) {
  showError('You must be at least 18 to use Aqademiq.');
  return;
}
```

**Step 4 — call the existing onboarding endpoint through your API client.**

```dart
final res = await api.post(
  '/v1/onboarding/complete',
  data: request.toJson(),
); // api already attaches the Bearer token + base URL
```

**Step 5 — handle the response / errors.**

```dart
try {
  final res = await api.post('/v1/onboarding/complete', data: request.toJson());
  final status = res.data['status']; // 'completed' | 'already_completed'
  goToHome();
} on ApiException catch (e) {              // your existing error wrapper
  switch (e.statusCode) {
    case 403:
      // consent or age rejection — message tells which
      showError(e.message);
      break;
    case 400:
      // schema validation — e.errors is a list of field messages
      showFieldErrors(e.errors);
      break;
    case 401:
      reauthenticate();
      break;
    default:
      showError('Something went wrong. Please try again.');
  }
}
```

---

## 6. Quick manual test (curl)

```bash
TOKEN="<supabase access token>"

# Happy path
curl -sS -X POST "$BASE_URL/v1/onboarding/complete" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"consent_given": true, "consent_version": "2026-07-01", "age": 20, "name": "Jane"}'
# → 201 { "status": "completed", ... }

# Rejected: no consent
curl -sS -X POST "$BASE_URL/v1/onboarding/complete" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"consent_given": false, "age": 20}'
# → 403 { "message": "Consent is required to complete onboarding", ... }

# Rejected: under 18
curl -sS -X POST "$BASE_URL/v1/onboarding/complete" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"consent_given": true, "age": 16}'
# → 403 { "message": "You must be at least 18 years old to complete onboarding", ... }
```

---

## 7. Notes / gotchas

- **Server owns the consent timestamp.** Don't send one; the backend records
  `consent_timestamp` at write time for the audit trail.
- **`consent_version` is optional but recommended** — without it the audit trail
  can't say *which* policy the user accepted. Send the exact version string your
  consent screen showed.
- **Minimum age is 18**, enforced server-side. If product later changes this, it
  changes in one place on the backend — the client's local `age < 18` guard
  should be kept in sync.
- **Idempotent:** re-calling after completion returns `status: "already_completed"`
  and does not error — safe for retries.
