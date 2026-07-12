# Aqademiq — Flutter build handoff (V5, Guest Mode)

> A complete developer handoff for building the **Aqademiq** Flutter app with Claude
> Code: pixel-faithful to the design, complete to every frame, wired to a **Google
> Cloud** backend, and written as **scalable, optimized, maintainable, world-class**
> Dart.

---

## 0. TL;DR — how to drive this with Claude Code

1. Unzip this folder into your Flutter repo (or an empty folder for greenfield) and open Claude Code there.
2. Claude Code reads **three sources of truth**, never its own memory of the app:
   - **`prototypes/Aqademiq V1 Full Flow v5.html`** — the hi-fi design (every screen's exact look, type, spacing, motion).
   - **`prototypes/Aqademiq User Flow - Comprehensive.html`** — the flow map (every transition between screens).
   - **`FRAMES.md`** — the 88-frame checklist; **nothing ships until every box is ticked.**
3. Paste the prompts in **§9 one phase at a time** (A → B → C → D), reviewing between each.
4. Build UI against mocks first; wire the GCP backend only after the UI is complete and verified.

**Golden rule:** the HTML files are a **design reference, not code to ship.** Rebuild every screen as Flutter widgets using the architecture in §7 — never transliterate the prototype's web markup.

---

## 1. Product overview

Aqademiq is a student-planning app built around **Ada** (an AI planner mascot rendered as a melting ice-cube) and **Prism** (a focus-audio companion). Students plan their week, focus in timed sessions, track subjects, chat with Ada, and reflect on mood. **V1 ships with Guest Mode** — core features work before account creation; onboarding is prompted contextually.

**Scope: 88 frames / 11 sections** (full list + checklist in `FRAMES.md`). The flow map enumerates every transition.

---

## 2. About the design files (read this before coding)

The files in `/prototypes` are **high-fidelity design references** (self-contained HTML/CSS/JS for portable previewing). They show the intended look, motion, and behavior. They are **not production code**:

- The web markup is throwaway — **do not** carry any of it into the app. Lift **values** (colors, sizes, spacing, copy, motion), not structure.
- They mock data and navigation. Your job is to **rebuild each frame as Flutter widgets** with the routing, state, and data layer in §7.
- **Confirmed target stack: Flutter (see §7).** There is no web/React target.

**Fidelity: HIGH.** Colors, type, spacing, radii, and interactions are final — match them. Then swap mocked data for real Google Cloud calls (§8).

**How to inspect a frame:** open the v5 HTML, find the artboard by its `FRAMES.md` id (search `DCArtboard id="…"`), and read the referenced component (e.g. `<PLAN_TIMELINE/>`). The component's inline styles are your spec.

---

## 3. Design tokens (source of truth)

Map these into a Flutter `ThemeData` + `AppColors` / `AppText` / `AppSpacing` token classes. Values are lifted directly from the prototype. CSS shadows map to Flutter `BoxShadow`.

### Color — Light (default)
| Token | Value | Use |
|---|---|---|
| `bg` | `#f4f3f0` | App background (warm paper) |
| `surface` | `#ffffff` | Cards, sheets, rows |
| `text` | `#111111` | Primary text |
| `textMed` | `#777777` | Secondary text |
| `textDim` | `#c0c0c0` | Tertiary / placeholder / muted icons |
| `border` | `rgba(0,0,0,0.07)` | Hairline dividers, row borders |
| `hilite` | `#eceae7` | Inset chips / unselected segmented bg |
| `ink` | `#111111` | High-emphasis filled buttons |
| `shadow` | `0 2px 16px rgba(0,0,0,0.08)` | Card elevation |

### Color — Brand accent (themeable)
Default `accent = #6b5cf0` (violet); also shipped `#e85476` (pink), `#2a9d6b` (green).
- `accent` `#6b5cf0` · `accentSoft` `#edeafd` (light tint).
- **Dark mode:** `ink` becomes the accent; `accentSoft` becomes `accent @ 0x28` alpha.

### Color — Semantic / category
success `#2a9d6b` · warn `#e8a430` · danger `#e85476`.
Study-tag palette: Lecture `#5cbbff` · Class `#6b5cf0` · Exam `#e85476` · Assignment `#2a9d6b` · Report `#e8a430` · Presentation `#c0497b` · Reading `#9aa3b2`.

### Color — Dark mode
`bg #0e0e0e` · `surface #1b1b1b` · `text #efefef` · `textMed #888888` · `textDim #505050` · `border rgba(255,255,255,0.07)` · `hilite #33333a` · `shadow 0 2px 20px rgba(0,0,0,0.55)`. Appearance picker offers **Light / Dark / System** (`ThemeMode`).

### Typography
- **Body / UI / headings — `Plus Jakarta Sans`** (weights 400/500/600/700/800). **All text uses this**, including screen titles and sheet titles.
- **Numerals — `Playfair Display`** (700/800) — used **only** for big display numbers: the focus-timer minutes and the Profile/Stats stat values. (In the prototype these use a dedicated `NUMSERIF` token; keep that separation.)
- **Mono — `JetBrains Mono`** (rare).
- Type scale (px): 11 / 11.5 / 12 / 12.5 / 13.5 / 14 / 15 / 19–21 (sheet titles) / 26–34 (screen titles) / 36–46 (timer & stat numerals).

### Radius / spacing / motion
- Radius: cards **18**, bottom-sheet top corners **24**, rows/inputs **14**, pills/chips/toggles/buttons **100** (full).
- Spacing base **4px**. Row pad `12×15`, card pad `13×15`, section gaps `18–22`, screen side pad `16`.
- Sheet shadow `0 -12px 48px rgba(20,15,28,0.28)`; scrim over content `rgba(20,15,28,0.42)`.
- Transitions ~140–260ms ease; sheets slide up; the Ada ice-cube melt is tied to focus progress (decorative drips off under reduced-motion).

---

## 4. Component library (build as Widgets first)

Build these once; every frame composes them. Names map to the prototype.

| Widget | Spec |
|---|---|
| **AppScaffold** | Safe-area column + floating **BottomNav**. |
| **BottomNav** | 5 items, order **[Subjects] [Planner] [Ada (center)] [Timer] [Stats/Profile]**. Ada is a raised center circle (its own shadow, slightly elevated). Active = ink circle/pill behind icon. Guest mode shows lock dots on Ada + Stats. Hit target ≥44px. |
| **PrimaryButton** | Ink fill `#111`, white text, weight 800, radius 100, pad `13×40`. |
| **AppCard** | surface, radius 18, shadow, pad 13–15. |
| **SettingsRow** | `icon? · label · value?/toggle?/pill?/chevron?`. Value right-aligned, ellipsis; long toggle-row labels wrap to 2 lines (never overlap the toggle). |
| **AppToggle** | iOS pill 46×27, accent track on. |
| **TagChip** | dot + label + optional ✕; 1px border, radius 100. |
| **AppBottomSheet** | top radius 24, drag handle 38×4, serif-free title, content; presented over **scrim 0.42** with the real screen dimmed behind. |
| **AppDialog** | centered, radius 24; for value-adjust + destructive confirms. |
| **SectionPill** | centered ink/hilite pill header (Anytime / Planned / Morning…). |
| **AdaMascot** | `CustomPainter` ice-cube; `melt 0→1` morphs cube → puddle; expressions happy/smile/neutral/focused/sad; also the avatar. |
| **FocusTimer** | `CustomPainter` ring/cube + big numeral readout; "Ice melt" default. |
| **MoodBlob** | small per-day mood face used in the week strips. |

---

## 5. Screens & behavior

Each frame's look = its prototype artboard; each transition = the flow map. `FRAMES.md` is the checklist. Section-level behavior:

- **Navigation:** the 5-tab bottom nav is the spine; sub-screens push; sheets/dialogs/menus present modally over a dimmed parent (the real screen, dimmed — not a fake backdrop).
- **Guest → account:** Plan, Focus, basic Subjects work as guest. Gated taps (Ada, Stats, Save progress) open a setup prompt → Onboarding; "Save progress" links the guest to a real account.
- **Plan:** day timeline with collapsible Anytime/Planned; add-task composes the time/date/duration/repeat pickers; tasks expand into Ada microtasks; swipe + long-press actions; reschedule/move.
- **Focus:** pick duration + optional linked task + Prism mode → run (cube melts with elapsed %, server-authoritative via Redis/Socket.IO) → pause (freezes) → complete (summary + mood). Persist elapsed locally so a cold start resumes.
- **Ada:** chat backed by Claude 3.5 Sonnet (Vertex AI), streamed; can write to the plan.
- **Settings:** all transient edits are bottom sheets over the dimmed real screen; appearance = Light/Dark/System; study tags are CRUD.

---

## 6. State you'll model
auth/session (+ guest flag), profile, subjects[], tasks[] (per day; tag/time/duration/repeat/microtasks/done), focus sessions[] (+ live timer state), Ada conversations[], mood logs[], notification prefs, appearance + tweak prefs.

---

## 7. Flutter architecture — scalable, optimized, maintainable

Non-negotiables for world-class, maintainable code:

### Stack
- **Flutter + Dart** (null-safe, `dart format`, `flutter analyze` clean, **`very_good_analysis`** lints).
- **Riverpod** (state) — `AsyncValue` gives loading/data/error for free.
- **freezed + json_serializable** — all models/DTOs immutable + codegen.
- **Dio** (HTTP) — interceptors for auth token, retry, Cloud Trace headers.
- **go_router** — the 5-tab shell + pushed sub-routes + modal sheets.
- **socket_io_client** — focus timers / presence.
- **Identity Platform** auth via `firebase_auth` (Identity Platform is Firebase Auth's GCP-backed sibling) + Google/Apple OAuth.
- **flutter_secure_storage** (tokens) + `shared_preferences` (prefs) + `drift`/`hive` (offline task cache for Guest Mode).
- Fonts via `google_fonts` or bundled assets; animations via Flutter built-ins + `CustomPainter` (Ada).

### Project shape (feature-first, layered)
```
lib/
  core/          theme(tokens) · router · dio+interceptors · env · result/failure types · logging
  data/
    models/        freezed UI models (Task, Subject, FocusSession, …)
    dtos/          freezed API DTOs  ← codegen from NestJS OpenAPI later
    adapters/      DtoToModel mappers (the seam that absorbs schema drift)
    sources/       ApiXxxSource (real) + MockXxxSource (delayed fixtures)
    repositories/  XxxRepository (chooses source via Env.useMocks)
    realtime/      RealtimeRepository (Socket.IO streams)
  features/
    <feature>/
      presentation/  widgets + screens (NEVER import Dio or a DTO)
      providers/     Riverpod providers exposing AsyncValue<UiModel>
      controllers/   user-intent → repository calls (mutations)
  shared/        reusable widgets from §4 (design system)
```

### The four seams (put these in on day one — see §9 Prompt A)
1. **Provider boundary** — widgets read only `ref.watch(xProvider)`; never touch Dio/DTOs.
2. **Adapter layer** — DTO→UI model in `data/adapters`; schema drift is a one-file fix, not 88 screens.
3. **Mock sources behave like real ones** — fixtures return after a small delay and can throw, so loading/error UI is real now. `Env.useMocks` (`--dart-define`) flips the whole app to live.
4. **Auth behind a repository interface** — `AuthRepository` with a mock impl; guest/OTP/link swap to Identity Platform later without touching consumers.

### Performance & quality bar
- `const` constructors everywhere possible; avoid rebuilding subtrees (scope `ref.watch`, use `select`).
- Lists are lazy (`ListView.builder` / slivers); images cached (`cached_network_image`).
- No business logic in widgets; no `setState` for server state (Riverpod owns it).
- Every list/screen handles **loading / empty / error** via `AsyncValue.when` from the start.
- Optimistic updates for toggles; debounce expensive calls; cancel in-flight requests on dispose.
- Tests: unit (adapters, controllers, repositories with mock sources), widget (key screens), golden (the design-system widgets vs. the prototype). Target meaningful coverage on `data/` + `features/*/controllers`.
- Accessibility: semantic labels, ≥44px targets, respects text scaling + reduced motion.
- Errors: typed `Failure` + a single error→toast/snackbar surface; never swallow exceptions.

---

## 8. Wiring to Google Cloud (the integration pass)

Do this **after** the UI renders on mocks. All network access stays in `data/sources` + `data/repositories`.

Backend (confirmed): **NestJS (Node/TS) on Cloud Run** · **Cloud SQL for PostgreSQL (Enterprise Plus, HA) with RLS + pgvector** · **Memorystore for Redis** (timers/presence) · **Google Cloud Storage** (images, syllabi, audio) · **Cloud Tasks** (worker queues) + **Eventarc + Pub/Sub** (domain event bus: `TASK_COMPLETED`, `FOCUS_SESSION_STARTED`, …) · **Socket.IO on Cloud Run** (session affinity, or Cloud Load Balancing) · **Claude 3.5 Sonnet via Vertex AI (Model Garden)** for Ada · **Identity Platform** auth (accounts + OAuth) · **Terraform** IaC · **GitHub Actions** CI/CD · **Cloud Logging / Monitoring / Trace** observability.

### 8.1 Give Claude Code the contract
Point it at whichever the NestJS service exposes (best → ok):
1. **`@nestjs/swagger` OpenAPI JSON** (`/api-json`) — **best.** Generate Dart `freezed` DTOs + a Dio client.
2. The Nest **DTOs / controllers** source.
3. The **Postgres schema** (migrations / DDL) + an endpoint list.

> "Generate Dart `freezed` DTOs and a Dio client from `<openapi.json>`. One repository method per screen's data need. Widgets never touch Dio or DTOs."

### 8.2 GCP shapes & how to handle them in Flutter
- **NestJS REST on Cloud Run:** Dio client, `baseUrl` from `--dart-define`; DTOs generated from the Swagger JSON. Each call in an `ApiXxxSource`; repositories expose UI models via adapters.
- **Identity Platform (auth, OAuth):** use `firebase_auth` (Identity Platform shares the Firebase Auth SDKs/backend) for email + Google/Apple. Map: Welcome→Sign up/Sign in; **OTP verify** = the email-code/verification step; **Guest** = anonymous sign-in (`signInAnonymously`) **linked** to a real credential on "Save progress" (`linkWithCredential`). Put the **ID token in a Dio interceptor** (`Authorization: Bearer …`); refresh on 401.
- **Cloud SQL Postgres + RLS:** the app **never** touches the DB — only the Cloud Run API. RLS scopes rows by the token's user claims server-side; just send the token, never filter client-side. **pgvector** powers Ada's retrieval server-side (invisible to the client).
- **Memorystore Redis (timers/presence):** never hit Redis directly. **Focus timer ticks + presence arrive over Socket.IO**; REST endpoints start/stop sessions; Redis is the server's source of truth. Persist elapsed locally for cold-start resume.
- **Socket.IO on Cloud Run:** `socket_io_client` connects with the ID token (mind **session affinity**); subscribe to focus/presence/notification channels; server emits domain events via Eventarc/Pub/Sub. Keep it in `RealtimeRepository`; providers expose its streams.
- **Cloud Storage uploads (profile image, syllabus, Prism audio):** **signed-URL** flow — `POST` a Cloud Run endpoint → get a signed PUT URL → Dio `PUT` bytes straight to GCS. Used by Change-photo, Add-file, Upload-syllabus.
- **Cloud Tasks / Eventarc / Pub/Sub (async — notifications, AI parsing):** server-side. The app **fires the action** (e.g. upload syllabus) then **reflects the async result** when it lands (poll the resource or receive a Socket.IO/push notification). Design those screens for a **"processing…"** state.
- **Ada via Vertex AI (Claude 3.5 Sonnet):** the app calls a NestJS `/ada/messages` endpoint; the **server** calls Vertex AI (keys never on device). Prefer **streaming** (SSE or Socket.IO) so Ada's reply types in. Show a typing state.
- **Cloud Trace:** optional Dio interceptor adding trace headers so client spans correlate with Cloud Run traces.

### 8.3 Map screens → endpoints
Fill in `INTEGRATION.md` (stubbed in this package): **Screen → action → REST/socket → request → response → provider**. It already lists the likely rows.

### 8.4 Config & secrets
API base URL, Identity Platform config, GCS bucket, Socket.IO URL, region → `--dart-define` / env injected by GitHub Actions per environment. **Never** hardcode service-account keys in the app — only the Identity Platform ID token travels with requests; all GCP access is server-side on Cloud Run.

### 8.5 Cross-cutting
Loading/empty/error via `AsyncValue.when`; optimistic task toggles; offline cache + retry (Guest Mode); token-refresh interceptor; "processing…" states for async (Cloud Tasks/AI) flows; reduced-motion + dark mode.

---

## 9. Kickoff prompts for Claude Code

> Stack: **Flutter (Dart) + Riverpod + freezed + Dio + go_router + socket_io_client + Identity Platform**, backend **NestJS on Cloud Run / Cloud SQL Postgres / Memorystore Redis / GCS / Vertex AI (Claude)** (see §7, §8). Sources of truth: the v5 prototype, the flow map, and `FRAMES.md`.

**Prompt A — scaffold + design system + seams**
> "Read `aqademiq_handoff/README.md`, skim `FRAMES.md`, and open `prototypes/Aqademiq V1 Full Flow v5.html`. Build a **Flutter** app with **Riverpod, freezed, Dio, go_router**. Set up the project structure and the four seams from §7 **before any screen**: `data/sources` with `MockXxxSource` (delayed fixtures) behind repositories chosen via `Env.useMocks` (`--dart-define`); `data/models` + `data/dtos` + `data/adapters`; an `AuthRepository` with a mock impl behind a provider. Then build the `ThemeData` + `AppColors`/`AppText`/`AppSpacing` tokens from §3 and the §4 widget library (incl. BottomNav with Ada centered, and the AdaMascot `CustomPainter`). Add `very_good_analysis`. No real network yet. Show me the 5-tab shell + Plan/Timeline first."

**Prompt B — build every frame**
> "Now build screens section by section using `FRAMES.md` as the checklist, starting with 00 Entry. For each frame: match its artboard in the v5 prototype (find it via `DCArtboard id=\"…\"`) and its transitions in the flow map. Widgets are presentational and read data only from Riverpod providers returning `AsyncValue`; handle **loading/empty/error** via `AsyncValue.when` now. After each section report `Section NN: X/Y frames built`. **Do not skip `state` frames** — demonstrate each as a toggle on its parent. Don't stop until every box in `FRAMES.md` is ticked."

**Prompt C — wire Google Cloud**
> "Here's our backend: NestJS on Cloud Run with `<path to openapi.json>`, Cloud SQL Postgres (RLS + pgvector), Identity Platform auth (anonymous guest → linked on Save progress), GCS signed-URL uploads, Memorystore Redis + Socket.IO for focus ticks/presence, Cloud Tasks/Eventarc/Pub/Sub for async, Ada via a server `/ada/messages` endpoint backed by Claude 3.5 Sonnet on Vertex AI (streamed). Following §8: generate Dart `freezed` DTOs + a Dio client from the OpenAPI spec, implement the real `ApiXxxSource`s behind the existing repositories, flip `Env.useMocks=false`, wire the Identity Platform ID-token Dio interceptor, GCS signed-PUT uploads, and a `RealtimeRepository` over `socket_io_client`. Complete `INTEGRATION.md`. Widgets must not touch Dio or DTOs."

**Prompt D — polish + harden**
> "Add shimmer loading, error/empty states, optimistic task toggles, 'processing…' states for async syllabus/AI flows, streaming typing state for Ada, reduced-motion handling for the Ada melt, and dark mode (§3 `ThemeMode`). Add unit tests for adapters/controllers/repositories (mock sources), widget tests for key screens, and golden tests for the design-system widgets. Ensure `flutter analyze` is clean. Verify each frame against the prototype and tick `FRAMES.md`."

---

## 10. Files in this package
- `README.md` — this document.
- `FRAMES.md` — **the 88-frame build checklist** (don't ship with unchecked boxes).
- `INTEGRATION.md` — screen→endpoint map + mock Dart models (placeholder; fill during §8).
- `backend_contract/` — drop your `@nestjs/swagger` `openapi.json` here, then run Prompt C.
- `prototypes/Aqademiq V1 Full Flow v5.html` — the hi-fi design (all 88 frames).
- `prototypes/Aqademiq User Flow - Comprehensive.html` — the interactive flow map.

> **Backend not finalized?** Fine — build the whole UI on mocks now (Prompts A–B, all 88 frames), then drop the OpenAPI spec into `backend_contract/` and run Prompt C. The four seams make that a contained change, not a rewrite.
