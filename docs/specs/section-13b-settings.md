# Section 13b — Settings (build spec)

Pixel-exact spec for the Settings sub-screens, sheets and dialogs. Extracted from
`prototypes/Aqademiq V1 Full Flow v5.html`. All values are real (hex / px / fontWeight).

Light theme is the default; tokens below are the light-theme values used by every frame here.

## Shared design tokens (light theme)

| Token | Value |
|---|---|
| `BG` (screen background) | `#f4f3f0` |
| `WHITE` (cards/rows/sheets) | `#ffffff` |
| `INK` (dark buttons / active nav) | `#111111` |
| `TEXT` | `#111111` |
| `MED` (secondary text) | `#777777` |
| `DIM` (chevrons, off-toggle, faint) | `#c0c0c0` |
| `ACC` (accent / purple) | `#6b5cf0` |
| `ACCL` (accent light fill) | `#edeafd` |
| `HILITE` (grey pill fill) | `#eceae7` |
| `BORDER` (row dividers) | `rgba(0,0,0,0.07)` |
| `SHADOW` (card shadow) | `0 2px 16px rgba(0,0,0,0.08)` |
| `SUCC` | `#2a9d6b` · `WARN` | `#e8a430` · danger red | `#e85476` |
| `SANS` (titles) | `"Plus Jakarta Sans", system-ui, sans-serif` |
| `NAV_CLEARANCE` (bottom spacer) | `76px` |

### Phone frame (every settings frame is wrapped in `<Phone>`)
- Width `262`, height `522`, `borderRadius: 34`, background `BG`, `overflow: hidden`, `position: relative`, `fontFamily: SANS`, `color: TEXT`, base `fontSize: 12`.
- Box shadow `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
- Status bar: height `30`, padding `0 18px`, space-between, `fontSize: 10`, `fontWeight: 700` — left "9:41", center pill `36×12` `#111` radius 6, right "●▊" (letterSpacing -1).
- NOTE: artboard authoring size is `W=280, H=572` but the rendered Phone is fixed `262×522`.

### Bottom nav `BNav` (active index 3 = Stats highlighted on all these frames)
- Position absolute, `bottom: 8, left: 10, right: 10`, height `56`, background `WHITE`, `borderRadius: 20`, shadow `0 4px 28px rgba(0,0,0,0.13)`, padding `0 8px`, row space-between.
- 5 tabs in visual order: `menu_book`(idx0) · `calendar_today`(idx1) · Ada-center(idx4) · `timer`(idx2) · `bar_chart`(idx3).
- Standard tab: `46×40` radius `14`; active → background `INK`, icon `#fff`; inactive → transparent, icon `MED` `#777`, icon `fontSize: 24`.
- Center Ada tab: `44×44` circle; active `INK` bg, inactive `WHITE` bg + `1.5px solid BORDER`.

### `SetBody` scaffold (used by every full-screen settings frame)
- Outer: absolute `top: 30, left:0, right:0, bottom:0`, flex column.
- Header block padding `4px 16px 0`, flexShrink 0.
  - **Compact header** (`big` false): row gap `12`, marginBottom `16` — `BackBtn` then title `fontFamily SANS, fontSize 20, fontWeight 800`.
  - **Big header** (`big` true): `BackBtn` marginBottom `14`; then row gap `9` marginBottom `16` with optional `settings` gear icon (`fontSize 25, color TEXT`) + title `fontSize 26, fontWeight 800`.
- Scroll area: `flex: 1, overflow: hidden, padding: 0 16px`. Mask = `LIST_FADE` normally, `LIST_FADE_BOTH` when `offset>0`.
  - `LIST_FADE` = `linear-gradient(to bottom, #000 calc(100% - 74px), rgba(0,0,0,0.15) calc(100% - 30px), transparent calc(100% - 8px))`.
  - `LIST_FADE_BOTH` = `linear-gradient(to bottom, transparent 0, #000 26px, #000 calc(100% - 74px), rgba(0,0,0,0.15) calc(100% - 30px), transparent calc(100% - 8px))`.
- Inner content wrapped in `translateY(-offset)`; trailing spacer `height: NAV_CLEARANCE (76)`.

### `BackBtn`
- Circle `38×38`, radius 50%, background `WHITE`, shadow `SHADOW`, centered `chevron_left` icon `fontSize 21, color TEXT`.

### `GroupLabel` (section header above a card)
- `fontSize 12.5, fontWeight 700, color MED, margin: 0 0 8px 3px`.

### `SetGroup` (rounded white card that clips rows)
- background `WHITE`, `borderRadius 18`, `boxShadow SHADOW`, `overflow hidden`. (Per-frame `marginBottom` noted below.)

### `SetRow` (one settings row)
- Flex row, `alignItems center, gap 11, padding 12px 15px`; bottom border `1px solid BORDER` unless `last`.
- Optional leading `icon` (material-icons-outlined `fontSize 20`, color = `#e85476` if `danger` else `iconColor||TEXT`).
- Label: `fontSize 13.5, fontWeight 600, color TEXT` (or `#e85476` if danger), `lineHeight 1.3`.
- Optional `sub`: `fontSize 11, color MED, marginTop 2`.
- Optional `value` (right text): `fontSize 12.5, color MED, fontWeight 500, textAlign right`, ellipsized.
- Optional `pill` → `TimePill`: background `HILITE`, `borderRadius 100, padding 5px 12px, fontSize 12, fontWeight 700, color TEXT`.
- Optional `toggle` → `Toggle`: track `46×27` radius 100, padding 3; on → background `ACC`, knob flex-end; off → background `DIM`. Knob `21×21` circle `#fff`, shadow `0 1px 3px rgba(0,0,0,0.25)`.
- Optional `chevron`: `chevron_right` `fontSize 19, color DIM`.

### `SheetPanel` (bottom sheet container — sheets only)
- Absolute `bottom 0, left 0, right 0`, background `WHITE`, `borderRadius 24px 24px 0 0`, shadow `0 -12px 48px rgba(20,15,28,0.28)`, padding `12px 18px 24px`.
- Drag handle `38×4` radius 2 background `#e0ddd7`, `margin 0 auto 16px`.
- Optional title `fontSize 20, fontWeight 800, marginBottom 16`.

### `SettingsSheet` (scrim + sheet over dimmed real screen — sheets only)
- Renders the dimmed `body` (a `SetBody`), then `BNav active=3`, then full-screen scrim `position absolute, inset 0, background rgba(20,15,28,0.42)`, then the `panel` (a `SheetPanel`).

### `OptionRow` (pill option used by sound/gender sheets)
- Flex row space-between, `padding 13px 16px, borderRadius 100, marginBottom 9`.
- Selected → background `ACCL`, border `1.5px solid ACC`; unselected → background `HILITE`, border `1.5px solid transparent`.
- Label `fontSize 13.5, fontWeight 700`, color `ACC` if selected else `TEXT`; selected shows trailing `check_circle` `fontSize 20, color ACC`.

---

## settings-account — state — Account & About (the settings home, scrolled)

**Renders:** `<SETTINGS_ACCOUNT/>` = `<SetScreen title="Settings" offset={600}><HomeBody/></SetScreen>`.
It is the **same page as `settings-home`**, scrolled down by `offset=600px` (content shifted up via `translateY(-600px)`). Because `offset>0`, the header is the **compact** variant (title `fontSize 20, fontWeight 800`, no big gear) and the scroll area uses `LIST_FADE_BOTH` (fade at both top and bottom). `BNav active=3`.

**Full `HomeBody` content top→bottom (the whole scrolling page; this frame shows the lower portion):**
1. **Profile card** (row): flex `gap 13`, background `WHITE`, `borderRadius 18`, `boxShadow SHADOW`, `padding 13px 15px`, `marginBottom 20`. Avatar `46×46` circle radial gradient `circle at 38% 33%, ACCL→ACC`, shadow `0 4px 14px ACC44`, centered `🎓` `fontSize 22`. Name "Ridhwan Ahamed" `fontSize 15, fontWeight 800`; sub "BITS Pilani Dubai · CS Undergrad" `fontSize 11.5, color MED, marginTop 1`. Trailing `chevron_right` `fontSize 20, color DIM`.
2. `GroupLabel` **"Study tags"**. Card: `WHITE, borderRadius 18, SHADOW, padding 13px 13px 14px, marginBottom 7`. Wrap of chips `gap 7`: each chip = inline-flex `gap 6`, `WHITE`, `1px solid BORDER`, radius 100, `padding 5px 9px 5px 10px`, color dot `7×7` circle, label `fontSize 11.5, fontWeight 700`, trailing `close` `fontSize 13, color DIM`. Tags + dot colors: Lecture `#5cbbff`, Class `ACC`, Exam `#e85476`, Assignment `SUCC`, Report `WARN`, Presentation `#c0497b`, Reading `#9aa3b2`. Then dashed "**+ New tag**" chip: `1.5px dashed ACC88`, radius 100, `padding 5px 11px 5px 9px`, color `ACC`, `fontSize 11.5, fontWeight 700`, leading `add` `fontSize 14`.
3. Caption "Ada uses your tags to read your workload and shape your plan." `fontSize 10.5, color MED, lineHeight 1.5, margin 0 4px 20px`.
4. `GroupLabel` **"Preferences"**. `SetGroup marginBottom 20` rows (icon · label · value/chevron):
   - `notifications_none` · Notifications · chevron
   - `wb_sunny` · Appearance · value "System" · chevron
   - `graphic_eq` · Prism · value "Deep Work" · chevron
   - `calendar_today` · Calendar import · chevron
   - `format_list_bulleted` · Reminder import · chevron · last
5. `GroupLabel` **"Account"**. `SetGroup marginBottom 20`:
   - `chat_bubble_outline` · Email settings · chevron
   - `logout` · Sign out · chevron
   - `delete_outline` · Delete account · chevron · **danger** (icon+label `#e85476`) · last
6. `GroupLabel` **"About"**. `SetGroup`:
   - `star_outline` · Rate Aqademiq · chevron
   - `description` · Privacy Policy · chevron
   - `help_outline` · Terms of service · chevron · last

**Transitions (flow map):**
- IN: `settings-home → settings-account` (kind `flow`, label "Scroll") — scrolling the settings hub reveals this lower portion.
- OUT: `settings-account → settings-email` (kind `flow`, label "Email") — tap the "Email settings" row.
- Implicit OUT from this same list (no flow-map edge, see frames): Delete account row → `settings-delete` dialog; Rate Aqademiq row → `settings-rate` sheet.

---

## settings-delete — dialog — Delete account confirm

**Renders:** `<DELETE_ACCOUNT_DIALOG/>` — built directly inside a `<Phone>` (does NOT use `SettingsSheet`). Layered:
1. `<SetBody title="Settings" big gear offset={600}>` with `<HomeBody/>` — the scrolled settings home as the dimmed backdrop (big header + gear, but offset 600).
2. `<BNav active={3}/>`.
3. Scrim: absolute `inset 0, background rgba(20,15,28,0.42)`.
4. **Centered alert card**: absolute `top 50% / left 50%`, `transform translate(-50%,-50%)`, **width 212**, background `WHITE`, `borderRadius 22`, shadow `0 20px 64px rgba(0,0,0,0.34)`, padding `18px 18px 14px`.
   - Title "**Delete account?**" `fontFamily SANS, fontSize 19, fontWeight 800, marginBottom 8`.
   - Body "This permanently removes your profile and data. There is no undo." `fontSize 12, color MED, lineHeight 1.5, marginBottom 16`.
   - Actions row: flex `justify flex-end, gap 20, padding 0 2px 2px`:
     - "Cancel" `fontSize 13, fontWeight 700, color MED`.
     - "Delete" `fontSize 13, fontWeight 800, color #e85476`.

**Transitions:** Not present as a flow-map edge. Per FRAMES.md kind = **dialog**. Toggled on by tapping the **"Delete account"** danger row in `HomeBody`'s Account group (from `settings-home`/`settings-account`). Cancel dismisses; Delete is the destructive confirm.

---

## settings-rate — sheet — Rate Aqademiq

**Renders:** `<RATE_SHEET/>` = `<SettingsSheet>` with:
- `body` = `<SetBody title="Settings" big gear offset={600}>` + `<HomeBody/>` (scrolled settings home, dimmed, big header + gear).
- `panel` = `<SheetPanel title="Rate Aqademiq">`:
  1. Caption "How has Aqademiq been treating you?" `fontSize 12.5, color MED, textAlign center, marginBottom 16`.
  2. Star row: flex `justify center, gap 14, marginBottom 20` — five `star_outline` icons `fontSize 30, color #c9c5bd` (all empty/unselected).
  3. CTA "Submit rating": background `HILITE`, `borderRadius 100, padding 13px 0, textAlign center, fontSize 13.5, fontWeight 800, color #b0aaa2` (disabled-look since no stars chosen).

**Transitions:** Not present as a flow-map edge. Per FRAMES.md kind = **sheet**. Opened by tapping the **"Rate Aqademiq"** row in `HomeBody`'s About group. Backdrop is the scrolled settings home; scrim `rgba(20,15,28,0.42)`. Dismiss by tapping scrim / dragging handle.

---

## settings-notif — route — Notifications

**Renders:** `<NOTIFICATIONS/>` = `<SetScreen title="Notifications"><NotifBody/></SetScreen>`.
Compact header (no `big`/`gear`/`offset`): `BackBtn` + "Notifications" `fontSize 20, fontWeight 800`. Scroll mask = `LIST_FADE`. `BNav active=3`.

**`NotifBody` content top→bottom:**
1. `SetGroup marginBottom 18` — single row: "Notification sound" · value "**Chime**" · chevron · last.
2. `GroupLabel` **"Tasks"**. `SetGroup marginBottom 18`:
   - "Before task" · toggle **OFF**
   - "When a task starts" · toggle **ON**
   - "Halfway through task" · toggle **OFF**
   - "When a task is finished" · toggle **OFF** · last
3. `GroupLabel` **"Time of day reminders"**. `SetGroup` (no marginBottom):
   - "All day & anytime" · toggle **ON**
   - "At time" · pill "**7:00 AM**"
   - "Morning" · toggle **ON**
   - "At time" · pill "**8:00 AM**" · last

**Transitions (flow map):**
- IN: `settings-home → settings-notif` (kind `flow`, label "Notifs").
- OUT: `settings-notif → settings-notif-more` (kind `flow`, label "Scroll").
- Implicit OUT: tapping the "Notification sound (Chime)" row opens the `settings-notif-sound` sheet (no flow-map edge).

---

## settings-notif-sound — sheet — Notification sound

**Renders:** `<NOTIF_SOUND_SHEET/>` = `<SettingsSheet>`:
- `body` = `<SetBody title="Notifications">` + `<NotifBody/>` (the Notifications screen, dimmed — compact header).
- `panel` = `<SheetPanel title="Notification sound">` with `OptionRow`s (pill list):
  1. "**Chime**" · **selected** (`ACCL` fill, `1.5px solid ACC` border, label `ACC` fontWeight 700, trailing `check_circle` `fontSize 20 ACC`).
  2. "Pulse" · unselected
  3. "Glass" · unselected
  4. "Drop" · unselected
  5. "None" · unselected
  (Unselected: `HILITE` fill, transparent border, label `TEXT`.)

**Transitions:** Not present as a flow-map edge. Per FRAMES.md kind = **sheet**. Opened by tapping the "Notification sound" row on `settings-notif`. Backdrop = dimmed Notifications; scrim `rgba(20,15,28,0.42)`. Selecting an option / tapping scrim dismisses.

---

## settings-notif-more — state — Notifications (scrolled)

**Renders:** `<NOTIFICATIONS_MORE/>` = `<SetScreen title="Notifications">…</SetScreen>` — the SAME Notifications screen scrolled further down. NOTE: it is authored as static content (NOT an `offset` translate) showing the lower groups; compact header "Notifications", scroll mask `LIST_FADE` (no `offset` prop here), `BNav active=3`.

**Content top→bottom:**
1. `GroupLabel` **"Time of day reminders"**. `SetGroup marginBottom 16`:
   - "All day & anytime" · toggle **ON**
   - "At time" · pill "**7:00 AM**"
   - "Morning" · toggle **ON**
   - "At time" · pill "**8:00 AM**" · last
2. `GroupLabel` **"Review your day"**. `SetGroup marginBottom 16`:
   - "Review today notifications" · toggle **ON**
   - "At time" · pill "**8:00 PM**" · last
3. `GroupLabel` **"Other"**. `SetGroup`:
   - "State of mind reminder" · toggle **ON**
   - "Motivational" · toggle **ON**
   - "Product updates" · toggle **ON** · last

(Note: marginBottom between groups is `16` here vs `18` on `settings-notif`.)

**Transitions (flow map):**
- IN: `settings-notif → settings-notif-more` (kind `flow`, label "Scroll").
- OUT: back to `settings-notif` (scroll up). Kind = **state** per FRAMES.md (scroll position of the Notifications route).

---

## settings-appearance — sheet — Appearance picker (Light / Dark / System)

**Renders:** `<APPEARANCE_PICKER/>` = `<SettingsSheet>`:
- `body` = `<SetBody title="Settings" big gear>` + `<HomeBody/>` (settings home, **un-scrolled**, big header + gear, dimmed).
- `panel` = `<SheetPanel title="Appearance">` with a column `display flex, flexDirection column, gap 9` of 3 option cards:

Each option card: flex `alignItems center, gap 12, padding 12px 14px, borderRadius 16`. Selected → background `ACCL`, border `1.5px solid ACC`; unselected → background `HILITE`, border `1.5px solid transparent`.
- Leading material icon `fontSize 21`, color `ACC` if selected else `TEXT`.
- Text block: title `fontSize 14, fontWeight 700` (`ACC` if selected else `TEXT`); subtitle `fontSize 11.5, color MED, marginTop 1`.
- Selected card shows trailing `check_circle` `fontSize 22, color ACC`.

Options (icon, title, subtitle, selected):
1. `light_mode` · "Light" · "Always bright" · not selected
2. `dark_mode` · "Dark" · "Easy on the eyes" · not selected
3. `brightness_auto` · "System" · "Match your device" · **SELECTED**

**Transitions (flow map):**
- IN: `settings-home → settings-appearance` (kind **`modal`**, label "Appearance") — tap the "Appearance" preferences row.
- OUT: select an option / dismiss scrim → back to settings home. Per FRAMES.md kind = **sheet**.

---

## settings-sounds — route — Prism (Focus audio + in-app sounds)

**Renders:** `<SOUNDS_SETTING/>` = `<SetScreen title="Prism"><…/></SetScreen>`.
Compact header `BackBtn` + "Prism" `fontSize 20, fontWeight 800`. Scroll mask `LIST_FADE`. `BNav active=3`.

**Content top→bottom:**
1. `GroupLabel` **"Prism focus audio"**. `SetGroup marginBottom 20`:
   - "Play Prism in Focus" · toggle **ON**
   - "Default mode" · value "**Deep Work**" · chevron · last
2. `GroupLabel` **"In-app sounds"**. `SetGroup`:
   - "All in-app sounds" · toggle **ON**
   - "Create task" · toggle **ON**
   - "Complete task" · toggle **ON**
   - "Task countdown" · toggle **ON**
   - "Complete a subtask item" · toggle **ON** · last

**Transitions (flow map):**
- IN: `settings-home → settings-sounds` (kind `flow`, label "Prism") — tap the "Prism" preferences row.
- OUT: `BackBtn` → settings home.

---

## settings-email — route — Email settings

**Renders:** `<EMAIL_SETTINGS/>` = `<SetScreen title="Email settings"><…/></SetScreen>`.
Compact header `BackBtn` + "Email settings" `fontSize 20, fontWeight 800`. Scroll mask `LIST_FADE`. `BNav active=3`.

**Content top→bottom:**
1. Intro paragraph: "We'll only reach out when it's genuinely useful — a new feature, a study tip, or the occasional offer. You're in control, and you can change this anytime." `fontSize 13, color TEXT, lineHeight 1.55, marginBottom 20, padding 0 2px`.
2. `SetGroup` (no marginBottom) toggle rows:
   - "Product updates" · toggle **ON**
   - "Study tips & guides" · toggle **ON**
   - "Offers & promotions" · toggle **OFF**
   - "Research & surveys" · toggle **OFF** · last

**Transitions (flow map):**
- IN: `settings-account → settings-email` (kind `flow`, label "Email") — tap "Email settings" row in the scrolled settings home's Account group.
- OUT: `BackBtn` → back to settings home/account.
- Related (different frame): `settings-profile → settings-email-change` (`modal`, "Email") is the change-email sheet, NOT this route.
