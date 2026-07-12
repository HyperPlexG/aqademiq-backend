# Section 02b — Plan: menus, mood, reschedule & Add-task field pickers

Pixel-exact build spec extracted from `prototypes/Aqademiq V1 Full Flow v5.html`.
Transitions from `prototypes/Aqademiq User Flow - Comprehensive.html`.

## Shared design tokens (light/Warm defaults — TWEAK_DEFAULTS accent `#6b5cf0`, warmth `Warm`)
- `BG` = `#f4f3f0` (page background, Warm)
- `WHITE` = `#ffffff` (cards, sheets, dialogs)
- `INK` = `#111111` (primary buttons, completion fills)
- `TEXT` = `#111111`
- `ACC` (accent) = `#6b5cf0`
- `ACCL` (accent-light) = `#edeafd` (active-row highlight, time-wheel band)
- `HILITE` = `#eceae7` (date-strip / collapse-pill background)
- `MED` = `#777777` (secondary text/icons)
- `DIM` = `#c0c0c0` (placeholder / tertiary text)
- `BORDER` = `rgba(0,0,0,0.07)`
- `SHADOW` = `0 2px 16px rgba(0,0,0,0.08)`
- `SUCC` = `#2a9d6b`, `WARN` = `#e8a430`
- Subject/tag colors used here: CC 401 = ACC `#6b5cf0`; NLP 302 = `#5cbbff`; NET 305 = SUCC `#2a9d6b`.
- Font family `SANS` = `"Plus Jakarta Sans", system-ui, sans-serif` (used for all text).
- Grab-handle bar (sheets): width 38 (sheets) / 36 (quickadd), height 4, radius 2, color `#e0ddd7`, margin `0 auto Npx` centered.
- **Phone shell**: 262×522, radius 34, bg BG, overflow hidden; status bar row height 30 (`9:41` left fontSize 10 weight 700, center pill 36×12 `#111` radius 6, right `●▊`). All frame content sits below the 30px status bar.
- Artboard wrapper (`DCArtboard`) declares W=280, H=572 — that is the outer canvas only; the rendered Phone is 262×522.
- MOODS palette (index 0→4): Rough `#a79fc4`, Tired `#9286d2`, OK `#7d70d9`, Good `#6a5ce4`, Great `#5a44f1`.

---

## plan-grouping — menu (Grouping submenu)
Artboard `id="plan-grouping"` → `<PLAN_GROUPING/>` (component at line 1341). This is the `···` overflow menu expanded with the **Grouping options** group open. Kind = **menu** (popover anchored top-right). It is reached FROM `plan-menu`, which is itself opened from `plan-timeline` via the `···` button. Implement as the same popover panel as `plan-menu` but with the grouping rows expanded.

**Layout (top → bottom):**
- Phone shell (262×522, bg BG). Inside: a relative container `height:452, padding:0 16px`.
- **Dimmed background layer** (`opacity:0.35, pointerEvents:none`): `<PlanHeader/>` + `<PlanDateStrip/>` + one CollapseHead (`icon=schedule, label=ANYTIME, count=3, open`) with `marginBottom:10` + one `<PlanTask title="Read chapter 4" dur="10m" tag="CC 401" color=ACC/>`.
  - PlanHeader: row, `marginBottom:10`; left day `fontSize 15, weight 800, letterSpacing -0.3` = "Wednesday", under it `JUN 2026` fontSize 9.5 weight 800 color MED letterSpacing 0.04em + chevron_right 11px. Right: pill (WHITE radius 100 pad `4px 6px` SHADOW) holding a 30×30 `···` (fontSize 17 weight 800) and a 30×30 `add` icon (21px).
  - PlanDateStrip: 7 columns M-T-W-T-F-S-S, each 34 wide, selected idx 2 has bg HILITE radius 14; numbers fontSize 10 weight 700, letters fontSize 19 weight 800. Selected underline bar 14×3 radius 2 `#c4c1bb`.
- **Popover panel** (absolute `top:40, right:12`): width **220**, bg WHITE, **borderRadius 20**, `boxShadow:0 14px 44px rgba(0,0,0,0.18)`, padding `8px 0`, overflow hidden.
  - Row 1 (dimmed `opacity:0.4`): icon `event_note` 19px color TEXT + label "Reschedule tasks" fontSize 14 weight 600, row pad `10px 18px`, gap 13.
  - Row 2 (dimmed `opacity:0.4`): icon `favorite_border` 19px + "Log mood" fontSize 14 weight 600, same paddings.
  - Row 3 (the active group header): pad `11px 18px`, space-between → "Grouping options" fontSize 14 **weight 800** + `expand_more` 18px color TEXT.
  - Divider: `borderTop:1px solid BORDER`, margin `4px 0`.
  - Row 4 "List": gap 12, pad `11px 18px` → icon `format_list_bulleted` 19px color TEXT + "List" fontSize 14 weight 600.
  - Row 5 "Timeline" (selected): gap 12, pad `11px 18px` → `check` icon 18px color **ACC**, then `view_agenda` 19px color TEXT, then "Timeline" fontSize 14 **weight 800**.
- **`<BNav active={1}/>`** at bottom (Planner tab active): absolute bottom 8, left/right 10, height 56, bg WHITE, radius 20, `boxShadow:0 4px 28px rgba(0,0,0,0.13)`. Tabs L→R: menu_book(0) / calendar_today(1, ACTIVE) / center Ada face(4) / timer(2) / bar_chart(3). Active tab = 46×40 radius 14 bg INK, icon 24px `#fff`; inactive icon 24px MED. Center Ada is 44×44 circle.

**Transitions:**
- INTO: `plan-menu → plan-grouping` (modal). (`plan-menu` ← `plan-timeline` via `···`, modal.)
- OUT OF: tapping List/Timeline applies the grouping and returns to `plan-timeline` (List → `plan-list` state; Timeline = default). Tapping ✕/scrim dismisses back to `plan-timeline`.

---

## plan-logmood — sheet/dialog (Log mood popup)
Artboard `id="plan-logmood"` → `<PLAN_LOGMOOD/>` (line 1443). Bottom sheet over a dimmed Plan. Kind = **sheet/dialog**.

**Layout (top → bottom):**
- Relative container `height:492`.
- **Dimmed Plan layer**: `padding:0 16px, opacity:0.32, pointerEvents:none` rendering only `<PlanHeader/>`.
- **Scrim**: absolute inset 0, `background:rgba(20,15,28,0.26)`.
- **Bottom sheet** (absolute bottom 0, full width): bg WHITE, `borderRadius:24px 24px 0 0`, `boxShadow:0 -8px 40px rgba(0,0,0,0.2)`, padding `12px 18px 22px`.
  - Grab handle 38×4 radius 2 `#e0ddd7`, margin `0 auto 16px`.
  - Title "How are you feeling?" fontSize **21**, weight 800, centered, marginBottom 4.
  - Subtitle "A quick check-in helps Ada tune your day" fontSize 11.5, color MED, centered, marginBottom 20.
  - **Mood row**: flex space-between, `padding:0 2px`, marginBottom 22. 5 items (idx 0–4), each column width 40, gap 7. **idx 3 (Good) is active**:
    - Each blob wrapped in a 3px-padding circle. Active: `border:2px solid MOODS[idx].color`, bg `MOODS[idx].color + '1e'` (≈12% alpha); inactive: transparent border, no bg.
    - `<MoodBlob idx size={34}/>` inside (melting ice-cube mascot, tone scaled by idx).
    - Label below: fontSize 8.5, weight 800 if active else 600, color = mood color if active else MED. Labels: Rough/Tired/OK/Good/Great. Active label "Good" color `#6a5ce4`.
  - **Primary CTA** "Log mood": full width, padding `13px 0`, bg INK, radius 100, `#fff`, fontSize 14 weight 800, textAlign center, marginBottom 10.
  - Secondary "Skip for now": centered, fontSize 11.5, color MED, weight 600.

**Transitions:**
- INTO: `plan-menu → plan-logmood` (modal) — from the "Log mood" row in the `···` overflow menu.
- OUT OF: "Log mood" saves mood & dismisses to `plan-timeline`; "Skip for now" / scrim dismisses to `plan-timeline`.

---

## plan-resched — menu/sheet (Reschedule — remaining tasks)
Artboard `id="plan-resched"` → `<RESCHEDULE_REMAINING/>` (line 1377). A full-bleed WHITE review screen (Phone bg=WHITE). Kind = **menu/sheet** (presented as a modal review).

**Layout (top → bottom):**
- Phone bg = WHITE. Relative container `height:492`.
- **Scroll body**: `padding:4px 18px 0, height:420, overflow:hidden`.
  - Close button row (flex-end): 28×28 circle bg BG, centered `✕` fontSize 13 color MED.
  - **Date pill**: inline-block, bg ACCL, radius 100, padding `4px 13px`, fontSize 13 **weight 700** color ACC, marginBottom 8 → "Wednesday, 3 Jun".
  - Heading "Remaining tasks": fontSize **26**, weight 800, marginBottom 5.
  - Subtext "These are the remaining tasks. Anything you want to move to another day?" fontSize 12 color MED lineHeight 1.5 marginBottom 14.
  - Prompt "Move 6 to tomorrow?" fontSize 15 weight 800 marginBottom 10.
  - **Task list** (column, gap 8). Each row: left a 24×24 circle bg INK with white `✓` (fontSize 12 weight 800), then a card (flex:1, bg WHITE, radius 14, SHADOW, padding `10px 12px`, gap 9) containing a 6×6 color dot + title (fontSize 12.5 weight 800) over meta (fontSize 10 color DIM weight 600). Rows:
    1. "Read chapter 4" · "10m" · dot ACC `#6b5cf0`.
    2. "Review lecture slides" · "5m" · dot `#5cbbff`.
    3. "LL(1) parsing notes" · "11:30 AM → 12:00 PM" · dot ACC.
- **Sticky footer** (absolute bottom 0, full width): bg WHITE, padding `10px 18px 14px`, `boxShadow:0 -6px 20px rgba(0,0,0,0.06)`.
  - Primary "Move to tomorrow (6)": bg INK, radius 100, padding `12px 0`, centered, fontSize 13 weight 800 `#fff`, marginBottom 8.
  - Secondary "More options to move (6)": `border:1.5px solid BORDER`, radius 100, padding `11px 0`, centered, fontSize 13 weight 800 color TEXT.

**Transitions:**
- INTO: `plan-menu → plan-resched` (modal) — from "Reschedule tasks" row in `···` menu.
- OUT OF: `plan-resched → plan-move` (modal) — via "More options to move (6)". "Move to tomorrow (6)" commits and returns to `plan-timeline`; ✕ dismisses to `plan-timeline`.

---

## plan-move — sheet (Reschedule → move date)
Artboard `id="plan-move"` → `<RESCHEDULE_MOVE/>` (line 1412). Bottom sheet with a calendar. Kind = **sheet**.

**Layout (top → bottom):**
- Relative container `height:492` (Phone bg BG).
- **Scrim**: absolute inset 0, `background:rgba(20,15,28,0.28)`.
- **Sheet** (absolute `top:30, left/right/bottom:0`): bg WHITE, `borderRadius:22px 22px 0 0`, `boxShadow:0 -8px 40px rgba(0,0,0,0.2)`, padding `12px 18px 0`, overflow hidden.
  - Grab handle 38×4 radius 2 `#e0ddd7`, margin `0 auto 14px`.
  - Title row (space-between, marginBottom 4): "Move (6)" fontSize **21** weight 800; right 26×26 circle bg BG `✕` fontSize 12 color MED.
  - Subtext "When do you want to move this to?" fontSize 12 color MED marginBottom 14.
  - **Task chips list** (column gap 7, marginBottom 16): each = bg WHITE radius 13 SHADOW padding `9px 12px`, gap 9 → 6×6 color dot + title (fontSize 12 weight 800) over duration (fontSize 9.5 color DIM weight 600):
    1. "Read chapter 4" · "10m" · ACC.
    2. "Review lecture slides" · "5m" · `#5cbbff`.
  - **Month header** (space-between, marginBottom 10): left "June 2026" fontSize 15 weight 800 + `chevron_right` 15px color ACC; right two nav chevrons: `chevron_left` 18px color DIM, `chevron_right` 18px color TEXT.
  - **`<CalGrid firstCol={0} total={30} accent={4}/>`**: 7-col grid; weekday header row MON–SUN fontSize 8 weight 800 color DIM; day cells 28 tall, each day a 26×26 circle fontSize 13 weight 700; day **4** filled bg ACC, text `#fff`. firstCol=0 (June 1 = Monday column).
- **Floating CTA** (absolute `bottom:14, left/right:18`): bg INK, radius 100, padding `13px 0`, centered, fontSize 13 weight 800 `#fff` → "Move (6) to Thursday, 4 Jun".

**Transitions:**
- INTO: `plan-resched → plan-move` (modal).
- OUT OF: CTA commits the move and returns to `plan-timeline`; ✕/scrim dismisses (back to `plan-resched`/`plan-timeline`).

---

## plan-addtask — route/sheet (Add task — full form)
Artboard `id="plan-addtask"` → `<ADD_TASK_FULL/>` = `<Phone bg={BG}><AddTaskBody/></Phone>` (AddTaskBody at line 1974, ADD_TASK_FULL line 2032). Kind = **route/sheet**. Full-screen form (Phone bg BG). All field-pickers below dim THIS body behind their sheet/dialog.

**`AddTaskBody` layout (container `height:492, overflow:hidden`, top → bottom):**
1. **Header card**: bg WHITE, radius 22, padding `12px 16px 13px`, margin `4px 10px 6px`, `boxShadow:0 2px 10px rgba(0,0,0,0.05)`.
   - Top row (space-between, marginBottom 10): 30×30 circle bg BG `✕` (fontSize 13 weight 700 color MED) · centered title "Add task" fontSize 16 weight 800 · "Save" pill bg INK radius 100 padding `6px 14px` fontSize 12 weight 700 `#fff`.
   - Title input: bg BG, radius 12, padding `12px 14px`, fontSize 14 weight 600 color DIM placeholder "What do you need to do?".
2. **Tag picker** (marginBottom 6): SLabel "Tag · what's this for?" (fontSize 9, weight 800, letterSpacing 0.12em, uppercase, color DIM, marginBottom 7), padded `0 16px`. Row of TagChips (gap 6, overflow hidden, padding `0 16px`) from TASK_TAGS: Lecture `#5cbbff`, Class `#6b5cf0`, **Exam `#e85476` (active, i===2)**, Assignment `#2a9d6b`, Report `#e8a430`, Presentation `#c0497b`, Reading `#7a8699`, then "+ New" dashed chip color ACC.
   - TagChip: padding `5px 11px`, radius 100, fontSize 11 weight 600, dot 7×7. Active: `border:1.5px solid color`, bg `color+'18'`, text color = color. Inactive: `border:1.5px solid BORDER`, bg WHITE, text MED. Dashed (+New/+None): `1.5px dashed color`, no dot, text = color/MED.
3. **Subject link** (marginBottom 6): SLabel "Subject · link it (optional)". Chips from SUBJECTS by code: **CC 401 (active, ACC)**, NLP 302 `#5cbbff`, NET 305 `#2a9d6b`, DBS 310 `#e8a430`, then "+ None" dashed color MED.
4. **Details card** (`<Card>` radius 16, marginBottom 8, padding `2px 14px`): four rows, each `display:flex, gap:10, padding:8px 0`, divider `1px solid BORDER` except last. Each row = leading icon (16px) + label (flex:1, fontSize 12.5) + value pill (radius 100, padding `4px 12px`, fontSize 11). Default state (none highlighted): icon color MED, label weight 600 color TEXT, value pill bg BG weight 600 color MED. Rows:
   - `schedule` · "Time of day" · "Anytime"
   - `event` · "Date" · "18 May 2026"
   - `hourglass_empty` · "Duration" · "30 min"
   - `repeat` · "Repeat" · "No repeat"
   - When a row is the one being edited (`hi===label`): icon + label color ACC (label weight 800), value pill bg ACC, text `#fff`, weight 800.
5. **Ada breakdown card** (`<Card>` marginBottom 8, flex gap 10): `<AdaBlob size={28} mood="focused"/>` + "Let Ada break this down" (fontSize 12.5 weight 700) + **toggle ON**: 38×22 track radius 11 bg ACC, knob 18×18 WHITE circle pushed right (justify flex-end, padding 2).
6. **Note card** (`<Card>` flex gap 8): `notes` icon 16px MED + "Add a note…" fontSize 12.5 color DIM.

**Transitions:**
- INTO: `plan-quickadd → plan-addtask` (flow, "Details"); `plan-timeline → plan-addtask` (flow, "Add task").
- OUT OF (all `modal`, dim this body behind): `plan-addtask → plan-pick-time` ("Time"), `→ plan-pick-date` ("Date"), `→ plan-pick-duration` ("Length"), `→ plan-pick-repeat` ("Repeat"). "Save" commits → `plan-timeline`; ✕ → back.

---

## Shared shells for the field pickers
- **`PickerSheet`** (line 2053) — bottom-sheet shell used by plan-pick-time / -date / -duration / -repeat. Structure: Phone bg BG → relative `height:492, overflow:hidden` → dimmed `<AddTaskBody hi vals/>` at `opacity:0.28` (the row named by `hi` shows in active ACC state with overridden value) → scrim `rgba(20,15,28,0.30)` → bottom sheet: bg WHITE, `borderRadius:24px 24px 0 0`, `boxShadow:0 -8px 40px rgba(0,0,0,0.22)`, padding `12px 18px 18px`. Sheet header: handle 38×4 radius 2 `#e0ddd7` (margin `0 auto 14px`); title row space-between → title fontSize **20** weight 800 + 26×26 circle bg BG `✕` fontSize 12 MED; optional sub fontSize 11.5 color MED marginBottom 12 (title marginBottom 3 if sub else 12). Optional CTA: marginTop 14, bg INK, radius 100, padding `13px 0`, centered, fontSize 13 weight 800 `#fff`.
- **`OptRow`** (line 2038): a list row. `display:flex, gap:12, padding:10px 6px, borderRadius:12`; active row bg ACCL. Leading icon 19px (active ACC / else MED); label fontSize 13.5 (active weight 800 ACC / else weight 600 TEXT); optional sub fontSize 10.5 color DIM weight 600 marginTop 1; trailing = `right` element OR (if active) a `✓` fontSize 14 color ACC weight 800.
- **`SetPill`** (line 2049): trailing "Set →" pill, bg BG, radius 100, padding `5px 12px`, fontSize 11 weight 700 color MED.
- **`CenterDialog`** (line 2125) — centered modal shell used by the -custom dialogs. Phone bg BG → relative `height:492` → dimmed `<AddTaskBody hi vals/>` at `opacity:0.26` → scrim `rgba(20,15,28,0.40)` (darker than sheets) → centered card: `top/left:50% translate(-50%,-50%)`, width `w` (default 226), bg WHITE, **borderRadius 24**, `boxShadow:0 20px 64px rgba(0,0,0,0.34)`, padding `17px 18px 18px`. Header: title fontSize **19** weight 800 + 26×26 circle bg BG `✕`; optional sub fontSize 11 color MED marginBottom 14 (title marginBottom 3 if sub else 14). CTA (if present): marginTop 16, bg INK, radius 100, padding `12px 0`, centered, fontSize 13 weight 800 `#fff`.

---

## plan-pick-time — sheet (Time-of-day picker)
Artboard `id="plan-pick-time"` → `<PICK_TIMEOFDAY/>` (line 2072). Uses `PickerSheet` (`hi="Time of day"`). Kind = **sheet**.

**Content:** Title "Time of day", sub "When should this land in your day?". Body = column of `OptRow`s (gap 1):
- `all_inclusive` · "Anytime" · sub "Ada slots it into a free moment" · **active** (bg ACCL, ACC text/icon, trailing ✓).
- `wb_twilight` · "Morning" · sub "Before 12 PM".
- `light_mode` · "Afternoon" · sub "12 – 5 PM".
- `nights_stay` · "Evening" · sub "After 5 PM".
- `schedule` · "Specific time" · trailing `<SetPill/>` ("Set →").

No CTA. Behind: AddTaskBody dimmed with "Time of day" row highlighted (value still "Anytime").

**Transitions:**
- INTO: `plan-addtask → plan-pick-time` (modal, "Time").
- OUT OF: `plan-pick-time → plan-pick-time-custom` (modal) — via "Specific time" Set →. Choosing a bucket / ✕ returns to `plan-addtask`.

---

## plan-pick-time-custom — dialog (Specific time)
Artboard `id="plan-pick-time-custom"` → `<PICK_TIME_SPECIFIC/>` (line 2151). Uses `CenterDialog` (`hi="Time of day"`, `vals={'Time of day':'2:30 PM'}`). Kind = **dialog**.

**Content:** Title "Set time", sub "Pick the exact start time", CTA "Set · 2:30 PM".
- Body row (flex, align center, gap 12):
  - **Wheel block** (flex:1, relative): a selection band — absolute, `top:50%, left:-2, right:-2, translateY(-50%)`, height 40, bg ACCL, radius 12. Over it (relative, flex, align center): hour column `<TimeWheelCol rows=[1, 2(sel), 3]>` · a ":" (fontSize 20 weight 800 color TEXT) · minute column `<TimeWheelCol rows=[15, 30(sel), 45]>`.
    - `TimeWheelCol`: flex:1, column, align center, gap 9. Each value: selected → fontSize 22 weight 800 color TEXT; neighbour → fontSize 15 weight 600 color `#c8c4be`. tabular-nums.
  - **AM/PM segmented** (column, gap 6): "AM" pad `7px 13px` radius 10 bg BG color MED fontSize 12 weight 700; "PM" (selected) pad `7px 13px` radius 10 bg ACC `#fff` fontSize 12 weight 800.
- Behind: AddTaskBody dimmed (opacity 0.26), "Time of day" row highlighted with value "2:30 PM".

**Transitions:**
- INTO: `plan-pick-time → plan-pick-time-custom` (modal).
- OUT OF: "Set · 2:30 PM" commits → back to `plan-addtask` (Time of day = 2:30 PM); ✕ → back to `plan-pick-time`/`plan-addtask`.

---

## plan-pick-date — sheet (Date picker)
Artboard `id="plan-pick-date"` → `<PICK_DATE/>` (line 2084). Uses `PickerSheet` (`hi="Date"`, `vals={Date:'Mon, 18 May'}`). Kind = **sheet**. Title "Pick a date" (no sub). CTA "Set date · Mon, 18 May".

**Content (top → bottom):**
- **Quick chips row** (flex gap 6, marginBottom 14, overflow hidden): each chip radius 100 padding `6px 12px` fontSize 10.5 weight 700 whiteSpace nowrap. "Today" (bg BG, MED) · "Tomorrow" (bg BG, MED) · **"18 May" (active: bg ACC, `#fff`)** · "Next week" (bg BG, MED).
- **Month header** (space-between, marginBottom 10): "May 2026" fontSize 15 weight 800; nav `chevron_left` 18px DIM + `chevron_right` 18px TEXT.
- **`<CalGrid firstCol={4} total={31} accent={18}/>`**: MON–SUN header (8px weight 800 DIM); 31 days, May 1 starts in FRI column (firstCol=4); day **18** filled bg ACC `#fff` (26×26 circle), others fontSize 13 weight 700 color TEXT, cell height 28.
- CTA "Set date · Mon, 18 May".
- Behind: AddTaskBody dimmed, "Date" row highlighted with value "Mon, 18 May".

**Transitions:**
- INTO: `plan-addtask → plan-pick-date` (modal, "Date").
- OUT OF: CTA commits → `plan-addtask` (Date set); ✕ → back. (No custom-date sub-dialog.)

---

## plan-pick-duration — sheet (Duration picker)
Artboard `id="plan-pick-duration"` → `<PICK_DURATION/>` (line 2099). Uses `PickerSheet` (`hi="Duration"`). Kind = **sheet**. Title "Duration", sub "How long do you expect this to take?". No CTA.

**Content:**
- **Preset grid** (`display:grid, gridTemplateColumns:repeat(3,1fr), gap:8, marginBottom:10`). Each cell: textAlign center, padding `14px 0`, radius 14, fontSize 13. Inactive: bg BG, color TEXT, weight 700. Active: bg ACC, `#fff`, weight 800. Cells in order: "15 min", "25 min", **"30 min" (active)**, "45 min", "1 hr", "1.5 hr".
- **`OptRow`** `tune` · "Custom duration" · trailing `<SetPill/>` ("Set →").
- Behind: AddTaskBody dimmed, "Duration" row highlighted (value still "30 min").

**Transitions:**
- INTO: `plan-addtask → plan-pick-duration` (modal, "Length").
- OUT OF: `plan-pick-duration → plan-pick-duration-custom` (modal) via "Custom duration" Set →. Choosing a preset / ✕ → `plan-addtask`.

---

## plan-pick-duration-custom — dialog (Custom duration)
Artboard `id="plan-pick-duration-custom"` → `<PICK_DURATION_CUSTOM/>` (line 2176). Uses `CenterDialog` (`hi="Duration"`, `vals={Duration:'50 min'}`). Kind = **dialog**. Title "Custom duration", sub "Fine-tune the time you need", CTA "Set · 50 min".

**Content (top → bottom):**
- **Stepper row** (flex, justify center, align center, gap 18, marginBottom 14): `<StepBtn icon="remove"/>` · value group (align baseline, gap 4: "50" fontSize **38** weight 800 color TEXT lineHeight 1, "min" fontSize 13 weight 700 MED) · `<StepBtn icon="add"/>`.
  - `StepBtn`: 38×38 circle bg BG, centered material icon 20px color TEXT.
- **Slider** (relative, height 6, bg BG, radius 3, marginBottom 14): filled track `width:42%` left, bg ACC, radius 3; thumb at left 42%, 18×18 circle bg WHITE, `boxShadow:0 2px 8px rgba(0,0,0,0.25)`, `border:2px solid ACC`.
- **Quick chips** (flex gap 6): four equal chips, each flex:1 textAlign center padding `7px 0` radius 100 fontSize 10.5 weight 700: "45 min", "1 hr", "1.5 hr", "2 hr" — all inactive (bg BG, color MED).
- Behind: AddTaskBody dimmed (0.26), "Duration" row highlighted value "50 min".

**Transitions:**
- INTO: `plan-pick-duration → plan-pick-duration-custom` (modal).
- OUT OF: "Set · 50 min" commits → `plan-addtask` (Duration = 50 min); ✕ → `plan-pick-duration`/`plan-addtask`.

---

## plan-pick-repeat — sheet (Repeat picker)
Artboard `id="plan-pick-repeat"` → `<PICK_REPEAT/>` (line 2110). Uses `PickerSheet` (`hi="Repeat"`). Kind = **sheet**. Title "Repeat", sub "Make this a recurring task". No CTA.

**Content:** Column of `OptRow`s (gap 1):
- `block` · "No repeat" · **active** (bg ACCL, ACC, trailing ✓).
- `today` · "Every day".
- `work_outline` · "Weekdays" · sub "Mon – Fri".
- `event_repeat` · "Weekly" · sub "Every Monday".
- `calendar_month` · "Monthly" · sub "On the 18th".
- `tune` · "Custom…" · trailing `<SetPill/>` ("Set →").
- Behind: AddTaskBody dimmed, "Repeat" row highlighted (value still "No repeat").

**Transitions:**
- INTO: `plan-addtask → plan-pick-repeat` (modal, "Repeat").
- OUT OF: `plan-pick-repeat → plan-pick-repeat-custom` (modal) via "Custom…" Set →. Choosing a preset / ✕ → `plan-addtask`.

---

## plan-pick-repeat-custom — dialog (Custom repeat)
Artboard `id="plan-pick-repeat-custom"` → `<PICK_REPEAT_CUSTOM/>` (line 2198). Uses `CenterDialog` (`hi="Repeat"`, `vals={Repeat:'Every 2 weeks'}`, **w=234**). Kind = **dialog**. Title "Custom repeat", sub "Set your own recurring rhythm", CTA "Save · Every 2 weeks".

**Content (top → bottom):**
- **Interval row** (space-between, align center, marginBottom 14): label "Repeat every" fontSize 12.5 weight 700 TEXT; controls (flex align center gap 10): `remove_circle_outline` 18px MED · value "2" fontSize 18 weight 800 color TEXT minWidth 14 centered · `add_circle` 18px **ACC**.
- **Unit segmented** (flex gap 6, marginBottom 16): three equal cells flex:1 textAlign center padding `8px 0` radius 10 fontSize 11.5: "Days" (bg BG MED weight 700), **"Weeks" (active: bg ACC `#fff` weight 800)**, "Months" (bg BG MED weight 700).
- Section caption "ON THESE DAYS": fontSize 10 weight 800 letterSpacing 0.08em color DIM marginBottom 8.
- **Weekday selector** (space-between, marginBottom 4): seven 25×25 circles fontSize 11 weight 800. Order M T W T F S S; **M and W are ON** (bg ACC `#fff`); others OFF (bg BG color MED).
- Behind: AddTaskBody dimmed (0.26), "Repeat" row highlighted value "Every 2 weeks".

**Transitions:**
- INTO: `plan-pick-repeat → plan-pick-repeat-custom` (modal).
- OUT OF: "Save · Every 2 weeks" commits → `plan-addtask` (Repeat = Every 2 weeks); ✕ → `plan-pick-repeat`/`plan-addtask`.

---

### Notes for the developer
- All four `plan-pick-*` (non-custom) are bottom sheets via `PickerSheet`; all three `*-custom` are centered modals via `CenterDialog`. The custom dialogs use a darker scrim (`rgba(20,15,28,0.40)` vs `0.30`) and the AddTaskBody is dimmed slightly more (0.26 vs 0.28).
- The dimmed AddTaskBody behind every picker is the SAME `AddTaskBody`, with `hi` set to the active detail-row label and `vals` overriding that row's pill text — rebuild it once and reuse.
- `plan-grouping`, `plan-logmood`, `plan-resched` are all children of `plan-menu` (the `···` overflow). `plan-move` is a child of `plan-resched`. None of the pickers carry a BNav except `plan-grouping` (BNav active=1).
- The `+New`/`+None` and "Custom"/"Specific" rows are the only branch affordances; all other taps commit + dismiss back toward `plan-addtask`/`plan-timeline`.
