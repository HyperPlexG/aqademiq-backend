# Section 09 — Context & Overflow

Source prototype: `prototypes/Aqademiq V1 Full Flow v5.html`
Flow map: `prototypes/Aqademiq User Flow - Comprehensive.html`

Both frames in this section are variants/overlays built on top of the **Plan Timeline** screen (`plan-timeline`, bottom-nav tab index 1 = Planner). They share the Plan helper components. Resolve the shared design tokens below before building either frame.

## Shared tokens (light mode, defaults: accent `#6b5cf0`, warmth `Warm`)

| Token | Value | Use |
|---|---|---|
| `ACC` | `#6b5cf0` | accent (CC 401 subject color, primary actions) |
| `BG` | `#f4f3f0` | phone background (warm) |
| `WHITE` | `#ffffff` | cards, sheet, nav |
| `TEXT` | `#111111` | primary text, active nav pill |
| `MED` | `#777777` | secondary labels, inactive nav icons |
| `DIM` | `#c0c0c0` | tertiary / muted text, duration |
| `BORDER` | `rgba(0,0,0,0.07)` | hairline dividers |
| `HILITE` | `#eceae7` | selected date pill, CollapseHead pill bg |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` | card / pill shadow |
| `INK` | `#111111` | active nav pill / Ada nav circle bg |
| `WARN` | `#e8a430` | swipe "Later" action bg |
| (literal) | `#e85476` | destructive red (Delete) |
| (literal) | `#5cbbff` | NLP 302 subject color (blue) |
| `SANS` | `"Plus Jakarta Sans", system-ui, sans-serif` | all text |

### Phone shell (`<Phone>`)
- `width:262 height:522`, `borderRadius:34`, `background:BG`, `overflow:hidden`, `position:relative`, `fontFamily:SANS`, `color:TEXT`, `fontSize:12`.
- Shadow `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
- Status bar: height `30`, `padding:0 18px`, `fontSize:10 fontWeight:700`, space-between. Left `9:41`; center notch `36×12` bg `#111` radius 6; right `●▊` letterSpacing -1.

### Bottom nav (`<BNav active={1}>`) — both frames pass active=1 (Planner)
- `position:absolute bottom:8 left:10 right:10 height:56`, `background:WHITE`, `borderRadius:20`, shadow `0 4px 28px rgba(0,0,0,0.13)`, flex space-between, `padding:0 8px`.
- 5 slots, visual order: `menu_book`(idx0) · `calendar_today`(idx1) · Ada center(idx4) · `timer`(idx2) · `bar_chart`(idx3).
- Tab cell (icon): `46×40 borderRadius:14`, active → bg `INK`, icon `#fff`; inactive → transparent, icon `MED`. Icon `fontSize:24` (material-icons-outlined).
- Center Ada: `44×44 circle`; active bg `INK`, else bg `WHITE` + `1.5px solid BORDER`; holds `<AdaNavFace size={34}>`.
- Here active=1, so the `calendar_today` cell is filled (INK bg, white icon).

### Plan helpers used by these frames
- **PlanHeader** (`day='Wednesday' month='JUN 2026'`): flex space-between, `marginBottom:10`. Left: day `SANS fontWeight:800 letterSpacing:-0.3 lineHeight:1.1 fontSize:15`; month row `fontSize:9.5 fontWeight:800 color:MED letterSpacing:0.04em marginTop:1` + chevron `chevron_right` `fontSize:11`. Right: a `Today` pill (`WHITE` bg, `borderRadius:100`, `padding:8px 15px`, SHADOW, `fontSize:12.5 fontWeight:800`) when `today`; then a control pill (`WHITE` radius 100, `padding:4px 6px`, SHADOW) containing a `30×30` circle with `···` (`fontSize:17 fontWeight:800 color:TEXT`) and a `30×30` circle with `add` icon (`fontSize:21 color:TEXT`).
- **PlanDateStrip** (`selected=2 today=2`): flex space-between, `marginBottom:10`. 7 cells M T W T F S S (numbers 1–7). Each cell `width:34 padding:5px 0 borderRadius:14`, gap 2; selected bg `HILITE`. Number `fontSize:10 fontWeight:700` (DIM, or ACC if today & not selected). Letter `fontSize:19 fontWeight:800` (TEXT if selected, ACC if today, else DIM). Selected adds an underline bar `14×3 radius:2 bg:#c4c1bb`. (Past = n<3.)
- **CollapseHead** (`label count open` + optional `icon`): centered; inline-flex pill bg `HILITE` radius 100, padding `6px 13px 6px 7px` (with icon) or `7px 15px`. Optional leading icon `fontSize:15 color:MED`. Label text `"{label} ({count})"` `fontSize:11.5 fontWeight:800 letterSpacing:0.05em color:TEXT`. Trailing chevron `expand_more` (open) `fontSize:18 color:TEXT`.
- **TimeLabel**: `fontSize:11 fontWeight:800 color:TEXT margin:10px 0 7px`.
- **PlanTask** (`title dur tag color bar`): row `display:flex alignItems:stretch gap:11`, bg `WHITE`, `borderRadius:16`, SHADOW, `padding:11px 13px`. If `bar`: leading `width:4 borderRadius:4 background:color` full-height bar. Body (flex:1): title `fontSize:13 fontWeight:800 lineHeight:1.25`; meta row `gap:8 marginTop:4 flexWrap:wrap` → optional `time` (`fontSize:10 fontWeight:800 color:TEXT`), tag chip (`fontSize:9.5 fontWeight:800 color:{color}` + `6×6` dot of `{color}`), `dur` (`fontSize:10.5 color:DIM fontWeight:600`). Trailing completion circle `22×22 radius:50% border:2px solid #d6d3ce` (ACC + fill + white ✓ if done).

---

## task-overflow — kind: **sheet** — Task action sheet

`<DCArtboard id="task-overflow">` renders `<TASK_OVERFLOW/>` (prototype lines 3125–3168). A bottom action sheet over a dimmed Plan Timeline. Triggered by **long-press** on a task.

### Top-to-bottom layout
1. **Dimmed Plan backdrop** — wrapper `padding:0 16px`, `opacity:0.4`, `pointerEvents:none`. Contains:
   - `<PlanHeader/>` (Wednesday / JUN 2026).
   - `<PlanDateStrip/>` (W selected).
   - `<CollapseHead icon="schedule" label="ANYTIME" count={3} open/>` wrapped in `marginBottom:10`.
   - Two-task column (`display:flex flexDirection:column gap:8`):
     - `PlanTask title="Read chapter 4" dur="10m" tag="CC 401" color=ACC` (no bar).
     - `PlanTask title="Review lecture slides" dur="5m" tag="NLP 302" color="#5cbbff"` (no bar).
   - `<CollapseHead label="PLANNED" count={3} open/>` wrapped in `margin:8px 0 2px` (no icon).
   - `<TimeLabel>11:30 AM</TimeLabel>`.
   - `PlanTask title="LL(1) parsing notes" dur="30m" tag="CC 401" color=ACC bar` (with left bar).
2. **Scrim** — `position:absolute inset:0`, `background:rgba(20,15,28,0.3)` (covers full phone).
3. **Action sheet** — `position:absolute bottom:0 left:0 right:0`, `background:WHITE`, `borderRadius:22px 22px 0 0`, `boxShadow:0 -8px 40px rgba(0,0,0,0.18)`, `overflow:hidden`, `padding:10px 0 78px` (the 78 bottom keeps content above the nav; sheet white runs flush to bottom and merges with nav).
   - **Grabber**: `width:38 height:4 borderRadius:2 background:#e0ddd7 margin:0 auto 12px`.
   - **Task header block**: `padding:0 18px 12px`, `borderBottom:1px solid BORDER`.
     - Subject row: `display:flex gap:8 alignItems:center marginBottom:3` → dot `7×7 borderRadius:50% background:ACC` + `CC 401` `fontSize:9 fontWeight:800 color:ACC`.
     - Title `LL(1) parsing notes` — `fontFamily:SANS fontSize:15 fontWeight:700`.
     - Subtitle `35 min · Ada generated · 3 microtasks` — `fontSize:11 color:DIM`.
   - **Action rows** (6 rows, each: `display:flex alignItems:center gap:14 padding:12px 18px`, `borderBottom:1px solid BORDER` except last row `none`). Each = icon (material-icons-outlined `fontSize:18 color:{color}`) + label (`fontSize:13 fontWeight:600 color:{color}`):
     1. `check_circle_outline` — "Mark as done" — color `TEXT`
     2. `timer` — "Start session" — color `ACC`
     3. `event` — "Reschedule" — color `TEXT`
     4. `auto_awesome` — "Break down more" — color `TEXT`
     5. `arrow_forward` — "Move to tomorrow" — color `TEXT`
     6. `delete_outline` — "Delete" — color `#e85476` (last; no bottom border)
4. **`<BNav active={1}/>`** — floating nav drawn on top (sheet white merges behind it).

### Transitions
- **INTO:** `plan-timeline → task-overflow`, kind `cross` (flow-map), gesture label **"Long-press"** a task. (Cross edge = dashed "Jump / loop between journeys".)
- **OUT OF:** none defined in the flow map. Dismiss returns to `plan-timeline` (tap scrim/grabber). The six action rows are in-place task operations (mark done, start session → would route to Focus, reschedule, break down, move to tomorrow, delete) — not wired as flow-map edges.

---

## task-swipe — kind: **state** — Swipe actions (swipe affordance on a task row)

`<DCArtboard id="task-swipe">` renders `<TASK_SWIPE/>` (prototype lines 3171–3202). A Plan Timeline in the **swiped-open** state: one task slid left to reveal Later/Delete quick actions. This is a parent-screen state, not a separate route/sheet — toggled by **swiping a task left** on `plan-timeline`.

### Top-to-bottom layout
Outer content wrapper: `padding:0 16px`, `height:452`, `overflow:hidden` (fixed-height clipped list).
1. `<PlanHeader/>` (Wednesday / JUN 2026).
2. `<PlanDateStrip/>` (W selected).
3. `<CollapseHead label="PLANNED" count={3} open/>` wrapped in `margin:2px 0 2px` (no icon).
4. `<TimeLabel>11:30 AM</TimeLabel>`.
5. **Swiped task card** — `position:relative borderRadius:16 overflow:hidden`. Two layers:
   - **Action layer (behind)**: `position:absolute top:0 right:0 bottom:0 display:flex` (right-aligned), two buttons each `width:62`, full height, `display:flex flexDirection:column alignItems:center justifyContent:center gap:2`:
     - **Later** — bg `WARN` (`#e8a430`); icon `event` (material-icons-outlined `fontSize:16 color:#fff`) + label "Later" (`fontSize:8 color:#fff fontWeight:700`).
     - **Delete** — bg `#e85476`; icon `delete_outline` (`fontSize:16 color:#fff`) + label "Delete" (`fontSize:8 color:#fff fontWeight:700`).
   - **Card layer (front, slid left)**: wrapper `marginRight:124 position:relative` (124 = the two 62px action buttons revealed on the right) containing `PlanTask title="LL(1) parsing notes" dur="30m" tag="CC 401" color=ACC bar`.
6. **Swipe hint row** — `display:flex alignItems:center gap:6 padding:8px 4px 6px`: icon `swipe_left` (material-icons-outlined `fontSize:14 color:DIM`) + text "Swipe a task to reschedule or delete" (`fontSize:10.5 color:DIM fontWeight:600`).
7. `<TimeLabel>12:00 PM</TimeLabel>`.
8. `PlanTask title="Assignment 3 draft" dur="30m" tag="NLP 302" color="#5cbbff" bar` (normal, un-swiped task).
9. **`<BNav active={1}/>`** — floating Planner nav.

### Transitions
- **INTO:** `plan-timeline → task-swipe`, kind `cross` (flow-map), gesture label **"Swipe"** (swipe a task left). This is a parent state of `plan-timeline`; the swiped card slides to reveal the actions.
- **OUT OF:** none defined in the flow map. The revealed **Later** button reschedules (the swipe equivalent of the sheet's "Reschedule"); **Delete** removes the task. Swiping back / tapping elsewhere returns the card to the normal `plan-timeline` row state.
