# Section 04 — Focus (build spec)

Pixel-exact spec extracted from `prototypes/Aqademiq V1 Full Flow v5.html` (light theme, warm warmth, accent `#6b5cf0` — the shipped `TWEAK_DEFAULTS`). Transitions taken from `prototypes/Aqademiq User Flow - Comprehensive.html`.

## Shared tokens (resolved values, light theme)

| Token | Value |
|---|---|
| `WHITE` | `#ffffff` |
| `BG` | `#f4f3f0` (warm) |
| `TEXT` | `#111111` |
| `MED` | `#777777` |
| `DIM` | `#c0c0c0` |
| `BORDER` | `rgba(0,0,0,0.07)` |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` |
| `INK` (button ink) | `#111111` |
| `ACC` (accent) | `#6b5cf0` |
| `ACCL` (accent light) | `#edeafd` |
| `SUCC` | `#2a9d6b` |
| `WARN` | `#e8a430` |
| `HILITE` (timer track) | `#eceae7` |
| `SANS` | `"Plus Jakarta Sans", system-ui, sans-serif` |
| Number/timer font | `"Plus Jakarta Sans"` |

**Phone frame** (every screen): `width 262, height 522, borderRadius 34, background WHITE` (or per-screen bg), `overflow hidden`, `position relative`, `fontFamily SANS`, `color TEXT`, `fontSize 12`, `boxShadow 0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`. Top status bar: height 30, `padding 0 18px`, fontSize 10, fontWeight 700 — left `9:41`, center pill `36×12 background #111 radius 6`, right `●▊` letterSpacing -1. Content area below status bar is **height 492**.

**Bottom nav `BNav`** (Focus screens use `active={2}` = Timer tab): absolute `bottom 8, left 10, right 10, height 56`, background WHITE, borderRadius 20, boxShadow `0 4px 28px rgba(0,0,0,0.13)`, padding `0 8px`, space-between. Visual order: Subjects(menu_book, i0) · Planner(calendar_today, i1) · Ada-face center(i4) · **Timer(timer, i2)** · Stats(bar_chart, i3). Active icon tab: `46×40 radius 14 background INK`, icon fontSize 24 color `#fff`; inactive icon color `MED`. Center Ada button: `44×44 circle`, active background INK else WHITE with `1.5px solid BORDER`.

**`FocusPill`** (`{icon|glyph, label, open}`): borderRadius 100, padding `7px 14px`, fontSize 11, fontWeight 700, `display flex gap 5 align center`. Closed: background `BG`, border `1px solid transparent`, color `TEXT`. Open: background `ACCL`, border `1px solid #6b5cf055`, color `ACC`. Glyph (`◈`) rendered fontSize 12 color ACC; icon (material-icons-outlined) fontSize 13.

**`IceTimer`** (`{progress, size, expr, drip, frost}`, default style "Ice melt"): square `size×size`, centered. SVG rotated `-90deg`: stroke width 7, radius `r = (size-7)/2 - 1`. Track circle stroke `HILITE`. Progress circle stroke `frost ? #9fd6ef : ACC`, `strokeLinecap round`, dash = circumference, offset = `c*min(progress,1)`, transition `stroke-dashoffset 0.9s linear`. Center mascot: `CubeSVG size = size*0.6`, `tone CUBE_TONES[4]` (best/vivid: border `#5a44f1`, body `#cbbcfd`, ink `#31237c`), `melt = min(progress,1)`, `bubbles 3`. When `drip` and progress>0.08: two animated `#bfe6f5` drip droplets. When `frost`: inset glow `inset 0 0 20px rgba(159,214,239,0.65)` + `aqShimmer 2.2s` shimmer ring.

---

## fc-set — route — Focus setup ("Set timer")

Artboard: `<DCArtboard id="fc-set" label="Focus — Set timer"><FOCUS/></DCArtboard>`. Renders `<Phone bg={WHITE}><FocusSetupShell/></Phone>`. Flow-map node is a **hub** (`{hub:1}`). This is the resting Focus tab screen (frozen Ada, 25:00 default, not yet started).

**Layout (top→bottom), container `height 492, flex column, align center, padding 4px 16px 16px`:**
1. **Pill row** — `flex space-between, width 100%, marginBottom 14`:
   - Left `FocusPill glyph="◈" label="Prism"` (closed).
   - Right `FocusPill icon="timer" label="Set time"` (closed).
2. **Title** "Focus" — `fontFamily SANS, fontSize 32, fontWeight 800, marginBottom 8`.
3. **Task chip** (tappable, opens fc-link) — `flex align center gap 7, background WHITE, border 1px solid BORDER, borderRadius 100, padding 6px 10px 6px 12px, marginBottom 12, boxShadow SHADOW, cursor pointer`:
   - dot `7×7 circle background ACC`
   - "LL(1) parsing notes" fontSize 11.5 fontWeight 700 color TEXT
   - "CC 401" fontSize 10.5 color DIM
   - material icon `expand_more` fontSize 16 color DIM
4. **IceTimer** `progress 0, size 150` (frozen full cube, no melt).
5. **Time readout** "25:00" — `fontFamily "Plus Jakarta Sans", fontSize 36, fontWeight 800, letterSpacing 0.5, marginTop 14`.
6. **Start button** — wrapper `marginTop 18, width 100%, flex center`; button: background INK, borderRadius 100, padding `13px 40px`, fontSize 14, fontWeight 800, color `#fff`, `flex align center gap 8`; material icon `play_arrow` fontSize 17 + text "Start focus".
7. `BNav active={2}`.

**Transitions IN:** Bottom-nav Timer tab (active index 2) — entered from any core route via the nav. (Flow map lists no explicit inbound edge; reached as the Focus hub.)
**Transitions OUT (from flow map EDGES):**
- → `fc-link` (modal/overlay) — label "Link" — tap the task chip.
- → `fc-duration` (modal/overlay) — label "Time" — tap the "Set time" pill.
- → `fc-prism` (modal/overlay) — label "Prism" — tap the "Prism" pill.
- → `fc-running` (flow) — label "Start" — tap "Start focus".

---

## fc-link — sheet — Link a task

Artboard: `<DCArtboard id="fc-link" label="Link a task (tap chip)"><FOCUS_LINK_TASK/></DCArtboard>`. Bottom sheet (modal overlay over the dimmed Focus setup). Opened by tapping the task chip on fc-set.

**Container:** `<Phone bg={WHITE}>` → `div height 492, position relative, overflow hidden`.

**Dimmed backdrop:** absolute `top0 left0 right0`, flex column align center, `padding 4px 16px 0`, `opacity 0.25, pointerEvents none` — shows mini pill row (`FocusPill ◈ Prism` + `FocusPill timer "Set time"`, `marginBottom 14`) and "Focus" title `fontSize 32 fontWeight 800`.
**Scrim:** absolute `inset 0, background rgba(20,15,28,0.40)`.

**Bottom sheet:** absolute `bottom0 left0 right0`, background WHITE, `borderRadius 22px 22px 0 0`, `boxShadow 0 -8px 40px rgba(0,0,0,0.20)`, overflow hidden, `padding 10px 0 18px`.
1. **Grabber** — `38×4 radius 2, background #e0ddd7, margin 0 auto 12px`.
2. **Header** `padding 0 18px 12px`: title "Link a task" fontSize 18 fontWeight 800; sub "Optional — track this session against a task" fontSize 11 color MED marginTop 2.
3. **Search field** `margin 0 18px 10px, flex align center gap 8, background BG, borderRadius 12, padding 9px 12px`: material icon `search` fontSize 17 color DIM; placeholder "Search tasks" fontSize 12 color DIM.
4. **"Focus without a task" row** — `flex align center gap 12, padding 11px 18px, borderTop 1px solid BORDER, borderBottom 1px solid BORDER`: leading `30×30 circle background BG` containing material icon `do_not_disturb_on` fontSize 17 color MED; label "Focus without a task" `flex1 fontSize 12.5 fontWeight 700 color TEXT`; trailing material icon `radio_button_unchecked` fontSize 19 color `#cfcbc4`.
5. **Section label** "TODAY" — fontSize 9, fontWeight 800, letterSpacing 0.08em, color DIM, `padding 11px 18px 5px`.
6. **Task rows** (`flex align center gap 12, padding 9px 18px`; selected row background `ACCL`):
   - `['LL(1) parsing notes', 'CC 401', '35m', #6b5cf0, selected]`
   - `['Assignment 3 draft', 'NLP 302', '30m', #5cbbff, off]`
   - `['Read chapter 7', 'DBMS 304', '20m', #2a9d6b, off]`
   - `['Revise normalization', 'DBMS 304', '15m', #2a9d6b, off]`
   Each row: color dot `9×9 circle` (task color); body `flex1` with name fontSize 12.5 fontWeight 700 color TEXT + meta `"<subj> · <dur>"` fontSize 10 color DIM marginTop 1; trailing material icon — selected `check_circle` color ACC, else `radio_button_unchecked` color `#cfcbc4`, fontSize 19.
7. **Primary button** "Link task" — `margin 14px 18px 0, background INK, borderRadius 100, padding 13px 0, text center, fontSize 13, fontWeight 800, color #fff`.

**Transitions IN:** `fc-set` → `fc-link` (modal), label "Link" — tap task chip.
**Transitions OUT:** Dismiss (scrim/Link task) returns to `fc-set`. (No further outbound edge in flow map.)

---

## fc-duration — dialog — Set time

Artboard: `<DCArtboard id="fc-duration" label="Set time (dialog)"><DURATION_MENU/></DCArtboard>`. Centered dialog over the shared live config backdrop. Opened by tapping the "Set time" pill on fc-set.

**Container:** `<Phone bg={WHITE}>` → `FocusConfigBackdrop openPill="time"` (renders the full `FocusSetupShell` at `opacity 0.25` with the "Set time" pill shown open, plus scrim `rgba(20,15,28,0.42)`), then the centered dialog.

**Dialog:** absolute `top 50% left 50% translate(-50%,-50%)`, **width 230**, background WHITE, borderRadius 24, `boxShadow 0 20px 64px rgba(0,0,0,0.34)`, padding `17px 18px 18px`.
1. **Header row** `flex align center space-between, marginBottom 3`: "Set time" fontFamily SANS fontSize 19 fontWeight 800; close `26×26 circle background BG`, `✕` fontSize 12 color MED.
2. **Stepper row** `flex align center justify center gap 18, marginTop 14 marginBottom 14`:
   - `StepBtn icon="remove"` — `38×38 circle background BG`, icon fontSize 20 color TEXT.
   - value group `flex align baseline gap 4`: "25" `fontFamily "Plus Jakarta Sans", fontSize 38, fontWeight 800, color TEXT, lineHeight 1` + "min" fontSize 13 fontWeight 700 color MED.
   - `StepBtn icon="add"`.
3. **Slider** — track `height 6, background BG, borderRadius 3, marginBottom 14`; fill absolute `left0 width 38% background ACC borderRadius 3`; thumb absolute `left 38% translate(-50%,-50%) 18×18 circle background WHITE, boxShadow 0 2px 8px rgba(0,0,0,0.25), border 2px solid ACC`.
4. **Preset chips** `flex gap 6, marginBottom 16` — values `[15, 25, 45, 60]`, each `flex1 text center, padding 6px 0, borderRadius 100, fontSize 11, fontWeight 700`. Selected = 25: background ACC color `#fff`; others background BG color MED.
5. **CTA** "Set · 25 min" — background INK, borderRadius 100, padding `12px 0`, text center, fontSize 13, fontWeight 800, color `#fff`.

**Transitions IN:** `fc-set` → `fc-duration` (modal), label "Time" — tap "Set time" pill.
**Transitions OUT:** Set/✕/scrim dismiss returns to `fc-set`. (No further outbound edge in flow map.)

---

## fc-prism — sheet — Prism mode picker

Artboard: `<DCArtboard id="fc-prism" label="Prism mode picker"><PRISM_MENU/></DCArtboard>`. Anchored dropdown (modal overlay) under the Prism pill. Opened by tapping the "Prism" pill on fc-set. Note: this component does NOT reuse FocusSetupShell — it renders its own dimmed backdrop and keeps `BNav active={2}` visible.

**Container:** `<Phone bg={WHITE}>` → `div height 492, position relative`.

**Dimmed backdrop** (absolute `top0 left0 right0`, flex column align center, `opacity 0.25, pointerEvents none`):
- Pill row `flex space-between width 100%, padding 4px 16px 0, marginBottom 10`: Prism pill (background BG, radius 100, padding 7px 14px, fontSize 11 fontWeight 700, gap 6) with `◈` fontSize 12 color ACC + "Prism"; "Set time" pill (gap 5) with material `timer` fontSize 12 + "Set time".
- Title "Focus" fontFamily SANS fontSize 34 fontWeight 800 marginBottom 4.
- Subtitle "CC 401 · LL(1) parsing notes" fontSize 10 color MED marginBottom 14.
- `FocusRing mins={15} maxMins={60} size={168}` (tick-ring duration dial: accent arc + ticks `ACC`/`#dedede`, ACCL track `#edeafd`, center numeral `"15"` Playfair-serif fontSize 46 fontWeight 800 + "MINS" fontSize 9 letterSpacing 0.14em color MED, axis labels 15/30/45/60 fontSize 9 color DIM).

**Dropdown panel:** absolute `top 30, left 10`, background WHITE, borderRadius 20, overflow hidden, `boxShadow 0 8px 36px rgba(0,0,0,0.15)`, `minWidth 184`.
Mode rows (`flex align center gap 11, padding 11px 18px, borderBottom 1px solid BORDER` except last); active row (first) background `ACCL`:
| Mode | Glyph color | State |
|---|---|---|
| Deep Work | `#6b5cf0` (ACC) | **active** — label fontWeight 700 color ACC, trailing `✓` fontSize 12 color ACC |
| Flow | `#2a9d6b` (SUCC) | label fontWeight 500 color TEXT |
| Review | `#e8a430` (WARN) | fontWeight 500 color TEXT |
| Wind-down | `#777777` (MED) | fontWeight 500 color TEXT |
| No sound | `#c0c0c0` (DIM) | `mute` glyph (diagonal slash), fontWeight 500 color TEXT |

`PrismGlyph` = 22×22 svg: `circle r9 stroke color`; non-mute = 5 vertical soundwave bars heights `[4,7,10,7,4]`; mute = diagonal line. Label fontSize 14.
**Footer row** (`borderTop 1px solid BORDER, padding 10px 18px, flex align center gap 8`): material icon `music_note` fontSize 15 color MED; "Autoplay Prism" `flex1 fontSize 12.5 fontWeight 600 color TEXT`; toggle `34×19 radius 10 background ACC`, knob `15×15 circle WHITE` aligned flex-end (ON).
`BNav active={2}`.

**Transitions IN:** `fc-set` → `fc-prism` (modal), label "Prism" — tap "Prism" pill.
**Transitions OUT:** Selecting a mode / tapping outside returns to `fc-set`. (No further outbound edge in flow map.)

---

## fc-running — route — Running (live melt)

Artboard: `<DCArtboard id="fc-running" label="Running — live melt"><FOCUS_RUNNING/></DCArtboard>`. Active session; the ice cube melts as the ring depletes. Per FRAMES.md this is a Redis/Socket.IO-backed live route. Prototype runs a JS timer: `TOTAL 1500s` (25:00), starts at `elapsed 180`, preview pace `SPEED 45` session-sec/real-sec, ticking every 1000ms; `paused` state toggles the primary button between Freeze/Resume in place.

**Container:** `<Phone bg={WHITE}>` → `div height 492, flex column align center, padding 4px 16px 16px`.
1. **Pill row** `flex space-between width 100%, marginBottom 14`: `FocusPill glyph="◈" label="Deep Work"` + `FocusPill icon="timer" label="Set time"` (both closed).
2. **Title** "Focus" fontFamily SANS fontSize 32 fontWeight 800 marginBottom 3.
3. **Subtitle** "CC 401 · LL(1) parsing notes" fontSize 10.5 color MED marginBottom 12.
4. **IceTimer** `progress={elapsed/TOTAL}, size 150, expr "happy", drip={!paused}` — animated melt; drips render while running.
5. **Time readout** `{mm}:{ss}` (counts down from remaining) — `fontFamily "Plus Jakarta Sans", fontSize 36, fontWeight 800, letterSpacing 0.5, marginTop 14`.
6. **Action row** `marginTop 18, flex gap 10`:
   - **Freeze/Resume** (`onClick` toggles paused): background INK, borderRadius 100, padding `13px 30px`, fontSize 14, fontWeight 800, color `#fff`, `flex align center gap 7`. Icon material `ac_unit` + "Freeze" when running; `play_arrow` + "Resume" when paused. fontSize 17.
   - **End**: background WHITE, `border 1.5px solid BORDER`, borderRadius 100, padding `13px 28px`, fontSize 14, fontWeight 800, color `#e85476`, `flex align center gap 7`; material icon `stop_circle` fontSize 17 + "End".
7. `BNav active={2}`.

**Transitions IN:** `fc-set` → `fc-running` (flow), label "Start". Also `fc-paused` → `fc-running` (loop), label "Resume".
**Transitions OUT:**
- → `fc-paused` (flow), label "Pause" — tap Freeze.
- → `fc-end` (flow), label "Done" — timer completes / tap End.

---

## fc-paused — state — Paused (frozen)

Artboard: `<DCArtboard id="fc-paused" label="Paused — frozen"><FOCUS_PAUSED/></DCArtboard>`. **Kind = state** (per FRAMES.md): the paused presentation of `fc-running`. In the prototype, fc-running's own `paused` boolean (toggled by the Freeze button) drives this exact look; this artboard is the static frozen snapshot — cube re-freezes, frost shimmer, dimmed time. Title changes "Focus" → "Frozen".

**Container:** `<Phone bg={WHITE}>` → `div height 492, flex column align center, padding 4px 16px 16px`.
1. **Pill row** — identical to fc-running: `FocusPill ◈ "Deep Work"` + `FocusPill timer "Set time"`, marginBottom 14.
2. **Title** "Frozen" fontFamily SANS fontSize 32 fontWeight 800 marginBottom 3.
3. **Subtitle** "CC 401 · LL(1) parsing notes" fontSize 10.5 color MED marginBottom 12.
4. **IceTimer** `progress 0.4, size 150, expr "happy", frost` — frozen at 40%, frost shimmer ring + inset glow `rgba(159,214,239,0.65)`, progress arc stroke `#9fd6ef`.
5. **Time readout** "15:00" — `fontFamily "Plus Jakarta Sans", fontSize 36, fontWeight 800, letterSpacing 0.5, marginTop 14, color MED` (dimmed vs running).
6. **Action row** `marginTop 22 (note: larger than running's 18), flex gap 10`:
   - **Resume**: background INK, borderRadius 100, padding `13px 30px`, fontSize 14, fontWeight 800, color `#fff`, gap 7; material `play_arrow` fontSize 17 + "Resume".
   - **End**: background WHITE, `border 1.5px solid BORDER`, borderRadius 100, padding `13px 28px`, fontSize 14, fontWeight 800, color `#e85476`, gap 7; material `stop_circle` fontSize 17 + "End".
7. `BNav active={2}`.

**Toggle (state):** entered from `fc-running` by tapping **Freeze** (sets `paused = true` on the parent running screen). The Freeze→Resume swap happens in-place on the running component; the dedicated artboard is the canonical frozen state.
**Transitions IN:** `fc-running` → `fc-paused` (flow), label "Pause".
**Transitions OUT:** `fc-paused` → `fc-running` (loop), label "Resume" — tap Resume. (End leads to session end as on running.)

---

## fc-end — route/dialog — Session complete

Artboard: `<DCArtboard id="fc-end" label="Session complete"><SESSION_END/></DCArtboard>`. End-of-session summary + mood capture. Full light gradient background (Tiimo-style). Per FRAMES.md kind = **route/dialog**.

**Container:** `<Phone bg={...gradient}>` — bg `linear-gradient(160deg, #f5f2ff 0%, #c9bcf8 46%, #6b5cf0 100%)`. Inner: `div height 492, flex column align center justify center, padding 14px 20px, text center`. Local overrides in this component: `INK = #1a1320` (fixed dark ink, used for text + button), `INK_SUB = rgba(36,24,52,0.58)`.

**Layout (vertically centered):**
1. **Mode chip** — background `rgba(255,255,255,0.6)`, borderRadius 100, padding `5px 13px`, fontSize 10, fontWeight 700, color `#1a1320`, `flex gap 6 align center`, `backdropFilter blur(6px)`, marginBottom 22; `◈` fontSize 11 color ACC + " Deep Work · Prism".
2. **Title** "Session done" — fontFamily SANS fontSize 26 fontWeight 800 marginBottom 5 color `#1a1320`.
3. **Subtitle** "LL(1) parsing notes · CC 401" — fontSize 11.5 color `INK_SUB` marginBottom 18.
4. **Duration block** (`flex column align center, marginBottom 18`): "25:00" `fontFamily "Plus Jakarta Sans", fontSize 48, fontWeight 800, letterSpacing 0.5, color #1a1320, lineHeight 1`; below "Focused" fontSize 12 fontWeight 600 color INK_SUB marginTop 6.
5. **Mood card** — background `rgba(255,255,255,0.78)`, borderRadius 18, padding `14px 14px`, `width 100%`, marginBottom 16, `backdropFilter blur(8px)`:
   - "How was that session?" fontSize 12 fontWeight 700 marginBottom 12 color `#1a1320`.
   - Mood row `flex justify center align center gap 6` — 5 `MoodBlob` (ice-cube faces) indices 0–4 (Rough/Tired/OK/Good/Great), colors `#a79fc4 / #9286d2 / #7d70d9 / #6a5ce4 / #5a44f1`. **Selected = idx 3 (Good)**: wrapper `padding 2.5, borderRadius 50%, border 2px solid #6a5ce4, background #6a5ce422`, blob `size 32`; others wrapper transparent border, blob `size 29`.
6. **Primary CTA** "Back to today →" — `width 100%, padding 13px 16px, background #1a1320, borderRadius 100, color #fff, fontSize 14, fontWeight 700, flex center gap 8, marginBottom 10`.
7. **Secondary link** "Start another session" — fontSize 11.5 color INK_SUB fontWeight 600.

**Transitions IN:** `fc-running` → `fc-end` (flow), label "Done".
**Transitions OUT:** `fc-end` → `plan-timeline` (cross), label "Back to plan" — tap "Back to today →". "Start another session" loops back to `fc-set` (in-prototype; not an explicit flow-map edge).

---

### Edge-kind legend (flow map)
`flow` = primary navigation (solid green). `modal` = opens an overlay/dialog (dotted; node tagged "overlay"). `cross` / `loop` = jump or loop between journeys (dashed). The fc-link / fc-duration / fc-prism edges are all `modal` overlays on top of fc-set; fc-paused↔fc-running is a `loop`; fc-end→plan-timeline is a `cross`.
