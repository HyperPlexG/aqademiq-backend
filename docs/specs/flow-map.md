# Aqademiq — Complete Transition Graph (Flow Map)

> Source of truth: `prototypes/Aqademiq User Flow - Comprehensive.html` (the `BANDS` + `EDGES` arrays).
> This document is the **whole-app navigation graph**: every node (screen / sheet / dialog / state) and every
> edge (trigger → destination), grouped by section. Pixel-exact look/values live in the per-frame
> `section-NN-*.md` specs; this file is the wiring diagram only.
>
> **Counts:** 81 distinct nodes · 83 edges · 11 sections · 6 entry points · 5 bottom-nav tab roots (hubs).
>
> **ID note:** The flow map uses `signup` / `otp`; `FRAMES.md` calls these `auth-signup` / `auth-otp`.
> They are the same screens. All other ids match `FRAMES.md` exactly.

---

## Edge kinds (how to read every arrow)

The prototype tags each edge with a `kind`; this maps directly to how the destination should be presented in Flutter.

| kind | count | meaning | Flutter presentation |
|------|-------|---------|----------------------|
| `flow` | 30 | primary forward navigation within a journey (solid colored line) | push a route (or advance a stepper / scroll a section) |
| `modal` | 39 | opens an overlay: bottom sheet, dialog, or popover menu (dotted gray line) | `showModalBottomSheet` / `showDialog` / `showMenu` over the current route |
| `cross` | 13 | jump *between* journeys or app boundaries (thicker, semi-transparent line) | route replacement / cross-tab jump / app entry |
| `loop` | 1 | returns to a prior live state (dashed line) | pop sheet / resume state (`fc-paused` → `fc-running`) |

The exact UI affordance per node (route vs sheet vs dialog vs menu vs state) comes from `FRAMES.md`'s **Kind** column, reproduced inline below.

---

## App entry path (cold start → usable app)

```
splash  ──flow──▶  welcome  ──┬── "Sign in" ─flow─▶ auth ──"Returning"(cross)─▶ plan-timeline   (existing user, straight into the app)
(auto-advance)               ├── "Sign up" ─flow─▶ signup ─flow─▶ otp ──"Verified"(cross)─▶ ob-referral ─▶ …onboarding… ─▶ plan-timeline
                             └── "Jump in"  ─cross─▶ guest-home   (NO account — full Plan/Home in guest mode)
```

- `splash` is the only true cold-start node. It **auto-advances** to `welcome` (no user action; timer/flow edge, no label).
- `welcome` is the **fork hub** — three mutually exclusive paths: returning sign-in, new sign-up, or guest.
- New-account path threads the onboarding chain (Section 01) before landing on the app home.
- Returning sign-in (`auth`) and guest jump (`guest-home`) both skip onboarding.

---

## Guest-gating edges (what guests can and cannot do)

Guest mode (`guest-home`) is the **full Plan/Home with no account**. Two features are *gated* — tapping them does not open the feature; it opens a setup-prompt overlay that funnels into account creation. A third prompt fires after a real focus session.

| Trigger (from `guest-home`) | Edge | Destination | Then |
|------|------|-------------|------|
| Tap **Ada** tab (gated) | `modal` "Tap Ada" | `guest-ada` (setup prompt overlay) | `guest-ada` ──"Set up"(cross)──▶ `ob-referral` (enters onboarding) |
| Tap **Stats** tab (gated) | `modal` "Tap Stats" | `guest-stats` (setup prompt overlay) | terminal overlay (dismiss → back to guest-home) |
| **Session end** (after a focus session) | `modal` "Session end" | `guest-save` (save-progress prompt) | `guest-save` ──"Save"(cross)──▶ `signup` (create account to keep progress) |
| Navigate to Subjects | `flow` | `guest-subjects` (empty state) | terminal (add-first-subject prompt; dismiss/back) |

So the two conversion funnels out of guest mode are: **Ada → onboarding** and **Save progress → signup**. Stats and Subjects-empty are dead ends that bounce back to guest-home.

---

## Bottom-nav tab roots (the 5 hubs)

These are the `core:true` bands' first spine nodes — the persistent bottom-navigation destinations. The rail connects them in the prototype. From any hub you can cross-jump to any other via the bottom nav (implicit; not drawn as edges).

1. `plan-timeline` — **Plan / Home** (Section 02) — default landing screen
2. `subj-list` — **Subjects** (Section 03)
3. `fc-set` — **Focus** (Section 04)
4. `ada-empty` — **Ada AI** (Section 05)
5. `profile-top` — **Profile / Stats** (Section 06)

`plan-timeline` is the app's central hub: it is the destination of all four app-entry crosses (`auth`, `adaload`, `fc-end`, `ada-chat`, `mood-morning`) and the source of the most edges.

---

## Graph topology summary

- **Entry points (no inbound edges):** `splash` (cold start) + the 5 tab roots that are reached only via bottom nav (`subj-list`, `fc-set`, `ada-empty`, `profile-top`) + `mood-morning` (time/system-triggered). The 5 tab roots have no *drawn* inbound edge because they are reached through the bottom-nav rail, not a content transition.
- **Central hub:** `plan-timeline` — most-connected node; convergence point for app entry, focus completion, Ada actions, and morning mood; diverges to breakdown, list, otherday, quickadd, menu, addtask, swipe, overflow, and evening mood.
- **Terminal overlays/states (no outbound edges):** all pickers, menus, collapsed/expanded states, and prompt dialogs (e.g. `plan-pick-date`, `subj-sort`, `settings-appearance`, `plan-breakdown`, `guest-stats`). They are dismissed back to their opener.
- **The only `loop`:** `fc-paused` → `fc-running` ("Resume").

---

# Section-by-section transition tables

Format per node: **`id`** — title — *FRAMES kind* · **OUT:** trigger → dest `(kind)` · **IN:** source → here `(kind, trigger)`.
"IN: bottom nav" denotes a tab root reachable via the persistent bottom navigation (no drawn edge).

---

## 00 — Entry & Auth  (`fam: entry`, color `#6b5cf0`)

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `splash` | route (auto-advance) | → `welcome` (flow, auto) | — (cold start) |
| `welcome` | route (HUB / fork) | → `auth` (flow, "Sign in"); → `signup` (flow, "Sign up"); → `guest-home` (cross, "Jump in") | ← `splash` (flow) |
| `auth` | route | → `plan-timeline` (cross, "Returning") | ← `welcome` (flow, "Sign in") |
| `signup` (`auth-signup`) | route | → `otp` (flow) | ← `welcome` (flow, "Sign up"); ← `guest-save` (cross, "Save") |
| `otp` (`auth-otp`) | route | → `ob-referral` (cross, "Verified") | ← `signup` (flow) |

---

## 00b — Guest Mode  (`fam: entry`, color `#6b5cf0`)

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `guest-home` | route (HUB, Plan in guest mode) | → `guest-subjects` (flow); → `guest-ada` (modal, "Tap Ada"); → `guest-stats` (modal, "Tap Stats"); → `guest-save` (modal, "Session end") | ← `welcome` (cross, "Jump in") |
| `guest-subjects` | route (empty) | — (terminal; back to guest-home) | ← `guest-home` (flow) |
| `guest-ada` | dialog/state (gated-feature prompt) | → `ob-referral` (cross, "Set up") | ← `guest-home` (modal, "Tap Ada") |
| `guest-stats` | dialog/state (gated-feature prompt) | — (terminal; dismiss) | ← `guest-home` (modal, "Tap Stats") |
| `guest-save` | dialog/state (save-progress prompt) | → `signup` (cross, "Save") | ← `guest-home` (modal, "Session end") |

**State-frame toggles:** `guest-ada`/`guest-stats`/`guest-save` are overlays on `guest-home`. `guest-ada` and `guest-stats` toggle on when the gated **Ada** / **Stats** bottom-nav tabs are tapped while in guest mode. `guest-save` toggles on at the *end of a focus session* run in guest mode.

---

## 01 — Onboarding  (`fam: entry`, color `#6b5cf0`)

Linear stepper; one forward `flow` edge per step. Entered via `otp` "Verified" or `guest-ada` "Set up".

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `ob-referral` | route | → `ob1` (flow) | ← `otp` (cross, "Verified"); ← `guest-ada` (cross, "Set up") |
| `ob1` | route (Step 1 · Name) | → `ob2` (flow) | ← `ob-referral` (flow) |
| `ob2` | route (Step 2 · Subjects) | → `ob2-add` (modal, "Add"); → `ob-mood` (flow) | ← `ob1` (flow) |
| `ob2-add` | dialog (Add subject popup) | — (terminal; back to ob2) | ← `ob2` (modal, "Add") |
| `ob-mood` | route (Step 3 · Feelings) | → `ob3` (flow) | ← `ob2` (flow) |
| `ob3` | route (Step 4 · Syllabus upload) | → `ob4` (flow) | ← `ob-mood` (flow) |
| `ob4` | route (Step 5 · Peak + goal) | → `ob5` (flow) | ← `ob3` (flow) |
| `ob5` | route (Step 6 · Meet Prism) | → `adaload` (flow) | ← `ob4` (flow) |
| `adaload` | route (loading/transition) | → `plan-timeline` (cross, "Enter app") | ← `ob5` (flow) |

---

## 02 — Plan / Home  (`fam: plan`, color `#2a9d6b`, **core / tab root**)

`plan-timeline` is the hub. Spine = navigable views; modals = sheets/menus/states layered on the timeline.

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `plan-timeline` | route (HUB, default home) | → `plan-breakdown` (flow, "Expand"); → `plan-list` (flow, "List"); → `plan-anytime-collapsed` (modal); → `plan-planned-collapsed` (modal); → `plan-otherday` (flow, "Pick day"); → `plan-quickadd` (modal, "+ Quick"); → `plan-menu` (modal, "···"); → `plan-addtask` (flow, "Add task"); → `task-swipe` (cross, "Swipe"); → `task-overflow` (cross, "Long-press"); → `mood-evening` (cross, "End of day") | ← `auth` (cross, "Returning"); ← `adaload` (cross, "Enter app"); ← `fc-end` (cross, "Back to plan"); ← `ada-chat` (cross, "Added to plan"); ← `mood-morning` (cross, "Start day"); + bottom nav |
| `plan-breakdown` | state (task → microtasks) | — (terminal) | ← `plan-timeline` (flow, "Expand") |
| `plan-list` | state (group-by/list view) | — (terminal) | ← `plan-timeline` (flow, "List") |
| `plan-anytime-collapsed` | state (Anytime folded) | — (terminal) | ← `plan-timeline` (modal) |
| `plan-planned-collapsed` | state (Planned folded) | — (terminal) | ← `plan-timeline` (modal) |
| `plan-otherday` | state (another day + Today button) | → `plan-month` (modal, "Calendar") | ← `plan-timeline` (flow, "Pick day") |
| `plan-month` | sheet/menu (Month picker) | → `plan-month-next` (modal); → `plan-monthyear` (modal, "Year") | ← `plan-otherday` (modal, "Calendar") |
| `plan-month-next` | state (Month → July) | — (terminal) | ← `plan-month` (modal) |
| `plan-monthyear` | sheet (Month + year wheel) | — (terminal) | ← `plan-month` (modal, "Year") |
| `plan-quickadd` | sheet (+ quick add bar) | → `plan-addtask` (flow, "Details") | ← `plan-timeline` (modal, "+ Quick") |
| `plan-menu` | menu (··· overflow) | → `plan-grouping` (modal); → `plan-logmood` (modal); → `plan-resched` (modal) | ← `plan-timeline` (modal, "···") |
| `plan-grouping` | menu (grouping submenu) | — (terminal) | ← `plan-menu` (modal) |
| `plan-logmood` | sheet/dialog (log mood popup) | — (terminal) | ← `plan-menu` (modal) |
| `plan-resched` | menu/sheet (reschedule remaining) | → `plan-move` (modal) | ← `plan-menu` (modal) |
| `plan-move` | sheet (move to date) | — (terminal) | ← `plan-resched` (modal) |
| `plan-addtask` | route/sheet (full add-task form) | → `plan-pick-time` (modal, "Time"); → `plan-pick-date` (modal, "Date"); → `plan-pick-duration` (modal, "Length"); → `plan-pick-repeat` (modal, "Repeat") | ← `plan-timeline` (flow, "Add task"); ← `plan-quickadd` (flow, "Details") |
| `plan-pick-time` | sheet (time-of-day picker) | → `plan-pick-time-custom` (modal) | ← `plan-addtask` (modal, "Time") |
| `plan-pick-time-custom` | dialog (specific time) | — (terminal) | ← `plan-pick-time` (modal) |
| `plan-pick-date` | sheet (date picker) | — (terminal) | ← `plan-addtask` (modal, "Date") |
| `plan-pick-duration` | sheet (duration picker) | → `plan-pick-duration-custom` (modal) | ← `plan-addtask` (modal, "Length") |
| `plan-pick-duration-custom` | dialog (custom duration) | — (terminal) | ← `plan-pick-duration` (modal) |
| `plan-pick-repeat` | sheet (repeat picker) | → `plan-pick-repeat-custom` (modal) | ← `plan-addtask` (modal, "Repeat") |
| `plan-pick-repeat-custom` | dialog (custom repeat) | — (terminal) | ← `plan-pick-repeat` (modal) |

**State toggles:** `plan-list` (group-by toggle), `plan-breakdown` (tap a task to expand microtasks), `plan-anytime-collapsed`/`plan-planned-collapsed` (collapse the respective section header), `plan-otherday` (date scrubbed off today), `plan-month-next` (advance month in picker).

---

## 03 — Subjects  (`fam: subj`, color `#2f80ed`, **core / tab root**)

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `subj-list` | route (HUB; grid via Tweak) | → `subj-detail` (flow, "Open"); → `subj-add` (flow, "+ Subject"); → `subj-menu` (modal, "···") | ← bottom nav |
| `subj-detail` | route (detail + files) | → `subj-file` (modal, "+ File"); → `subj-share` (modal, "Share") | ← `subj-list` (flow, "Open") |
| `subj-add` | route/sheet (add/edit subject) | → `subj-add-gpa` (modal, "GPA"); → `subj-add-pct` (modal, "%") | ← `subj-list` (flow, "+ Subject") |
| `subj-add-gpa` | state (target as GPA) | — (terminal) | ← `subj-add` (modal, "GPA") |
| `subj-add-pct` | state (target as %) | — (terminal) | ← `subj-add` (modal, "%") |
| `subj-file` | sheet (add file, GCS upload) | — (terminal) | ← `subj-detail` (modal, "+ File") |
| `subj-menu` | menu (··· semester menu) | → `subj-add-sem` (modal); → `subj-edit-sem` (modal); → `subj-sort` (modal) | ← `subj-list` (modal, "···") |
| `subj-add-sem` | sheet/dialog (add semester) | — (terminal) | ← `subj-menu` (modal) |
| `subj-edit-sem` | route/sheet (edit semesters) | — (terminal) | ← `subj-menu` (modal) |
| `subj-sort` | menu/sheet (sort subjects) | — (terminal) | ← `subj-menu` (modal) |
| `subj-share` | sheet (share / referral) | — (terminal) | ← `subj-detail` (modal, "Share") |

**State toggles:** `subj-add-gpa`/`subj-add-pct` toggle the target-type segmented control on the `subj-add` form.

---

## 04 — Focus  (`fam: focus`, color `#1499a3`, **core / tab root**)

The only journey with a `loop` edge (`fc-paused` → `fc-running`).

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `fc-set` | route (HUB, set timer) | → `fc-link` (modal, "Link"); → `fc-duration` (modal, "Time"); → `fc-prism` (modal, "Prism"); → `fc-running` (flow, "Start") | ← bottom nav |
| `fc-link` | sheet (link a task) | — (terminal) | ← `fc-set` (modal, "Link") |
| `fc-duration` | dialog (set time) | — (terminal) | ← `fc-set` (modal, "Time") |
| `fc-prism` | sheet (Prism mode picker) | — (terminal) | ← `fc-set` (modal, "Prism") |
| `fc-running` | route (live melt, Redis/Socket.IO) | → `fc-paused` (flow, "Pause"); → `fc-end` (flow, "Done") | ← `fc-set` (flow, "Start"); ← `fc-paused` (loop, "Resume") |
| `fc-paused` | state (frozen cube) | → `fc-running` (loop, "Resume") | ← `fc-running` (flow, "Pause") |
| `fc-end` | route/dialog (session complete) | → `plan-timeline` (cross, "Back to plan") | ← `fc-running` (flow, "Done") |

**State toggle:** `fc-paused` is `fc-running` with the timer frozen (Pause button); Resume loops back.

---

## 05 — Ada AI  (`fam: ada`, color `#e85476`, **core / tab root**)

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `ada-empty` | route (HUB, intro/empty) | → `ada-chat` (flow, "Ask") | ← bottom nav |
| `ada-chat` | route (active chat, Claude via Vertex AI, streamed) | → `ada-history` (modal, "History"); → `plan-timeline` (cross, "Added to plan") | ← `ada-empty` (flow, "Ask") |
| `ada-history` | sheet/route (chat history, tap ☰) | — (terminal) | ← `ada-chat` (modal, "History") |

---

## 06 — Profile / Stats  (`fam: support`, color `#e8a430`, **core / tab root**)

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `profile-top` | route (HUB, streak & mood week) | → `profile-main` (flow, "Scroll") | ← bottom nav |
| `profile-main` | state (same route, scrolled — hub) | → `referral` (modal, "Invite"); → `settings-home` (cross, "Settings") | ← `profile-top` (flow, "Scroll") |
| `referral` | sheet (invite-a-friend, tap ↑) | — (terminal) | ← `profile-main` (modal, "Invite") |

**State toggle:** `profile-main` is the lower portion of the profile route reached by scrolling `profile-top`. It is the gateway into Settings (Section 13).

---

## 07 — Mood Check-in  (`fam: support`, color `#e8a430`; time/system-triggered)

These are not reached by tapping a tab — they are fired by time of day, and both connect to `plan-timeline`.

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `mood-morning` | route/sheet (morning check-in) | → `plan-timeline` (cross, "Start day") | — (system/time-triggered entry) |
| `mood-evening` | route/sheet (evening reflection) | — (terminal) | ← `plan-timeline` (cross, "End of day") |

---

## 09 — Context & Overflow  (`fam: support`, color `#e8a430`)

Both reached from `plan-timeline` via gestures.

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `task-swipe` | state (swipe affordance on a task row) | — (terminal) | ← `plan-timeline` (cross, "Swipe") |
| `task-overflow` | sheet (task action sheet) | — (terminal) | ← `plan-timeline` (cross, "Long-press") |

**State toggle:** `task-swipe` is a swipe gesture on a timeline task row revealing inline quick actions; `task-overflow` is the long-press full action sheet.

---

## 13 — Settings  (`fam: support`, color `#e8a430`)

Entered from `profile-main` "Settings" (cross). Spine = sub-routes; modals = sheets.

| Node | FRAMES kind | OUT edges | IN edges |
|------|-------------|-----------|----------|
| `settings-home` | route (HUB; profile card, study tags, prefs) | → `settings-addtag` (modal, "+ Tag"); → `settings-profile` (flow, "Profile"); → `settings-account` (flow, "Scroll"); → `settings-notif` (flow, "Notifs"); → `settings-appearance` (modal, "Appearance"); → `settings-sounds` (flow, "Prism") | ← `profile-main` (cross, "Settings") |
| `settings-addtag` | sheet (add new tag) | — (terminal) | ← `settings-home` (modal, "+ Tag") |
| `settings-profile` | route (edit personal info) | → `settings-editname` (modal, "Name"); → `settings-email-change` (modal, "Email") | ← `settings-home` (flow, "Profile") |
| `settings-editname` | sheet (edit name) | — (terminal) | ← `settings-profile` (modal, "Name") |
| `settings-email-change` | sheet (change email) | — (terminal) | ← `settings-profile` (modal, "Email") |
| `settings-account` | state (account & about, scrolled) | → `settings-email` (flow, "Email") | ← `settings-home` (flow, "Scroll") |
| `settings-notif` | route (notifications) | → `settings-notif-more` (flow, "Scroll") | ← `settings-home` (flow, "Notifs") |
| `settings-notif-more` | state (notifications scrolled) | — (terminal) | ← `settings-notif` (flow, "Scroll") |
| `settings-appearance` | sheet (Light/Dark/System) | — (terminal) | ← `settings-home` (modal, "Appearance") |
| `settings-sounds` | route (Prism) | — (terminal) | ← `settings-home` (flow, "Prism") |
| `settings-email` | route (email settings) | — (terminal) | ← `settings-account` (flow, "Email") |

**State toggles:** `settings-account` is `settings-home` scrolled to the account/about region; `settings-notif-more` is `settings-notif` scrolled down.

> **Note — Settings frames in FRAMES.md not present in the flow map:** `settings-gender`, `settings-password`, `settings-university`, `settings-program`, `settings-delete`, `settings-rate`, `settings-notif-sound`. These 7 settings sheets/dialogs exist as build frames but have **no edges drawn** in the comprehensive flow map. By analogy with the modeled settings sheets, they open as modal sheets/dialogs from their parent (`settings-profile` for gender/university/program/password; `settings-home`/`settings-account` for delete/rate; `settings-notif` for notif-sound) and are terminal. Confirm exact triggers against the prototype artboards before wiring.

---

## Master edge list (all 83, source order)

```
ENTRY
  splash → welcome            flow
  welcome → auth              flow   "Sign in"
  welcome → signup            flow   "Sign up"
  welcome → guest-home        cross  "Jump in"
  signup → otp                flow
  otp → ob-referral           cross  "Verified"
  auth → plan-timeline        cross  "Returning"
GUEST
  guest-home → guest-subjects flow
  guest-home → guest-ada      modal  "Tap Ada"
  guest-home → guest-stats    modal  "Tap Stats"
  guest-home → guest-save     modal  "Session end"
  guest-ada → ob-referral     cross  "Set up"
  guest-save → signup         cross  "Save"
ONBOARDING
  ob-referral → ob1           flow
  ob1 → ob2                   flow
  ob2 → ob2-add               modal  "Add"
  ob2 → ob-mood               flow
  ob-mood → ob3               flow
  ob3 → ob4                   flow
  ob4 → ob5                   flow
  ob5 → adaload               flow
  adaload → plan-timeline     cross  "Enter app"
PLAN
  plan-timeline → plan-breakdown          flow   "Expand"
  plan-timeline → plan-list               flow   "List"
  plan-timeline → plan-anytime-collapsed  modal
  plan-timeline → plan-planned-collapsed  modal
  plan-timeline → plan-otherday           flow   "Pick day"
  plan-otherday → plan-month              modal  "Calendar"
  plan-month → plan-month-next            modal
  plan-month → plan-monthyear             modal  "Year"
  plan-timeline → plan-quickadd           modal  "+ Quick"
  plan-quickadd → plan-addtask            flow   "Details"
  plan-timeline → plan-menu               modal  "···"
  plan-menu → plan-grouping               modal
  plan-menu → plan-logmood                modal
  plan-menu → plan-resched                modal
  plan-resched → plan-move                modal
  plan-timeline → plan-addtask            flow   "Add task"
  plan-addtask → plan-pick-time           modal  "Time"
  plan-pick-time → plan-pick-time-custom  modal
  plan-addtask → plan-pick-date           modal  "Date"
  plan-addtask → plan-pick-duration       modal  "Length"
  plan-pick-duration → plan-pick-duration-custom modal
  plan-addtask → plan-pick-repeat         modal  "Repeat"
  plan-pick-repeat → plan-pick-repeat-custom modal
  plan-timeline → task-swipe              cross  "Swipe"
  plan-timeline → task-overflow           cross  "Long-press"
SUBJECTS
  subj-list → subj-detail     flow   "Open"
  subj-list → subj-add        flow   "+ Subject"
  subj-add → subj-add-gpa     modal  "GPA"
  subj-add → subj-add-pct     modal  "%"
  subj-detail → subj-file     modal  "+ File"
  subj-list → subj-menu       modal  "···"
  subj-menu → subj-add-sem    modal
  subj-menu → subj-edit-sem   modal
  subj-menu → subj-sort       modal
  subj-detail → subj-share    modal  "Share"
FOCUS
  fc-set → fc-link            modal  "Link"
  fc-set → fc-duration        modal  "Time"
  fc-set → fc-prism           modal  "Prism"
  fc-set → fc-running         flow   "Start"
  fc-running → fc-paused      flow   "Pause"
  fc-paused → fc-running      loop   "Resume"
  fc-running → fc-end         flow   "Done"
  fc-end → plan-timeline      cross  "Back to plan"
ADA
  ada-empty → ada-chat        flow   "Ask"
  ada-chat → ada-history      modal  "History"
  ada-chat → plan-timeline    cross  "Added to plan"
PROFILE
  profile-top → profile-main  flow   "Scroll"
  profile-main → referral     modal  "Invite"
  profile-main → settings-home cross "Settings"
MOOD
  mood-morning → plan-timeline cross "Start day"
  plan-timeline → mood-evening cross "End of day"
SETTINGS
  settings-home → settings-addtag       modal  "+ Tag"
  settings-home → settings-profile      flow   "Profile"
  settings-profile → settings-editname  modal  "Name"
  settings-profile → settings-email-change modal "Email"
  settings-home → settings-account      flow   "Scroll"
  settings-home → settings-notif        flow   "Notifs"
  settings-notif → settings-notif-more  flow   "Scroll"
  settings-home → settings-appearance   modal  "Appearance"
  settings-home → settings-sounds       flow   "Prism"
  settings-account → settings-email     flow   "Email"
```
