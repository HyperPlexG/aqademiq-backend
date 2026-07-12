# Section 13a — Settings

Pixel-exact build spec for the Settings family. Source prototype: `prototypes/Aqademiq V1 Full Flow v5.html`. Flow map: `prototypes/Aqademiq User Flow - Comprehensive.html`.

## Shared design tokens (resolved, default theme = light + Warm + accent #6b5cf0)

The prototype uses mutable tokens resolved by `applyTweaks(TWEAK_DEFAULTS)` where defaults are `accent="#6b5cf0"`, `warmth="Warm"`, `darkMode=false`. Resolved values used by every screen below:

| Token | Value | Usage |
|---|---|---|
| `ACC` | `#6b5cf0` | accent (active toggle, selected ring, cursor, links) |
| `ACCL` | `#edeafd` | accent-light (selected option bg, avatar gradient inner) |
| `INK` | `#111111` | primary CTA buttons, active nav pill, send button bg |
| `BG` | `#f4f3f0` | phone background, input field fill |
| `WHITE` | `#ffffff` | cards, sheet panel, nav bar |
| `TEXT` | `#111111` | primary text |
| `MED` | `#777777` | muted / secondary text, group labels |
| `DIM` | `#c0c0c0` | chevrons, off-toggle track, tag close icons |
| `HILITE` | `#eceae7` | unselected option pill bg, time pill bg |
| `BORDER` | `rgba(0,0,0,0.07)` | row dividers, chip outlines |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` | cards, back btn |
| `SUCC` | `#2a9d6b` | "Assignment" tag |
| `WARN` | `#e8a430` | "Report" tag |
| Danger red | `#e85476` | delete account, "Exam" tag, destructive text |
| `SANS` | `"Plus Jakarta Sans", system-ui, sans-serif` | all text |

**Phone shell** (`Phone`): width 262, height 522, borderRadius 34, background `BG`, `overflow:hidden`, `position:relative`, fontFamily `SANS`, color `TEXT`, fontSize 12, boxShadow `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`. Status bar: height 30, padding `0 18px`, fontSize 10 fontWeight 700; left "9:41", center pill 36×12 radius 6 bg `#111`, right "●▊" letterSpacing -1.
NOTE artboard declares `width={W} height={H}` with `W=280, H=572`, but the rendered `Phone` is 262×522. Use 262×522 as the live canvas.

**Bottom nav** (`BNav active={3}` on every settings screen): `position:absolute; bottom:8; left:10; right:10; height:56; background:WHITE; borderRadius:20; boxShadow:0 4px 28px rgba(0,0,0,0.13); padding:0 8px`. 5 slots, visual order Subjects(menu_book,0) · Planner(calendar_today,1) · Ada center(4) · Timer(timer,2) · Stats(bar_chart,3). Active tab (index 3 = Stats) shows a 46×40 radius-14 `INK` pill with white icon at fontSize 24; inactive icons are `MED`. Center Ada slot is a 44×44 circle. Settings is reached from Profile, so no nav slot is "settings" — Stats (3) stays highlighted.

**Back button** (`BackBtn`): 38×38 circle, background `WHITE`, boxShadow `SHADOW`, centered `chevron_left` material-icons-outlined fontSize 21 color `TEXT`.

**SetBody** (scroll container shared by all settings routes): `position:absolute; top:30; left:0; right:0; bottom:0; flex column`. Header zone `padding:4px 16px 0`. Two header variants:
- `big` (settings-home only): BackBtn with `marginBottom:14`, then a row `gap:9 marginBottom:16` of optional `settings` gear icon (fontSize 25, color TEXT) + title at fontSize **26** fontWeight **800**.
- default (profile + all sub-screens): row `gap:12 marginBottom:16` of BackBtn + title at fontSize **20** fontWeight **800**.
Scroll body: `flex:1; overflow:hidden; padding:0 16px`, mask-image `LIST_FADE` (`linear-gradient(to bottom, #000 calc(100% - 74px), rgba(0,0,0,0.15) calc(100% - 30px), transparent calc(100% - 8px))`) — bottom fade so list disappears behind nav. Inner content translated by `-offset` px (offset 0 unless scrolled state). Trailing spacer `height:76` (`NAV_CLEARANCE`).

**Reusable row primitives:**
- `GroupLabel`: fontSize 12.5, fontWeight 700, color `MED`, margin `0 0 8px 3px`.
- `SetGroup`: background `WHITE`, borderRadius 18, boxShadow `SHADOW`, `overflow:hidden` (clips rows).
- `SetRow`: `display:flex; align-items:center; gap:11; padding:12px 15px; borderBottom: last ? none : 1px solid BORDER`. Optional leading `icon` (material-icons-outlined fontSize 20, color `danger?#e85476 : iconColor||TEXT`). Label fontSize 13.5 fontWeight 600 color `danger?#e85476:TEXT` (lineHeight 1.3). Optional right `value` text fontSize 12.5 color `MED` fontWeight 500 right-aligned ellipsis. Trailing affordances: `TimePill` (bg HILITE, radius 100, padding 5px 12px, fontSize 12 fw700), `Toggle`, or `chevron_right` (fontSize 19 color `DIM`).
- `Toggle`: 46×27 radius 100, track `on?ACC:DIM`, padding 3, knob 21×21 white circle boxShadow `0 1px 3px rgba(0,0,0,0.25)`, justifies end when on.

**SheetPanel** (slide-up container for every settings *sheet*): `position:absolute; bottom:0; left:0; right:0; background:WHITE; borderRadius:24px 24px 0 0; boxShadow:0 -12px 48px rgba(20,15,28,0.28); padding:12px 18px 24px`. Drag handle: 38×4 radius 2, bg `#e0ddd7`, margin `0 auto 16px`. Optional title fontSize **20** fontWeight **800** marginBottom 16.

**SettingsSheet** (scrim wrapper): renders the real dimmed `body` (a `SetBody`) + `BNav active={3}` + full-bleed scrim `position:absolute; inset:0; background:rgba(20,15,28,0.42)` + the `SheetPanel`. So every sheet shows the live parent screen, dimmed 42%, with the panel docked to the bottom.

---

## settings-home — route — Settings hub

Artboard line 3991: `<SETTINGS_HOME/>` → `<SetScreen title="Settings" big gear><HomeBody/></SetScreen>`. `big gear` header: BackBtn, then gear icon (25px) + "Settings" at 26/800.

**Top-to-bottom layout (`HomeBody`, padding 0 16px inside SetBody):**
1. **Profile card** (tap → settings-profile): `flex; align-items:center; gap:13; background:WHITE; borderRadius:18; boxShadow:SHADOW; padding:13px 15px; marginBottom:20`. Avatar 46×46 circle `radial-gradient(circle at 38% 33%, #edeafd, #6b5cf0)` boxShadow `0 4px 14px #6b5cf044`, centered 🎓 emoji fontSize 22. Text col: name "Ridhwan Ahamed" fontSize 15 fw800; sub "BITS Pilani Dubai · CS Undergrad" fontSize 11.5 color MED marginTop 1. Trailing `chevron_right` fontSize 20 color DIM.
2. **GroupLabel "Study tags"**.
3. **Tags card**: `background:WHITE; borderRadius:18; boxShadow:SHADOW; padding:13px 13px 14px; marginBottom:7`. Wrap container `flex-wrap; gap:7`. Seven tag chips, each `inline-flex; align-items:center; gap:6; background:WHITE; border:1px solid BORDER; borderRadius:100; padding:5px 9px 5px 10px`: 7×7 colored dot + label fontSize 11.5 fw700 color TEXT + `close` icon fontSize 13 color DIM. Tags & dot colors in order: Lecture `#5cbbff`, Class `#6b5cf0`, Exam `#e85476`, Assignment `#2a9d6b`, Report `#e8a430`, Presentation `#c0497b`, Reading `#9aa3b2`. Then **"+ New tag"** chip (tap → settings-addtag): `inline-flex; align-items:center; gap:3; border:1.5px dashed #6b5cf088; borderRadius:100; padding:5px 11px 5px 9px; color:ACC; fontSize 11.5; fw700`, leading `add` icon fontSize 14.
4. **Helper text**: "Ada uses your tags to read your workload and shape your plan." fontSize 10.5 color MED lineHeight 1.5 margin `0 4px 20px`.
5. **GroupLabel "Preferences"** + `SetGroup` (marginBottom 20), rows (all chevron): Notifications (icon notifications_none) → settings-notif; Appearance (wb_sunny, value "System") → settings-appearance sheet; Prism (graphic_eq, value "Deep Work") → settings-sounds; Calendar import (calendar_today); Reminder import (format_list_bulleted, `last`).
6. **GroupLabel "Account"** + `SetGroup` (marginBottom 20): Email settings (chat_bubble_outline) → settings-email; Sign out (logout); Delete account (delete_outline, `danger`, `last`) → delete dialog (red `#e85476`).
7. **GroupLabel "About"** + `SetGroup`: Rate Aqademiq (star_outline) → rate sheet; Privacy Policy (description); Terms of service (help_outline, `last`).
8. Trailing 76px nav clearance spacer.

**Transitions:**
- INTO: `profile-main → settings-home` (cross, label "Settings").
- OUT: `settings-home → settings-addtag` (modal, "+ Tag"); `→ settings-profile` (flow, "Profile"); `→ settings-account` (flow, "Scroll" — same page scrolled, header collapses, offset 600); `→ settings-notif` (flow, "Notifs"); `→ settings-appearance` (modal, "Appearance"); `→ settings-sounds` (flow, "Prism"). Back button → profile-main.

---

## settings-addtag — sheet — New study tag

Artboard line 3992: `<ADD_TAG_SHEET/>`. `SettingsSheet` with body = dimmed settings-home (`SetBody title="Settings" big gear` + HomeBody), scrim 42%, panel = `SheetPanel title="New study tag"`. Preset state: `name="Tutorial"`, `selected=#e85476`. Color palette array: `['#5cbbff', '#6b5cf0', '#e85476', '#2a9d6b', '#e8a430', '#c0497b', '#9aa3b2']`.

**Panel layout (top→bottom):**
1. **Live preview chip** (centered, marginBottom 18): `inline-flex; align-items:center; gap:7; background:WHITE; border:1px solid BORDER; borderRadius:100; padding:7px 15px; boxShadow:SHADOW`. 9×9 dot bg = selected color `#e85476` + "Tutorial" fontSize 13 fw700 color TEXT.
2. **"Name" field label**: fontSize 12 fw700 color MED margin `0 2px 7px`.
3. **Name input**: `flex; align-items:center; background:BG; borderRadius:14; padding:12px 15px; marginBottom:18`. Text "Tutorial" fontSize 14 fw600 color TEXT + blinking cursor `|` color ACC fw400.
4. **"Colour" label**: fontSize 12 fw700 color MED margin `0 2px 11px`.
5. **Swatch row**: `flex; justify-content:space-between; marginBottom:22; padding:0 2px`. Seven 28×28 circles in palette order. Selected (`#e85476`) gets boxShadow `0 0 0 2px #ffffff, 0 0 0 4px #e85476` (white gap + colored ring) and a centered white `check` icon fontSize 16.
6. **"Add tag" CTA**: `background:INK(#111); borderRadius:100; padding:13px 0; text-align:center; fontSize 14; fw800; color:#fff`.

**Transitions:**
- INTO: `settings-home → settings-addtag` (modal, "+ Tag").
- OUT: dismiss (scrim tap / handle) → settings-home; "Add tag" commits and returns to settings-home (implied).

---

## settings-profile — route — Profile (edit personal info)

Artboard line 3993: `<SETTINGS_PROFILE/>` → `<SetScreen title="Profile"><ProfileBody/></SetScreen>`. Default header (BackBtn + "Profile" at 20/800), `BNav active={3}`.

**Top-to-bottom layout (`ProfileBody`):**
1. **Avatar block** (centered column, marginBottom 20): 72×72 circle `radial-gradient(circle at 38% 33%, #edeafd, #6b5cf0)` boxShadow `0 6px 20px #6b5cf044` marginBottom 9, centered 🎓 fontSize 34. Below: "Change photo" fontSize 12 fw800 color `ACC`.
2. **GroupLabel "Personal"** + `SetGroup` (marginBottom 20): rows (all chevron, value style): Name value "Ridhwan Ahamed" → settings-editname; Gender value "Prefer not to say" → settings-gender; Date of birth value "Add" `last` (no documented sheet).
3. **GroupLabel "Account"** + `SetGroup` (marginBottom 20): Email value "f20230375@dubai…" (truncated) → settings-email-change; Password (no value) `last` → settings-password.
4. **GroupLabel "Study"** + `SetGroup`: University value "BITS Dubai" → settings-university; Program value "CS · Undergrad" `last` → settings-program.
5. 76px nav clearance.

Note: rows here use `value` (no leading icon) — label flex `0 0 auto`, value fontSize 12.5 color MED right-aligned, chevron 19px DIM.

**Transitions:**
- INTO: `settings-home → settings-profile` (flow, "Profile").
- OUT (documented in flow map): `settings-profile → settings-editname` (modal, "Name"); `→ settings-email-change` (modal, "Email"). OUT (prototype rows, not in flow map): Gender → settings-gender; Password → settings-password; University → settings-university; Program → settings-program — all open as bottom sheets over this dimmed Profile. Back → settings-home.

---

## settings-editname — sheet — Edit name

Artboard line 3994: `<EDIT_NAME_SHEET/>` → `<InputSheet title="What should we call you?" value="Ridhwan Ahamed" />`. `light` prop = false (dark send button).

`InputSheet` = `SettingsSheet` with body = dimmed Profile (`SetBody title="Profile"` + ProfileBody), scrim 42%, panel = `SheetPanel title=<title>`:
- **Title**: "What should we call you?" 20/800, marginBottom 16.
- **Input row**: `flex; align-items:center; gap:10; background:BG; borderRadius:14; padding:12px 12px 12px 15px`. Value text flex:1 fontSize 14 fw600 color TEXT, single-line ellipsis, "Ridhwan Ahamed" + cursor `|` color ACC fw400.
- **Send button** (right): 34×34 circle. `light=false` → background `INK(#111)`, no shadow, white `arrow_upward` icon fontSize 18 color `#fff`.

**Transitions:**
- INTO: `settings-profile → settings-editname` (modal, "Name").
- OUT: dismiss → settings-profile; submit (arrow_upward) commits name → settings-profile.

---

## settings-gender — sheet — Gender

Artboard line 3995: `<GENDER_SHEET/>`. `SettingsSheet` body = dimmed Profile (`SetBody title="Profile"` + ProfileBody), scrim 42%, panel = `SheetPanel title="Gender"`.

**Options** rendered as `OptionRow` (pill rows): each `flex; align-items:center; justify-content:space-between; padding:13px 16px; borderRadius:100; marginBottom:9`. Unselected: background `HILITE(#eceae7)`, border `1.5px solid transparent`, label fontSize 13.5 fw700 color TEXT. Selected: background `ACCL(#edeafd)`, border `1.5px solid ACC(#6b5cf0)`, label color `ACC`, trailing `check_circle` icon fontSize 20 color ACC.

Order: Female, Male, Non-binary (all unselected), **Prefer not to say (selected)**.

**Transitions:**
- INTO: `settings-profile` Gender row → settings-gender (sheet/modal; not in flow map, inferred from `ProfileBody` Gender row → matches GENDER_SHEET; parent dim body is "Profile").
- OUT: select option / dismiss → settings-profile.

---

## settings-email-change — sheet — Change email

Artboard line 3996: `<CHANGE_EMAIL_SHEET/>` → `<InputSheet title="Change email address" value="f20230375@dubai.bits-pilani.ac.in" light />`. Same `InputSheet` as edit-name but **`light=true`**.

- Body = dimmed Profile; scrim 42%; `SheetPanel title="Change email address"` (20/800).
- **Input row**: same BG-filled pill; value "f20230375@dubai.bits-pilani.ac.in" fontSize 14 fw600 single-line ellipsis + ACC cursor.
- **Send button**: `light=true` → 34×34 circle background `WHITE`, boxShadow `SHADOW`, `arrow_upward` icon fontSize 18 color `TEXT(#111)` (dark icon on white instead of white-on-ink).

**Transitions:**
- INTO: `settings-profile → settings-email-change` (modal, "Email").
- OUT: dismiss → settings-profile; submit → settings-profile.

---

## settings-password — sheet — Change password

Artboard line 3997: `<CHANGE_PASSWORD_SHEET/>`. `SettingsSheet` body = dimmed Profile (`SetBody title="Profile"` + ProfileBody), scrim 42%, panel = `SheetPanel title="Change password"`.

**Three labeled fields**, each block marginBottom 13:
- Field label fontSize 11.5 fw700 color MED margin `0 2px 6px`.
- Field box: `background:BG; borderRadius:14; padding:12px 15px; fontSize 14; fw600; minHeight:18`. First field ("Current password") shows active cursor `|` color ACC; the other two ("New password", "Confirm new password") render an empty space (no cursor).
Order: Current password (cursor), New password, Confirm new password.

**CTA "Update password"**: marginTop 5, `background:INK(#111); borderRadius:100; padding:13px 0; text-align:center; fontSize 13.5; fw800; color:#fff`.

**Transitions:**
- INTO: `settings-profile` Password row → settings-password (sheet; not in flow map, inferred from `ProfileBody` Password row → CHANGE_PASSWORD_SHEET).
- OUT: "Update password" / dismiss → settings-profile.

---

## settings-university — sheet — University

Artboard line 3998: `<EDIT_UNI_SHEET/>` → `<InputSheet title="Your university" value="BITS Dubai" />` (`light=false`, dark send button).

- Body = dimmed Profile; scrim 42%; `SheetPanel title="Your university"` (20/800).
- **Input row**: BG-filled pill, value "BITS Dubai" fontSize 14 fw600 + ACC cursor.
- **Send button**: 34×34 circle background `INK(#111)`, white `arrow_upward` fontSize 18.

**Transitions:**
- INTO: `settings-profile` University row → settings-university (sheet; not in flow map, inferred from `ProfileBody` University row → EDIT_UNI_SHEET).
- OUT: submit / dismiss → settings-profile.

---

## settings-program — sheet — Program

Artboard line 3999: `<EDIT_PROGRAM_SHEET/>` → `<InputSheet title="Your program" value="CS · Undergrad" />` (`light=false`, dark send button).

- Body = dimmed Profile; scrim 42%; `SheetPanel title="Your program"` (20/800).
- **Input row**: BG-filled pill, value "CS · Undergrad" fontSize 14 fw600 + ACC cursor.
- **Send button**: 34×34 circle background `INK(#111)`, white `arrow_upward` fontSize 18.

**Transitions:**
- INTO: `settings-profile` Program row → settings-program (sheet; not in flow map, inferred from `ProfileBody` Program row → EDIT_PROGRAM_SHEET).
- OUT: submit / dismiss → settings-profile.

---

### Build notes / gaps
- All four of settings-gender, settings-password, settings-university, settings-program exist as prototype artboards but are **absent from the flow map** (no nodes/edges). Their parent trigger is the corresponding `ProfileBody` row in settings-profile; each opens as a bottom sheet over the dimmed Profile screen. Treat them as `modal/sheet` kind.
- `InputSheet` drives 4 frames (editname, email-change, university, program). Only difference among them: title, value string, and the `light` flag (true only for email-change → white send button with dark icon; all others → ink send button with white icon).
- Settings sheets keep `BNav active={3}` visible behind the 42% scrim; do not hide the nav when presenting a settings sheet.
- "Date of birth" (value "Add") row on settings-profile has no defined destination artboard.
