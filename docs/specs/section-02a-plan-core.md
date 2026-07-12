# Section 02a — Plan / Home (core)

Pixel-exact build spec extracted from `prototypes/Aqademiq V1 Full Flow v5.html`.
Transitions cross-referenced with `prototypes/Aqademiq User Flow - Comprehensive.html`.

> All frames render inside `<Phone>`. Values below assume **default tokens** (light
> mode, Warm warmth, accent `#6b5cf0`). Reproduce these exactly.

## Shared tokens (resolved, default theme)
| Token | Value |
|---|---|
| `ACC` (accent) | `#6b5cf0` |
| `ACCL` (accent light) | `#edeafd` |
| `BG` (page bg, Warm) | `#f4f3f0` |
| `WHITE` (cards) | `#ffffff` |
| `TEXT` | `#111111` |
| `MED` (medium gray) | `#777777` |
| `DIM` (light gray) | `#c0c0c0` |
| `BORDER` | `rgba(0,0,0,0.07)` |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` |
| `HILITE` (pill bg) | `#eceae7` |
| `INK` | `#111111` |
| `SUCC` (green) | `#2a9d6b` |
| `WARN` (amber) | `#e8a430` |
| Secondary task blue (literal) | `#5cbbff` |
| `SANS` font | `"Plus Jakarta Sans", system-ui, sans-serif` |

### `<Phone>` shell (every frame)
- Box: width **262**, height **522**, `borderRadius: 34`, background `BG` (`#f4f3f0`), `overflow: hidden`, `position: relative`, `fontFamily: SANS`, color `TEXT`, base `fontSize: 12`, `flexShrink: 0`, boxShadow `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
- Status bar: height **30**, flex space-between, padding `0 18px`, `fontSize: 10`, `fontWeight: 700`. Left `9:41` (color TEXT). Center pill: 36×12, background `#111`, borderRadius 6. Right `●▊` (color TEXT, letterSpacing -1).
- Frame artboard size in catalog: `W=280, H=572`.

### `<BNav active={1}>` — bottom nav (present on all except plan-quickadd)
- Absolute: `bottom: 8, left: 10, right: 10`, height **56**, background `WHITE`, `borderRadius: 20`, boxShadow `0 4px 28px rgba(0,0,0,0.13)`, flex row space-between, `padding: 0 8px`.
- Visual order L→R: Subjects (`menu_book`, idx 0) · **Planner (`calendar_today`, idx 1) — active here** · Ada center face (idx 4) · Timer (`timer`, idx 2) · Stats (`bar_chart`, idx 3).
- Standard tab: 46×40, `borderRadius: 14`; active → background `INK` (`#111`), icon `#fff`; inactive → transparent, icon `MED` (`#777`), `material-icons-outlined` fontSize **24**.
- Center (Ada) item: 44×44 circle; active → background `INK`; inactive → `WHITE` + `1.5px solid BORDER`. Contains `<AdaNavFace size={34}/>`.

### Shared sub-components used below
- **`<PlanHeader>`** props `{day='Wednesday', month='JUN 2026', calOpen, today, dim}`: flex row space-between, `marginBottom: 10`, opacity `dim?0.4:1`.
  - Left: `day` — SANS, `fontWeight: 800`, `letterSpacing: -0.3`, `lineHeight: 1.1`, `fontSize: 15`. Below it `month` row — `fontSize: 9.5`, `fontWeight: 800`, color `MED`, `letterSpacing: 0.04em`, `marginTop: 1`, with trailing icon `calOpen ? 'expand_more' : 'chevron_right'` (fontSize 11).
  - Right cluster gap 7: optional **Today** pill (only if `today`): background WHITE, `borderRadius: 100`, `padding: 8px 15px`, SHADOW, `fontSize: 12.5`, `fontWeight: 800`. Then a WHITE pill (`borderRadius: 100`, `padding: 4px 6px`, SHADOW) holding two 30×30 circles: `···` glyph (fontSize 17, fontWeight 800, letterSpacing 0.5, paddingBottom 5) and `add` icon (fontSize 21).
- **`<PlanDateStrip>`** props `{selected=2, today=2}`: flex row space-between, `marginBottom: 10`. 7 day cells `[M1 T2 W3 T4 F5 S6 S7]`. Each cell width **34**, `padding: 5px 0`, `borderRadius: 14`, background `selected ? HILITE : transparent`. Top number `fontSize: 10`, `fontWeight: 700`, color `today&&!sel ? ACC : DIM`. Letter `fontSize: 19`, `fontWeight: 800`, color `sel?TEXT : today?ACC : DIM`. If selected: 14×3 underline bar `borderRadius 2` background `#c4c1bb`.
- **`<CollapseHead icon? label count open>`**: centered flex. Inner pill: inline-flex, gap 7, background `HILITE`, `borderRadius: 100`, padding `icon ? '6px 13px 6px 7px' : '7px 15px'`. Optional leading `material-icons-outlined` (fontSize 15, color MED). Label `"{label} ({count})"` fontSize **11.5**, fontWeight 800, letterSpacing `0.05em`, color TEXT. Trailing chevron `open ? 'expand_more' : 'expand_less'` (fontSize 18, color TEXT).
- **`<PlanTask title dur? time? tag? color? bar? done? dim?>`**: flex row align-stretch, gap 11, background WHITE, `borderRadius: 16`, SHADOW, `padding: 11px 13px`, opacity `dim?0.5:1`. If `bar`: leading 4-wide bar `borderRadius 4` background `color`. Body: title `fontSize: 13`, `fontWeight: 800`, `lineHeight: 1.25`. Meta row (marginTop 4, gap 8, wrap): optional `time` (fontSize 10, fontWeight 800, color TEXT); optional `tag` (inline-flex gap 4, fontSize 9.5, fontWeight 800, color=`color`, with a 6×6 dot of `color`); `dur` (fontSize 10.5, color DIM, fontWeight 600). Trailing 22×22 circle `2px solid` (`done?ACC:#d6d3ce`), filled ACC + white `✓` (fontSize 11) when done.
- **`<TimeLabel>`**: `fontSize: 11`, `fontWeight: 800`, color TEXT, `margin: 10px 0 7px`.
- **`<AddRow label>`**: flex gap 11, `padding: 11px 2px`. Leading 6×6 dot `#d6d3ce`; label `fontSize 12.5`, color DIM, fontWeight 600; trailing 24×24 circle background BG with `+` (fontSize 16, color DIM, paddingBottom 2).
- **`<CalGrid firstCol total accent>`**: 7-col grid, `rowGap: 3`. Weekday headers `MON…SUN` fontSize 8, fontWeight 800, color DIM, marginBottom 4. Day cells height 28; each day a 26×26 circle, fontSize 13, fontWeight 700; the `accent` day → background ACC, color `#fff`, others color TEXT/transparent.
- Shared data **`PLAN_ANYTIME`** = [`Read chapter 4` 10m `CC 401` ACC, `Review lecture slides` 5m `NLP 302` #5cbbff, `Submit lab report` 5m `NET 305` SUCC].

---

## plan-timeline — kind: route (HUB / default home) — Timeline (default)
Artboard `id="plan-timeline"` → `<PLAN_TIMELINE/>`. Tab root for Planner; default landing screen after auth/onboarding.

**Layout (top→bottom)** inside content div `padding: 0 16px`, `height: 452`, `overflow: hidden`:
1. `<PlanHeader/>` — day "Wednesday", month "JUN 2026", chevron_right (cal closed), no Today pill.
2. `<PlanDateStrip/>` — selected=2 (W), today=2.
3. Wrapper `marginBottom: 10` → `<CollapseHead icon="schedule" label="ANYTIME" count={3} open/>`.
4. Anytime task column (flex column, gap 8):
   - `PlanTask` "Read chapter 4" dur 10m tag "CC 401" color ACC (no bar).
   - `PlanTask` "Review lecture slides" dur 5m tag "NLP 302" color `#5cbbff` (no bar).
5. Wrapper `margin: 8px 0 2px` → `<CollapseHead label="PLANNED" count={3} open/>` (no icon).
6. `<TimeLabel>11:30 AM</TimeLabel>`
7. `PlanTask` "LL(1) parsing notes" dur 30m tag "CC 401" color ACC **bar**.
8. `<TimeLabel>12:00 PM</TimeLabel>`
9. `PlanTask` "Assignment 3 draft" dur 30m tag "NLP 302" color `#5cbbff` **bar**.
10. `<BNav active={1}/>`.

**Transitions**
- INTO: `auth → plan-timeline` (cross, "Returning"); `adaload → plan-timeline` (cross, "Enter app"); `fc-end → plan-timeline` (cross, "Back to plan"); `ada-chat → plan-timeline` (cross, "Added to plan"); `mood-morning → plan-timeline` (cross, "Start day").
- OUT OF: → `plan-breakdown` (flow, "Expand"); → `plan-list` (flow, "List"); → `plan-anytime-collapsed` (modal); → `plan-planned-collapsed` (modal); → `plan-otherday` (flow, "Pick day"); → `plan-quickadd` (modal, "+ Quick"); → `plan-menu` (modal, "···"); → `plan-addtask` (flow, "Add task"); → `task-swipe` (cross, "Swipe"); → `task-overflow` (cross, "Long-press"); → `mood-evening` (cross, "End of day").

---

## plan-breakdown — kind: state (on plan-timeline) — Task → microtasks
Artboard `id="plan-breakdown"` → `<PLAN_BREAKDOWN/>`. A planned task Ada has broken into microtasks, shown expanded inline. **Toggle:** tapping/expanding a planned task on plan-timeline (flow "Expand"). Microtask data: `[[true,'Read lecture 9 slides','10m'],[false,'Build the parsing table','15m'],[false,'Solve 2 practice problems','10m']]`.

**Layout** (content div `padding: 0 16px`, `height: 452`):
1. `<PlanHeader/>` (default Wednesday/JUN 2026).
2. `<PlanDateStrip/>`.
3. Wrapper `margin: 2px 0 8px` → `<CollapseHead label="PLANNED" count={3} open/>`.
4. `<TimeLabel>11:30 AM</TimeLabel>`.
5. **Expanded card**: background WHITE, `borderRadius: 16`, SHADOW, `overflow: hidden`, `marginBottom: 8`.
   - Header row: flex align-stretch gap 11, `padding: 11px 13px 9px`.
     - Left 4-wide bar, `borderRadius 4`, background ACC.
     - Body: title row (gap 6, marginBottom 5, wrap): "LL(1) parsing notes" (fontSize 13, fontWeight 800) + **Ada badge** pill: inline-flex gap 3, background ACCL (`#edeafd`), color ACC, `fontSize 8.5`, fontWeight 800, `padding 2px 7px`, `borderRadius 100`, leading `✦` (fontSize 9), text "Ada · 3 steps".
     - Meta row (gap 8): "11:30 AM" (fontSize 10, fontWeight 800, TEXT); tag "CC 401" (inline-flex gap 4, fontSize 9.5, fontWeight 800, color ACC, 6×6 ACC dot); "35m" (fontSize 10.5, color DIM, fontWeight 600).
     - Right progress block (self-center, centered): "1/3" — `1` ACC + `/3` DIM, fontSize 13, fontWeight 800, SANS, lineHeight 1; below "DONE" fontSize 7.5, fontWeight 800, letterSpacing 0.06em, color DIM, marginTop 2.
   - Progress track: height 3, background BG, `margin 0 13px`, `borderRadius 2`; fill width **33%**, background ACC, borderRadius 2.
   - Microtask list: `padding 8px 14px 10px 20px`. Each row flex gap 10, `padding 4px 0`:
     - Connector rail: 16-wide column; vertical line 1.5-wide background BORDER (top `50%` on first / bottom `50%` on last → forms continuous rail); node 15×15 circle, `1.5px solid` (done→ACC else `#cfcbc4`), background done→ACC else WHITE, ring `boxShadow 0 0 0 3px WHITE`; white `✓` (fontSize 8) when done.
     - Text flex: fontSize 11.5, fontWeight 600, color done→DIM else TEXT, `line-through` when done.
     - Trailing time `t`: fontSize 10, color DIM, fontWeight 700.
6. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-timeline → plan-breakdown` (flow, "Expand"). OUT OF: back to `plan-timeline` (collapse; reverse of the same edge).

---

## plan-list — kind: state (on plan-timeline) — List grouping (group-by toggle)
Artboard `id="plan-list"` → `<PLAN_LIST/>`. Same day bucketed by time-of-day with emoji-tinted group heads, no timeline rail. **Toggle:** group-by switch from plan-timeline (flow "List"), reachable via plan-menu → Grouping options.

Uses local **`<ListGroupHead icon label count tint>`**: relative flex center, marginBottom 7. Center pill: inline-flex gap 7, background `tint ? tint+'2e' : HILITE`, `borderRadius 100`, `padding 6px 13px 6px 11px`; leading icon fontSize 14 color MED; "{label} ({count})" fontSize 11.5 fontWeight 800 letterSpacing 0.04em color TEXT; trailing `expand_more` fontSize 17 color TEXT. Absolute right `add` icon fontSize 19 color DIM.

**Layout** (content `padding: 0 16px`, `height: 452`):
1. `<PlanHeader/>`; 2. `<PlanDateStrip/>`.
3. `ListGroupHead icon="schedule" label="ANYTIME" count={2}` (no tint → HILITE bg).
4. Column gap 8, marginBottom 12: `PlanTask` "Find faults visually or logically in front end frames" dur 5m; `PlanTask` "Get DPIIT Certification" dur 5m. (no tag/bar/color).
5. `ListGroupHead icon="wb_twilight" label="MORNING" count={2} tint={WARN}` (pill bg `#e8a4302e`).
6. Column gap 8, marginBottom 12: `PlanTask` "Add Ada AI logo to frames" dur 10m; `PlanTask` "List out what all frames we need to add after brainstorming" time "11:30 AM → 12:00 PM" color ACC **bar**.
7. `ListGroupHead icon="wb_sunny" label="AFTERNOON" count={3} tint={ACC}` (pill bg `#6b5cf02e`).
8. Column gap 7: `PlanTask` "Ensure every section, frame, text and button is consistent" time "12:00 PM → 12:30 PM" color `#5cbbff` **bar**; `PlanTask` "Find out what has been done regarding KT videos" time "4:00 PM → 4:30 PM" color SUCC **bar**.
9. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-timeline → plan-list` (flow, "List"). OUT OF: back to `plan-timeline` (toggle back to timeline grouping).

---

## plan-anytime-collapsed — kind: state (on plan-timeline) — Anytime collapsed
Artboard `id="plan-anytime-collapsed"` → `<PLAN_ANYTIME_COLLAPSED/>`. **Toggle:** tap the ANYTIME `CollapseHead` chevron on plan-timeline to fold the Anytime section (frees vertical space for the planned timeline).

**Layout** (content `padding: 0 16px`, `height: 452`):
1. `<PlanHeader/>`; 2. `<PlanDateStrip/>`.
3. Wrapper `marginBottom: 12` → `<CollapseHead icon="schedule" label="ANYTIME" count={3} open={false}/>` (chevron `expand_less`, no task list below).
4. Wrapper `marginBottom: 2` → `<CollapseHead label="PLANNED" count={3} open/>`.
5. `<TimeLabel>11:30 AM</TimeLabel>` → `PlanTask` "LL(1) parsing notes" 30m "CC 401" ACC **bar**.
6. `<TimeLabel>12:00 PM</TimeLabel>` → `PlanTask` "Assignment 3 draft" 30m "NLP 302" `#5cbbff` **bar**.
7. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-timeline → plan-anytime-collapsed` (modal, no label). OUT OF: back to `plan-timeline` (re-expand).

---

## plan-planned-collapsed — kind: state (on plan-timeline) — Planned collapsed
Artboard `id="plan-planned-collapsed"` → `<PLAN_PLANNED_COLLAPSED/>`. **Toggle:** tap the PLANNED `CollapseHead` chevron on plan-timeline; folds the planned timeline, leaving only Anytime tasks.

**Layout** (content `padding: 0 16px`, `height: 452`):
1. `<PlanHeader/>`; 2. `<PlanDateStrip/>`.
3. Wrapper `marginBottom: 10` → `<CollapseHead icon="schedule" label="ANYTIME" count={3} open/>`.
4. Column gap 8 mapping **full `PLAN_ANYTIME`** (3 tasks, all no bar):
   - "Read chapter 4" 10m "CC 401" ACC.
   - "Review lecture slides" 5m "NLP 302" `#5cbbff`.
   - "Submit lab report" 5m "NET 305" SUCC.
5. Wrapper `margin: 8px 0 2px` → `<CollapseHead label="PLANNED" count={3} open={false}/>` (chevron `expand_less`, nothing below).
6. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-timeline → plan-planned-collapsed` (modal, no label). OUT OF: back to `plan-timeline` (re-expand).

---

## plan-otherday — kind: state (on plan-timeline) — Another day + Today button
Artboard `id="plan-otherday"` → `<PLAN_OTHERDAY/>`. Viewing a different day (Tuesday) with empty buckets and a **Today** button to jump back. **Toggle:** select a non-today day in the date strip from plan-timeline (flow "Pick day").

**Layout** (content `padding: 0 16px`, `height: 452`):
1. `<PlanHeader today day="Tuesday"/>` — shows **Today** pill at right; day label "Tuesday".
2. `<PlanDateStrip selected={1} today={2}/>` — selected = index 1 (T), today still index 2 (W) shown in ACC.
3. Wrapper `marginBottom: 4` → `<CollapseHead icon="schedule" label="ANYTIME" count={0} open/>`.
4. `<AddRow/>` (default label "Add a task for anytime").
5. Wrapper `margin: 6px 0 2px` → `<CollapseHead label="PLANNED" count={0} open/>`.
6. `<TimeLabel>12:00 AM</TimeLabel>`.
7. **Empty-day gap row**: flex gap 11 align-stretch.
   - Left 6-wide rail column (space-between, padding 1px 0): top `wb_sunny` icon fontSize 15 color WARN; middle flex column of three 5×5 dots `#d6d3ce` (gap 5, padding 5px 0); bottom `bedtime` icon fontSize 15 color ACC.
   - Middle text flex (self-center): "23h 59m → No plans" fontSize 11.5, color DIM, fontWeight 600.
   - Trailing 24×24 circle background BG, `+` (fontSize 16, color DIM, paddingBottom 2, self-center).
8. `<TimeLabel>11:59 PM</TimeLabel>`.
9. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-timeline → plan-otherday` (flow, "Pick day"). OUT OF: → `plan-month` (modal, "Calendar"); back to `plan-timeline` via the Today button.

---

## plan-month — kind: sheet/menu — Month picker (June)
Artboard `id="plan-month"` → `<PLAN_MONTH/>`. Calendar month popup that drops below a dimmed header. Opened by tapping the month label / calendar on plan-otherday.

**Layout** — content wrapper `height: 452`, `position: relative`, `padding: 0 16px`:
1. `<PlanHeader dim calOpen/>` — header dimmed (opacity 0.4), month chevron = `expand_more` (calOpen).
2. **Popup card**: absolute `top: 92, left: 12, right: 12`, background WHITE, `borderRadius: 22`, boxShadow `0 14px 44px rgba(0,0,0,0.16)`, `padding: 15px 15px 18px`.
   - Title row (space-between, marginBottom 14): left "June 2026" SANS fontSize 17 fontWeight 800 + `chevron_right` (fontSize 16, color ACC); right group gap 16 — `chevron_left` and `chevron_right` (fontSize 20, color TEXT).
   - `<CalGrid firstCol={0} total={30} accent={3}/>` — June: day 1 on Mon column, 30 days, **day 3 filled ACC** (selected).
3. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-otherday → plan-month` (modal, "Calendar"). OUT OF: → `plan-month-next` (modal, advance month); → `plan-monthyear` (modal, "Year"). Dismiss returns to plan-otherday/plan-timeline.

---

## plan-month-next — kind: state (on plan-month) — Month picker → July
Artboard `id="plan-month-next"` → `<PLAN_MONTH_NEXT/>`. Same popup advanced one month. **Toggle:** tap the right `chevron_right` in plan-month's title row.

**Layout** — identical structure to plan-month; differences:
1. `<PlanHeader dim calOpen/>` (same).
2. Popup card (same absolute/style as plan-month).
   - Title: "July 2026" (SANS 17/800) + ACC `chevron_right`; same right chevron pair (fontSize 20, color TEXT).
   - `<CalGrid firstCol={2} total={31} accent={null}/>` — July: day 1 on **Wed column** (offset 2), 31 days, **no accent/selected day**.
3. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-month → plan-month-next` (modal, no label). OUT OF: back to plan-month (chevron_left). Same family of dismiss targets as plan-month.

---

## plan-monthyear — kind: sheet — Month + year wheel
Artboard `id="plan-monthyear"` → `<PLAN_MONTHYEAR/>`. Combined month/year wheel selector. Months `['April','May','June','July','August']`, years `['2024','2025','2026','2027','2028']`, opacities `[0.28,0.5,1,0.5,0.28]` (center = index 2 fully opaque).

**Layout** — content `height: 452`, relative, `padding: 0 16px`:
1. `<PlanHeader dim calOpen/>`.
2. **Popup card**: absolute `top: 92, left: 12, right: 12`, WHITE, `borderRadius: 22`, boxShadow `0 14px 44px rgba(0,0,0,0.16)`, `padding: 15px 15px 22px`.
   - Title row: "June 2026" SANS fontSize 17 fontWeight 800 **color ACC**, marginBottom 10, trailing `expand_more` (fontSize 16).
   - Wheel area (relative):
     - Center highlight band: absolute `top: 50%`, `left: -4, right: -4`, height **42**, `translateY(-50%)`, background HILITE, `borderRadius 12`.
     - Two columns (space-between, padding 0 6px): left **months** column; right **years** column (align flex-end). Each row height **42**, centered; center row (index 2) `fontSize 22, fontWeight 800`, others `fontSize 19, fontWeight 600`; opacity per `op[i]`.
3. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-month → plan-monthyear` (modal, "Year"). OUT OF: back to plan-month / dismiss to plan-timeline.

---

## plan-quickadd — kind: sheet — Quick add (+ button)
Artboard `id="plan-quickadd"` → `<PLAN_QUICKADD/>`. Lightweight add bar with keyboard/Speak, opened by the + button. **No `<BNav>`** (keyboard owns the bottom). Outer content `height: 492`, relative, `overflow: hidden`.

**Layout (top→bottom)**
1. **Dimmed backdrop content** `padding: 0 16px`, `opacity: 0.4`, `pointerEvents: none`: `<PlanHeader/>`, `<PlanDateStrip/>`, wrapper marginBottom 10 `<CollapseHead icon="schedule" label="ANYTIME" count={3} open/>`, one `PlanTask` "Read chapter 4" 10m "CC 401" ACC.
2. **Scrim**: absolute `inset: 0`, background `rgba(20,15,28,0.28)`.
3. **Bottom sheet**: absolute `bottom 0, left 0, right 0`, background WHITE, `borderRadius: 22px 22px 0 0`, `padding: 12px 16px 18px`, boxShadow `0 -8px 40px rgba(0,0,0,0.16)`.
   - Grabber: 36×4 bar, `borderRadius 2`, background `#e0ddd7`, `margin: 0 auto 14px`.
   - Input pill: flex gap 10, background BG, `borderRadius 14`, `padding 12px 14px`, marginBottom 12. Placeholder "Just one thing to do…" fontSize 14 fontWeight 600 color DIM, with ACC caret `|` (fontWeight 400). Trailing `mic` icon fontSize 19 color ACC.
   - Action row: flex gap 8.
     - Left chips group (flex gap 6, overflow hidden): three pills `[schedule "Anytime", sell "Tag", repeat "No repeat"]` — each background BG, `borderRadius 100`, `padding 6px 11px`, fontSize 10.5, fontWeight 700, color MED, gap 4, leading icon fontSize 13, nowrap.
     - "More" pill: background BG, `borderRadius 100`, `padding 6px 10px`, `more_horiz` icon fontSize 15 color MED (title "More options — full task form").
     - Send button: 38×38 circle, background INK (`#111`), centered `arrow_upward` icon fontSize 18 color `#fff`.

**Transitions** — INTO: `plan-timeline → plan-quickadd` (modal, "+ Quick"). OUT OF: → `plan-addtask` (flow, "Details"; via the more_horiz / send to full form). Dismiss returns to plan-timeline.

---

## plan-menu — kind: menu — ··· overflow menu
Artboard `id="plan-menu"` → `<PLAN_MENU/>`. Per-day overflow popover from the `···` button. Content `height: 452`, relative, `padding: 0 16px`.

**Layout**
1. **Dimmed background** `opacity: 0.35`, `pointerEvents: none`: `<PlanHeader/>` `<PlanDateStrip/>`, wrapper marginBottom 10 `<CollapseHead icon="schedule" label="ANYTIME" count={3} open/>`, one `PlanTask` "Read chapter 4" 10m "CC 401" ACC.
2. **Popover card**: absolute `top: 40, right: 12`, width **220**, background WHITE, `borderRadius: 20`, boxShadow `0 14px 44px rgba(0,0,0,0.18)`, `padding: 8px 0`, overflow hidden.
   - Items (map): `[event_note "Reschedule tasks", favorite_border "Log mood"]` — each flex gap 13, `padding 11px 18px`; icon `material-icons-outlined` fontSize 19 color TEXT; label fontSize 14 fontWeight 600.
   - Divider: `borderTop 1px solid BORDER`, `margin 6px 0`.
   - "Grouping options" row: flex space-between, `padding 11px 18px`; label fontSize 14 **fontWeight 800**; trailing `chevron_right` fontSize 18 color TEXT.
3. `<BNav active={1}/>`.

**Transitions** — INTO: `plan-timeline → plan-menu` (modal, "···"). OUT OF: → `plan-grouping` (modal, Grouping options submenu); → `plan-logmood` (modal, Log mood); → `plan-resched` (modal, Reschedule tasks). Dismiss returns to plan-timeline.
