# Section 00b — Guest Mode — Build Spec

Pixel-exact spec extracted from `prototypes/Aqademiq V1 Full Flow v5.html` (look + values)
and `prototypes/Aqademiq User Flow - Comprehensive.html` (transitions). Rebuild as Flutter
widgets from this doc alone.

---

## Shared design tokens (resolved, light mode, default tweaks: accent `#6b5cf0`, warmth `Warm`)

| Token | Value | Notes |
|---|---|---|
| `SANS` | `"Plus Jakarta Sans", system-ui, sans-serif` | primary UI font |
| `MONO` | `"JetBrains Mono", "Courier New", monospace` | |
| `NUMSERIF` / `SERIF` | `"Playfair Display", Georgia, serif` | numerals (stat values) |
| `BG` | `#f4f3f0` | phone background (warm) |
| `WHITE` | `#ffffff` | cards, sheets, nav, pills |
| `TEXT` | `#111111` | primary text |
| `MED` | `#777777` | secondary text |
| `DIM` | `#c0c0c0` | tertiary text / muted |
| `ACC` | `#6b5cf0` | accent (periwinkle) |
| `ACCL` | `#edeafd` | accent-light fill (nudge cards, circles) |
| `INK` | `#111111` | dark CTA buttons / active nav |
| `WARN` | `#e8a430` | guest / lock indicators |
| `BORDER` | `rgba(0,0,0,0.07)` | hairline borders |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` | card shadow |
| `HILITE` | `#eceae7` | selected date chip / collapse-head pill bg |
| `SUCC` | `#2a9d6b` | success/green (flow legend) |

Note: `ACC + '22'` = `#6b5cf022` (≈13% alpha) — used for nudge-card border.

### Phone shell (`Phone`)
- Outer: `width 262`, `height 522`, `borderRadius 34`, `background = bg||BG`, `overflow hidden`, `position relative`, `fontFamily SANS`, `color TEXT`, `fontSize 12`, `boxShadow 0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
- Status bar (top): `height 30`, flex space-between, `padding 0 18px`, `fontSize 10`, `fontWeight 700`. Left `9:41`; center pill `36×12` `borderRadius 6` `background #111`; right glyph `●▊` `letterSpacing -1`.
- Content area below status bar is the screen body (`height 452` in every guest frame).

### Bottom nav (`BNav`) — guest variant
- Container: `position absolute`, `bottom 8`, `left 10`, `right 10`, `height 56`, `background WHITE`, `borderRadius 20`, `boxShadow 0 4px 28px rgba(0,0,0,0.13)`, flex row space-between, `padding 0 8px`.
- Visual order (left→right) with semantic index: Subjects `menu_book`(0) · Planner `calendar_today`(1) · **Ada center**(4) · Timer `timer`(2) · Stats `bar_chart`(3).
- Each icon tab: wrapper `flex:1` centered; inner `width 46 × height 40`, `borderRadius 14`; active → `background INK`, icon color `#fff`; inactive → transparent, icon color `MED`. Icon = `material-icons-outlined`, `fontSize 24`.
- Center Ada slot: wrapper `flex:1` centered; circle `44×44` `borderRadius 50%`; active → `background INK` no border; inactive → `background WHITE`, `border 1.5px solid BORDER`. Holds `AdaNavFace size=34`. `opacity 0.55` when locked.
- `AdaNavFace`: round div, `borderRadius 50%`, `background radial-gradient(circle at 36% 30%, #cbbcfd 0%, #b7a6f5 46%, #6b5cf0 100%)`, `boxShadow inset 0 -2px 5px rgba(40,25,90,0.18)`; SVG smile face, ink `#31237c`.
- **Guest gating:** `locked(i) = guest && (i===3 || i===4)` → Stats(3) and Ada(4) show a `LockDot` and 0.55 opacity.
- `LockDot`: `position absolute`, `top -1`, `right 2`, `14×14`, `borderRadius 50%`, `background WARN (#e8a430)`, `border 2px solid WHITE`, centered `lock` icon `fontSize 8` color `#fff`.

### Primary button (`PBtn`)
- `width 100%`, `padding 13px 16px`, `background INK` (`#111111`) (ghost → `WHITE` + `border 1.5px solid BORDER`), `borderRadius 100`, `color #fff` (ghost → `TEXT`), `fontSize 14`, `fontWeight 800`, `letterSpacing 0.01em`, `fontFamily SANS`.

### Card (`Card`)
- `background WHITE`, `borderRadius 16`, `padding 12px 14px`, `boxShadow SHADOW`. (Frames override padding/bg/shadow/border via style.)

### AdaBlob (`AdaBlob size, mood`)
- Renders `CubeSVG` with best tone `CUBE_TONES[4]` = `{ border:#5a44f1, body:#cbbcfd, ink:#31237c }`, `melt 0`, expression = mood, 3 bubbles. Periwinkle ice-cube mascot, rounded square body with face. `size` is square px. Moods used here: `happy`, `focused`.

### Flow-map edge legend
- `flow` = **Primary navigation** (solid green `#2a9d6b`).
- `modal` = **Opens an overlay / dialog** (dotted grey `#b7b1a8`).
- `cross` = **Jump / loop between journeys** (dashed `#8a847d`).

---

## guest-home — kind: route — "Guest home + setup nudge"

Renders `<GUEST_HOME/>`. The full Plan/Home, usable with no account, with a guest setup nudge on top. Component: `Phone` (default `BG` bg) → body `padding 0 16px`, `height 452`, `overflow hidden`. Hub node in flow map.

**Top-to-bottom layout:**
1. **Header row** — flex space-between, `align center`, `marginBottom 10`.
   - Left (tappable, `cursor pointer`): day title `Monday` — `fontFamily SANS`, `fontWeight 800`, `letterSpacing -0.3`, `lineHeight 1.1`, `fontSize 15`. Below it month row `JUN 2026` — flex align center `gap 1`, `fontSize 9.5`, `fontWeight 800`, `color MED`, `letterSpacing 0.04em`, `marginTop 1`, followed by `chevron_right` icon `fontSize 11`.
   - Right action cluster: flex align center `gap 7`.
     - **GUEST badge pill:** `background WHITE`, `borderRadius 100`, `padding 5px 11px`, `boxShadow SHADOW`, `fontSize 9.5`, `fontWeight 800`, `letterSpacing 0.05em`, `color MED`, flex `gap 4` align center. Contains `person_outline` icon `fontSize 11` color `WARN`, then text `GUEST`.
     - **··· / + pill:** flex align center `gap 2`, `background WHITE`, `borderRadius 100`, `padding 4px 6px`, `boxShadow SHADOW`. Two `30×30` `borderRadius 50%` centered slots: first `···` (`fontSize 17`, `fontWeight 800`, `color TEXT`, `lineHeight 1`, `paddingBottom 5`); second holds `add` icon `fontSize 21` color `TEXT`.
2. **`PlanDateStrip selected={0} today={0}`** — flex space-between, `marginBottom 10`. 7 days `M T W T F S S` with numbers `1..7`. Each day cell: `width 34`, column, `gap 2`, `padding 5px 0`, `borderRadius 14`; selected cell → `background HILITE (#eceae7)`. Number `fontSize 10` `fontWeight 700` (`color ACC` if today & not selected, else `DIM`). Letter `fontSize 19` `fontWeight 800` SANS (`color TEXT` if selected, else `ACC` if today, else `DIM`). Selected underline bar `14×3` `borderRadius 2` `background #c4c1bb`. Here index 0 (Mon) is both selected and today. (Days with n<3 are "past" but no extra styling applied here.)
3. **Guest setup nudge `Card`** — overridden style: `background ACCL (#edeafd)`, `boxShadow none`, `padding 10px 12px`, `marginBottom 10`, `border 1px solid #6b5cf022`.
   - Inner row: flex `gap 9` align center.
     - `AdaBlob size={26} mood="happy"`.
     - Text column (`flex 1`): line 1 `You're exploring as a guest` — `fontSize 11.5`, `fontWeight 700`, `marginBottom 1`. line 2 `Set up so Ada can plan your week & track stats.` — `fontSize 10`, `color MED`, `lineHeight 1.45`.
   - CTA bar: `background INK (#111111)`, `borderRadius 100`, `padding 7px 0`, `textAlign center`, `fontSize 11`, `fontWeight 700`, `color #fff`, `marginTop 8`. Text `Set up now · 2 min →`.
4. **Collapse head** — wrapper `marginBottom 8`. `CollapseHead label="PLANNED" count={1} open`. Renders centered pill: `display inline-flex` align center `gap 7`, `background HILITE`, `borderRadius 100`, `padding 7px 15px` (no icon). Label text `PLANNED (1)` — `fontSize 11.5`, `fontWeight 800`, `letterSpacing 0.05em`, `color TEXT`. Trailing `expand_more` icon (open) `fontSize 18` color `TEXT`.
5. **`TimeLabel`** `2:00 PM` — `fontSize 11`, `fontWeight 800`, `color TEXT`, `margin 10px 0 7px`.
6. **`PlanTask`** — `title="Read chapter 4" dur="30m" tag="CC 401" color={ACC} bar`. Card: flex `align stretch` `gap 11`, `background WHITE`, `borderRadius 16`, `boxShadow SHADOW`, `padding 11px 13px`. Left color bar `width 4` `borderRadius 4` `background ACC`. Body: title `fontSize 13` `fontWeight 800` `lineHeight 1.25`; meta row (`marginTop 4`, `gap 8`): tag `CC 401` as `fontSize 9.5` `fontWeight 800` `color ACC` with leading `6×6` dot `background ACC`; duration `30m` `fontSize 10.5` `color DIM` `fontWeight 600`. Trailing completion circle `22×22` `borderRadius 50%`, `border 2px solid #d6d3ce` (unchecked).
7. **`BNav active={1} guest`** — Planner tab active (INK). Stats(3) + Ada(4) locked with `LockDot`.

**Transitions IN:**
- `welcome → guest-home` — kind `cross` (dashed jump), label **"Jump in"**.

**Transitions OUT:**
- `guest-home → guest-subjects` — kind `flow` (primary nav). (Tap Subjects tab in BNav.)
- `guest-home → guest-ada` — kind `modal`, label **"Tap Ada"** (opens guest-ada overlay).
- `guest-home → guest-stats` — kind `modal`, label **"Tap Stats"** (opens guest-stats overlay).
- `guest-home → guest-save` — kind `modal`, label **"Session end"** (opens guest-save overlay after a session).
- (Implicit from nudge CTA "Set up now" → onboarding `ob-referral`; not drawn as a distinct edge in the flow map, but mirrors `guest-ada → ob-referral`.)

---

## guest-subjects — kind: route — "Guest Subjects (empty)"

Renders `<GUEST_SUBJECTS/>`. Subjects tab in its empty state (fresh guest, no subjects). Component: `Phone` (default `BG` bg) → body `padding 0 16px`, `height 452`, `overflow hidden`, `display flex column`.

**Top-to-bottom layout:**
1. **Header row** — flex space-between align center, `marginBottom 10`.
   - Left group: flex align center `gap 8`. Logo `<img src="assets/aqademiq-logo-new.png">` `width 26 × height 26` `objectFit contain`. Then **GUEST badge pill** (identical to guest-home: `WHITE` bg, `borderRadius 100`, `padding 5px 11px`, `boxShadow SHADOW`, `fontSize 9.5`, `fontWeight 800`, `letterSpacing 0.05em`, `color MED`, `person_outline` icon `fontSize 11` `WARN` + `GUEST`).
   - Right: **··· / + pill** identical to guest-home (flex `gap 2`, `WHITE`, `borderRadius 100`, `padding 4px 6px`, `boxShadow SHADOW`; `···` slot `30×30` `fontSize 17` `fontWeight 800` `color TEXT` `paddingBottom 5`; `add` slot `30×30` icon `fontSize 21` `color TEXT`).
2. **Title row** — flex align baseline `gap 7`, `marginBottom 14`. `Subjects` — `fontFamily SANS`, `fontSize 30`, `fontWeight 800`, `letterSpacing -0.5`. Count `0` — `fontSize 13`, `fontWeight 700`, `color DIM`.
3. **Empty-state block** (`flex 1`, column, center/center, `textAlign center`, `padding 0 18px`):
   - Circle `width 78 × height 78` `borderRadius 50%` `background ACCL (#edeafd)`, centered, `marginBottom 16`, holding `AdaBlob size={48} mood="happy"`.
   - Heading `No subjects yet` — base `fontFamily SANS` `fontSize 19` `fontWeight 800` `marginBottom 6`, **overridden** to `fontFamily "Plus Jakarta Sans"` and `fontWeight 700` (700 wins).
   - Body `Add the classes you're taking and I'll keep your materials, deadlines and grades in one place.` — `fontSize 12`, `color MED`, `lineHeight 1.55`, `marginBottom 18`.
   - **Add CTA pill:** flex align center `gap 7`, `background INK (#111111)`, `borderRadius 100`, `padding 11px 22px`, `color #fff`, `fontSize 12.5`, `fontWeight 800`, `whiteSpace nowrap`. Leading `add` icon `fontSize 17`, text `Add your first subject`.
4. **Guest setup nudge `Card`** — overridden: `background ACCL`, `boxShadow none`, `padding 11px 12px`, `marginBottom 12`, `border 1px solid #6b5cf022`.
   - Inner row: flex `gap 9` align center.
     - `AdaBlob size={28} mood="focused"` (note: focused mood, larger than guest-home's 26).
     - Text column (`flex 1`): line 1 `You're exploring as a guest` — `fontSize 11.5` `fontWeight 700` `marginBottom 1`. line 2 `Set up so I can plan your week & track grades.` — `fontSize 10` `color MED` `lineHeight 1.45`. (Note copy differs from guest-home: "I" not "Ada", "track grades" not "track stats"; no CTA bar here.)
5. **`BNav active={0} guest`** — Subjects tab active (INK). Stats(3) + Ada(4) locked.

**Transitions IN:**
- `guest-home → guest-subjects` — kind `flow` (primary nav, tap Subjects tab).

**Transitions OUT:**
- No outbound edges drawn in the flow map. Semantic CTAs: "Add your first subject" and the nudge both lead into onboarding (`ob-referral`) in the same pattern as other guest gates, but these are not explicit edges. Tab nav can return to `guest-home` (Planner) and open gated `guest-ada`/`guest-stats` per BNav.

---

## guest-ada — kind: dialog/state — "Tap Ada → onboarding prompt"

Renders `<GUEST_ADA_PROMPT/>`. Gated-feature prompt shown when a guest taps the (locked) Ada tab. **State/dialog:** toggled on the parent (`guest-home`) by tapping the Ada center nav button (semantic index 4, locked). Implemented here as a full-screen prompt, NOT a partial sheet. Component: `Phone bg={WHITE}` (white background, not BG).

**Top-to-bottom layout** — body `height 452`, flex column, align center, justify center, `textAlign center`, `padding 0 26px 38px`:
1. **Ada avatar with lock badge** — `position relative`.
   - `AdaBlob size={88} mood="happy"`.
   - Lock badge: `position absolute`, `bottom 2`, `right -2`, `width 26 × height 26`, `borderRadius 50%`, `background WARN (#e8a430)`, `border 3px solid WHITE`, centered `lock` icon `fontSize 13` color `#fff`.
2. **Heading** `Meet Ada` — `fontFamily "Plus Jakarta Sans"`, `fontSize 22`, `fontWeight 800`, `marginTop 18`, `marginBottom 8`, `lineHeight 1.25`.
3. **Subtext** `Ada builds your week from your real workload. To plan for you, it needs to know what you're studying.` — `fontSize 12.5`, `color MED`, `lineHeight 1.6`, `marginBottom 18`.
4. **Benefits `Card`** — overridden: `width 100%`, `boxShadow none`, `background BG (#f4f3f0)`, `padding 10px 14px`, `marginBottom 22`, `textAlign left`.
   - 3 rows, each: flex align center `gap 9`, `padding 6px 0`, bottom `border 1px solid BORDER` except last row. Each: `check_circle` icon `fontSize 15` `color ACC` + label `fontSize 11.5` `fontWeight 600`. Labels: `What & where you study`, `Your deadlines & syllabus`, `When you focus best`.
5. **`PBtn`** `Set up Ada · 2 min →` — `marginBottom 9` (INK bg, white text, full-width, `borderRadius 100`, `padding 13px 16px`, `fontSize 14`, `fontWeight 800`).
6. **Secondary link** `Maybe later` — `fontSize 11.5`, `color MED`, `fontWeight 600`, `cursor pointer`.
7. **`BNav active={4} guest`** — Ada center tab active. Note: even though active, Stats(3) and Ada(4) still render `LockDot` per `locked(i)` (guest && i===3||4) — active styling (INK circle) combines with the lock badge.

**Transitions IN:**
- `guest-home → guest-ada` — kind `modal` (opens overlay), label **"Tap Ada"**.

**Transitions OUT:**
- `guest-ada → ob-referral` — kind `cross` (dashed jump to onboarding), label **"Set up"** (the `Set up Ada · 2 min →` button).
- "Maybe later" dismisses back to parent (`guest-home`); not drawn as an edge.

---

## guest-stats — kind: dialog/state — "Tap Stats → onboarding prompt"

Renders `<GUEST_STATS_PROMPT/>`. Gated-feature prompt shown when a guest taps the (locked) Stats tab. **State:** toggled on the parent (`guest-home`) by tapping the Stats nav button (semantic index 3, locked). Implemented as a blurred-stats backdrop with a bottom sheet overlay. Component: `Phone` (default `BG` bg).

**Layout — two layers inside body `padding 0 16px`, `height 452`, `position relative`:**

**Layer A — blurred stats preview** (`filter blur(3.5px)`, `opacity 0.5`, `pointerEvents none`):
1. Page title `Your stats` — `fontFamily SANS`, `fontSize 28`, `fontWeight 800`, `marginBottom 14`. (This title sits OUTSIDE the blur wrapper — it is sharp/full.)
2. Stat cards row: flex `gap 8`, `marginBottom 10`. Two `Card`s each `flex 1`, `textAlign center`, `padding 14px`: value `—` (`fontFamily NUMSERIF`, `fontSize 28`, `fontWeight 800`); label below `fontSize 9`, `fontWeight 800`, `color DIM`, `letterSpacing 0.1em`. Labels: `DAY STREAK`, `FOCUS HRS`.
3. Weekly-focus `Card`: `marginBottom 10`, `height 96`. Title `Weekly focus` — `fontFamily SANS`, `fontSize 13`, `fontWeight 700`, `marginBottom 8`. Bars row: flex align flex-end `gap 6`, `height 44`; 7 bars heights `[40,70,30,85,55,20,60]%`, each `flex 1`, `background ACC`, `opacity 0.5`, `borderRadius 3`.
4. Mood-trends `Card`: `height 70`, title `Mood trends` — `fontFamily SANS`, `fontSize 13`, `fontWeight 700`.

**Layer B — bottom sheet** (`position absolute`, `bottom 0`, `left 0`, `right 0`, `background WHITE`, `borderRadius 22px 22px 0 0`, `padding 16px 18px 78px`, `boxShadow 0 -8px 40px rgba(0,0,0,0.14)`):
1. Grabber: `width 36 × height 4`, `borderRadius 2`, `background #e0e0e0`, `margin 0 auto 14px`.
2. Text block (`marginBottom 14`): heading `Track your progress` — `fontFamily "Plus Jakarta Sans"`, `fontSize 16`, `fontWeight 800`, `marginBottom 3`. Body `Set up your profile and Ada will track your streaks, focus hours & mood trends — then tune your plan to match.` — `fontSize 11.5`, `color MED`, `lineHeight 1.55`.
3. **`PBtn`** `Set up now · 2 min →` — `marginBottom 8` (INK, full-width).
4. Secondary link `Not now` — `textAlign center`, `fontSize 11.5`, `color MED`, `fontWeight 600`, `cursor pointer`.

**`BNav active={3} guest`** — Stats tab active. Stats(3) + Ada(4) render `LockDot`. The sheet's `padding-bottom 78` clears the nav (white runs flush under the nav).

**Transitions IN:**
- `guest-home → guest-stats` — kind `modal` (opens overlay), label **"Tap Stats"**.

**Transitions OUT:**
- No explicit outbound edge in the flow map. CTA `Set up now · 2 min →` semantically jumps to onboarding (`ob-referral`), mirroring `guest-ada → ob-referral`. `Not now` dismisses back to parent (`guest-home`).

---

## guest-save — kind: dialog/state — "After session → save-progress prompt"

Renders `<GUEST_SAVE_PROMPT/>`. Save-progress prompt shown after a guest completes a real focus session. **State:** triggered on the parent (`guest-home`) at session end (flow edge `guest-home → guest-save`, label "Session end"). Implemented as a faded session-complete backdrop with a bottom sheet. Component: `Phone` (default `BG` bg).

**Layout — body `height 452`, `position relative`:**

**Layer A — faded session-complete backdrop** (`opacity 0.32`; inner: flex column center/center, `height 100%`, `textAlign center`, `padding 0 22px`):
1. Circle `width 70 × height 70`, `borderRadius 50%`, `background ACCL (#edeafd)`, centered, `marginBottom 14`, holding `AdaBlob size={56} mood="happy"`.
2. `Session done` — `fontFamily SANS`, `fontSize 24`, `fontWeight 800`.
3. `You focused for 25 minutes` — `fontSize 12`, `color MED`.

**Layer B — bottom sheet** (`position absolute`, `bottom 0`, `left 0`, `right 0`, `background WHITE`, `borderRadius 22px 22px 0 0`, `padding 16px 18px 78px`, `boxShadow 0 -8px 40px rgba(0,0,0,0.14)`):
1. Grabber: `width 36 × height 4`, `borderRadius 2`, `background #e0e0e0`, `margin 0 auto 14px`.
2. Text block (`marginBottom 14`): heading `Don't lose this session` — `fontFamily "Plus Jakarta Sans"`, `fontSize 16`, `fontWeight 800`, `marginBottom 3`. Body `You're in guest mode, so this won't be saved. Create an account to keep your streak & history.` — `fontSize 11.5`, `color MED`, `lineHeight 1.55`.
3. **`PBtn`** `Create account & save →` — `marginBottom 8` (INK, full-width).
4. Secondary link `Not now` — `textAlign center`, `fontSize 11.5`, `color MED`, `fontWeight 600`, `cursor pointer`.

**`BNav active={2} guest`** — Timer tab active (a session just ran). Stats(3) + Ada(4) render `LockDot`. Sheet `padding-bottom 78` clears nav.

**Transitions IN:**
- `guest-home → guest-save` — kind `modal` (overlay), label **"Session end"** (after a real focus session completes).

**Transitions OUT:**
- `guest-save → signup` — kind `cross` (dashed jump), label **"Save"** (the `Create account & save →` button → Create account screen `signup` / `auth-signup`).
- `Not now` dismisses back to parent (`guest-home`); not drawn as an edge.

---

## Cross-frame notes for the developer
- **Header pattern** is shared by `guest-home` and `guest-subjects`: the GUEST badge pill + `··· / +` pill cluster are identical (only `guest-home` shows a day/month title on the left; `guest-subjects` shows the logo instead).
- **Guest nudge `Card`** appears on `guest-home` (with a black CTA bar) and `guest-subjects` (no CTA bar, different mascot mood `focused` and slightly different copy). Both use `background ACCL`, `boxShadow none`, `border 1px solid #6b5cf022`.
- **Three prompt frames** (`guest-ada`, `guest-stats`, `guest-save`) are gating overlays toggled from the parent home; all three use a `PBtn` (INK) primary + a muted text secondary (`Maybe later` / `Not now`). `guest-ada` is a full white screen; `guest-stats` and `guest-save` are bottom sheets over a dimmed backdrop (sheet: `WHITE`, `borderRadius 22 22 0 0`, `padding 16px 18px 78px`, `boxShadow 0 -8px 40px rgba(0,0,0,0.14)`, grabber `36×4` `#e0e0e0`).
- **Locked tabs** (Stats idx 3, Ada idx 4) always show a `WARN` LockDot in guest mode — even when that tab is the active one (`guest-ada` active=4, `guest-stats` active=3).
- The flow map has no explicit "Set up" edge out of `guest-subjects` or `guest-stats`; their CTAs follow the established `→ ob-referral` onboarding entry used by `guest-ada`.
