# Section 03 — Subjects — Build Spec

Pixel-exact spec extracted from `prototypes/Aqademiq V1 Full Flow v5.html`. Transitions from `prototypes/Aqademiq User Flow - Comprehensive.html`.

> **Phone shell scale.** Every frame renders inside `<Phone>`: a 262×522 device, `borderRadius: 34`, `overflow: hidden`, `fontFamily: SANS`, base `color: #111111`, base `fontSize: 12`, `boxShadow: 0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`. Background = `bg` prop or `BG`. All px below are in this 262-wide coordinate space (scale up proportionally for a real device).
>
> **Status bar** (top of Phone, always present): height 30, padding `0 18px`, `display:flex` space-between, `fontSize:10`, `fontWeight:700`. Left: `9:41`. Center: pill 36×12, `background:#111`, `borderRadius:6`. Right: `●▊` with `letterSpacing:-1`. (Dark mode swaps text to `rgba(255,255,255,0.9)` and pill to `rgba(255,255,255,0.5)`.)

## Design tokens (light, default warm theme — `TWEAK_DEFAULTS`)
- `accent: #6b5cf0`, `warmth: Warm`, `subjectsLayout: List`, `focusTimer: Ice melt`, `darkMode: false`.
- `BG = #f4f3f0` (Warm; Neutral=`#f5f5f5`, Cool=`#f0f3f7`)
- `ACC = #6b5cf0` · `ACCL = #edeafd` (accent light tint) · `INK = #111111` (dark mode: INK=ACC)
- `WHITE = #ffffff` · `TEXT = #111111` · `MED = #777777` · `DIM = #c0c0c0`
- `BORDER = rgba(0,0,0,0.07)` · `SHADOW = 0 2px 16px rgba(0,0,0,0.08)`
- `SUCC = #2a9d6b` · `WARN = #e8a430`
- Fonts: `SANS = "Plus Jakarta Sans", system-ui` · `SERIF = "Playfair Display", Georgia, serif` · `MONO = "JetBrains Mono", "Courier New", monospace`
- Material icons: class `material-icons-outlined`.

## Shared subject data (`SUBJECTS[]`)
Index / name / code / prof / grade / credits / color / mood(0–4) / files / next / focus:
0. Compiler Construction · `CC 401` · Prof. S. Rao · `A` · 4cr · color `#6b5cf0`(ACC) · mood 1 · 3 files · "Viva · 3 days" · 4.5h
1. Natural Language Processing · `NLP 302` · Dr. A. Mehta · `A−` · 3cr · color `#5cbbff` · mood 3 · 2 files · "Assignment · Fri" · 2h
2. Computer Networks · `NET 305` · Prof. K. Iyer · `B+` · 4cr · color `#2a9d6b`(SUCC) · mood 2 · 4 files · "Lab · tomorrow" · 3h
3. Database Systems · `DBS 310` · Dr. N. Khan · `A` · credits `null` · color `#e8a430`(WARN) · mood 3 · 1 file · next `null` · 1.5h

`MOODS[]` (0→4): `{Rough #a79fc4}` `{Tired #9286d2}` `{OK #7d70d9}` `{Good #6a5ce4}` `{Great #5a44f1}`. `MoodBlob idx` renders a melting ice-cube (idx 0 = pale puddle/sad, idx 4 = crisp/happy).

## Shared sub-components
- **`SubjHeader`** (top of list/menu/sheet-under): `display:flex` space-between, `marginBottom:10`. **Left "Share" pill:** WHITE, `borderRadius:100`, `padding:6px 13px`, SHADOW, gap 6 → icon `ios_share` (fontSize 15, color TEXT) + text "Share" (fontSize 12, fontWeight 800). **Right combined pill:** WHITE, `borderRadius:100`, `padding:4px 6px`, SHADOW, gap 2, contains two 30×30 circles: `···` (fontSize 17, fontWeight 800, letterSpacing 0.5, lineHeight 1, paddingBottom 5) and `add` icon (fontSize 21, color TEXT).
- **`GradeChip {grade,color}`**: inline-flex, gap 3, `background: color+"1c"`, `color: color`, `borderRadius:7`, `padding:2px 7px`, fontSize 10, fontWeight 800; leading icon `track_changes` (fontSize 11).
- **`SubjectRow {s}`** (list tile): `display:flex` align-stretch, gap 11, WHITE, `borderRadius:16`, SHADOW, `padding:11px 13px`. Left accent bar: width 4, `borderRadius:4`, `background:s.color`. Body: row1 = code (fontSize 9, fontWeight 800, color s.color) + `· {credits} cr` (fontSize 9, color DIM, fontWeight 700, only if credits) + GradeChip pushed right (`marginLeft:auto`). row2 = name (fontSize 13, fontWeight 800, lineHeight 1.2, marginBottom 3). row3 = meta (fontSize 10, color DIM, fontWeight 600, gap 9): `person_outline`(12)+prof, `attach_file`(12)+files, and if `next` a colored dot(5×5, s.color)+next text (color s.color).
- **`SubjectTile {s}`** (grid tile): WHITE, `borderRadius:16`, SHADOW, overflow hidden, column. **Header band:** `background:s.color`, `padding:9px 11px`, space-between → code (fontSize 9, fontWeight 800, color #fff, letterSpacing 0.04em) + grade badge (`background:rgba(255,255,255,0.28)`, color #fff, `borderRadius:6`, `padding:1px 6px`, fontSize 9, fontWeight 800). **Body:** `padding:9px 11px 11px` → name (fontSize 12, fontWeight 800, lineHeight 1.2, marginBottom 4, minHeight 29) + prof (fontSize 9.5, color DIM, fontWeight 600, marginBottom 6) + meta row (fontSize 9.5, color MED, fontWeight 700, gap 8): `attach_file`(11)+files, `{credits} cr` if present.
- **`SLabel`** (field label): fontSize 9, fontWeight 800, letterSpacing 0.12em, uppercase, color DIM, marginBottom 7.
- **`OptRow {icon,label,sub,active,right}`** (sort rows): `display:flex` gap 12, `padding:10px 6px`, `borderRadius:12`, `background: active?ACCL:transparent`. Icon fontSize 19 (color active?ACC:MED). label fontSize 13.5 (fontWeight active?800:600, color active?ACC:TEXT). sub fontSize 10.5, color DIM, fontWeight 600, marginTop 1. Trailing `right` or, if active, `✓` (fontSize 14, color ACC, fontWeight 800).
- **`BNav active={0}`** (bottom nav): absolute, bottom 8, left/right 10, height 56, WHITE, `borderRadius:20`, `boxShadow:0 4px 28px rgba(0,0,0,0.13)`, `padding:0 8px`. Visual order: Subjects(`menu_book`,i0) · Planner(`calendar_today`,i1) · Ada center(i4) · Timer(`timer`,i2) · Stats(`bar_chart`,i3). Active tab = pill 46×40, `borderRadius:14`, `background:INK`, icon #fff; inactive icon fontSize 24, color MED. **In all section-03 frames `active=0` (Subjects highlighted).**

## Flow-map edge kinds
`flow` = navigational push (new screen). `modal` = overlay/sheet/dialog/menu drawn over a dimmed parent. `cross` = cross-section jump. `loop` = back-loop. Subjects band is a bottom-nav core band; `subj-list` is the **Tab root (hub)** reached via the Subjects (`menu_book`) nav tab.

---

## subj-list — route (hub / Tab root) — Subjects list (Grid via Tweak)
Component `<SUBJECTS_LIST/>` (renders List by default; Grid when `SUBJ_LAYOUT==='Grid'` via Tweaks — the label "Grid via Tweak" refers to this toggle).

**Layout (top→bottom), inside `<Phone>`:**
1. Status bar (shared).
2. Content container: `padding:0 16px`, `height:452`, `overflow:hidden`.
3. **`SubjHeader`** (Share pill left; ···/+ pill right) — marginBottom 10.
4. **Title row** (`display:flex` align-baseline, space-between, marginBottom 12): left group (gap 7) = "Subjects" (SANS, fontSize 30, fontWeight 800, letterSpacing -0.5) + count "4" (`SUBJECTS.length`, fontSize 13, fontWeight 700, color DIM); right = "Spring '26" (fontSize 11, fontWeight 800, color MED).
5. **Ada nudge banner**: `display:flex` align-center, gap 9, `background:ACCL` (#edeafd), `borderRadius:14`, `padding:9px 12px`, marginBottom 12. Contents: `AdaBlob size={24} mood="focused"` (ice-cube avatar), text (flex 1, fontSize 10.5, color TEXT, lineHeight 1.4) "2 subjects are missing a syllabus — add files so I can plan better.", trailing "Add →" (fontSize 11, color ACC, fontWeight 800).
6. **Subject collection:**
   - **List mode (default):** `display:flex` column, gap 8 — renders `SUBJECTS.slice(0,3)` → 3 `SubjectRow`s (Compiler Construction, NLP, Computer Networks).
   - **Grid mode:** `display:grid`, `gridTemplateColumns:'1fr 1fr'`, gap 9 — renders all 4 `SubjectTile`s.
7. **`BNav active={0}`**.

**Transitions:** Reached from = entry point via Subjects bottom-nav tab (no explicit inbound edge; hub). Leads to → `subj-detail` (flow, "Open" — tap a row/tile) · `subj-add` (flow, "+ Subject" — the `+` in header) · `subj-menu` (modal, "···" — the ··· in header). (The Share pill on this header maps in-flow to `subj-share`, though the flow map attaches the Share edge to `subj-detail`.)

---

## subj-detail — route — Subject detail + files
Component `<SUBJECT_DETAIL/>` — renders `SUBJECTS[0]` (Compiler Construction, color ACC `#6b5cf0`).

**Layout (top→bottom):**
1. Status bar.
2. Content: `height:452`, `overflow:hidden`.
3. **Hero card** (colored gradient): `background: linear-gradient(180deg, {s.color} 0%, {s.color}b0 55%, {s.color}55 100%)`, `borderRadius:22`, `margin:6px 10px 0`, `padding:12px 14px 16px`, text `color:#fff`.
   - Top row (space-between, marginBottom 12): `arrow_back` icon (fontSize 20) | "Edit" group (fontSize 12, fontWeight 800, gap 4) with `edit` icon (fontSize 15).
   - Eyebrow: `CC 401 · 4 CREDITS` (fontSize 10, fontWeight 800, letterSpacing 0.06em, opacity 0.85, marginBottom 3). (Credits suffix omitted if `credits==null`.)
   - Title: "Compiler Construction" (SANS, fontSize 22, fontWeight 800, lineHeight 1.15, marginBottom 8).
   - Meta row (gap 10): `person_outline`(14)+ "Prof. S. Rao" (fontSize 11, fontWeight 600, opacity 0.92); Target badge `background:rgba(255,255,255,0.22)`, `borderRadius:7`, `padding:2px 8px`, fontSize 10, fontWeight 800, icon `track_changes`(11) + "Target A".
4. **Lower panel**: `padding:12px 16px`, `height:280`, overflow hidden.
   - **Stats row** (`display:flex`, gap 8, marginBottom 12), two equal cards (flex 1, WHITE, `borderRadius:14`, SHADOW, `padding:9px 11px`, flex align-center, gap 8):
     - Card A: `MoodBlob idx={s.mood=1}` size 26 + label block: "You feel" (fontSize 9, color DIM, fontWeight 700) over "Tired" (fontSize 11, fontWeight 800, color `MOODS[1].color=#9286d2`).
     - Card B: `timer` icon (fontSize 20, color s.color) + "This week" (fontSize 9, DIM, 700) over "4.5h focus" (fontSize 11, fontWeight 800).
   - **Materials header** (space-between, marginBottom 7): `SLabel` "Materials (3)"; right "Add file" (fontSize 10.5, fontWeight 800, color ACC) with `add` icon (13).
   - **Files list** (`display:flex` column, gap 6) — 3 rows, each: WHITE, `borderRadius:12`, SHADOW, `padding:8px 11px`, gap 10. Leading 30×30 rounded square (`borderRadius:9`, `background: c+"18"`) with icon (fontSize 16, color c). Then name (fontSize 11.5, fontWeight 700, ellipsis) over size (fontSize 9, color DIM, fontWeight 600). Trailing `more_vert` (fontSize 18, color DIM).
     - `picture_as_pdf` · "Course syllabus.pdf" · 420 KB · c `#e85476`
     - `slideshow` · "Lecture 1–9 slides.pdf" · 8.2 MB · c `#e8a430`
     - `description` · "My parsing notes.md" · 12 KB · c `#5cbbff`
5. **`BNav active={0}`**.

**Transitions:** Reached from ← `subj-list` (flow, "Open"). Leads to → `subj-file` (modal, "+ File" — Add file / Materials add) · `subj-share` (modal, "Share").

---

## subj-add — route/sheet — Add / edit subject (Letter target)
Component `<ADD_SUBJECT/>` = `<Phone bg={BG}><AddSubjectBody/></Phone>` (default `fmt="Letter"`). No BNav. Full-screen form on `BG`.

**Layout (top→bottom):**
1. Status bar.
2. Body wrapper: `height:492`, overflow hidden.
3. **Header card** (WHITE, `borderRadius:22`, `padding:12px 16px 13px`, `margin:4px 10px 8px`, `boxShadow:0 2px 10px rgba(0,0,0,0.05)`):
   - Top row (space-between, marginBottom 11): left 30×30 circle `background:BG` with `✕` (fontSize 13, fontWeight 700, color MED); center "New subject" (SANS, fontSize 16, fontWeight 800); right "Save" pill `background:INK`, `borderRadius:100`, `padding:6px 14px`, fontSize 12, fontWeight 700, color #fff.
   - Name input: `background:BG`, `borderRadius:12`, `padding:12px 14px`, fontSize 15, fontWeight 700, color TEXT — text "Compiler Construction" + blinking caret `|` (color ACC).
4. **Form fields** (`padding:0 16px`):
   - **Code + Credits row** (`display:flex` gap 8, marginBottom 9): each flex 1. Code = SLabel "Code" + box (WHITE, `borderRadius:12`, SHADOW, `padding:10px 12px`, fontSize 12.5, fontWeight 700) "CC 401". Credits = SLabel "Credits · optional" (·optional in DIM fontWeight 600) + box same style, content "Add" (color DIM) with right `＋` (color TEXT).
   - **Professor**: SLabel "Professor" + box (WHITE, `borderRadius:12`, SHADOW, `padding:10px 12px`, fontSize 12.5, fontWeight 700, marginBottom 9) "Prof. S. Rao".
   - **Target grade**: SLabel "Target grade". **Format selector** (`display:flex` gap 6, marginBottom 7): 3 equal segments ["Letter","GPA","%"], each `padding:6px 0`, `borderRadius:9`, fontSize 11, fontWeight 800, SHADOW; selected (`Letter`) `background:INK` color #fff, others WHITE color MED.
   - **Letter chips** (Letter mode only; `display:flex` gap 6, marginBottom 9): 5 equal chips ["A+","A","A−","B+","B"], each `padding:7px 0`, `borderRadius:9`, fontSize 12, fontWeight 800, `border:1.5px solid {selected?ACC:BORDER}`. Selected = index 1 ("A"): `background:ACCL`, color ACC, border ACC. Others WHITE/TEXT.
   - **Colour**: SLabel "Colour" + swatch row (`display:flex` gap 9, marginBottom 9) of 6 circles 26×26 `borderRadius:50%`: `[ACC #6b5cf0, #5cbbff, SUCC #2a9d6b, WARN #e8a430, #e85476, #c0497b]`. Selected = index 0: `border:2.5px solid TEXT` + `boxShadow:0 0 0 2px WHITE`; others `border:2.5px solid transparent`.
   - **Emotion**: SLabel "How do you feel about it?" + row (`display:flex` space-between, `padding:0 2px`) of 5 `MoodBlob`s (idx 0–4). Each wrapped in `padding:2.5`, `borderRadius:50%`; selected = index 1: `border:2px solid {MOODS[1].color}` + `background:{color}20`, blob size 32; others border transparent, size 29.

**Transitions:** Reached from ← `subj-list` (flow, "+ Subject"). Leads to → `subj-add-gpa` (modal, "GPA" — tap GPA segment) · `subj-add-pct` (modal, "%" — tap % segment).

---

## subj-add-gpa — state — Add subject, Target as GPA
Component `<ADD_SUBJECT_GPA/>` = `<AddSubjectBody fmt="GPA"/>`. **Same as subj-add** in every respect EXCEPT the Target-grade input region. State toggled by selecting the **"GPA"** segment in the format selector (so the GPA segment becomes `background:INK`/#fff, Letter reverts to WHITE/MED).

**GPA input block** (replaces Letter chips): WHITE, `borderRadius:12`, SHADOW, `border:1.5px solid ACC`, `padding:11px 14px`, marginBottom 9, `display:flex` align-baseline space-between:
- Left value "3.7" (fontSize 19, fontWeight 800, letterSpacing -0.5) + caret `|` (color ACC, fontWeight 400).
- Right hint "out of 4.0" (fontSize 12, fontWeight 700, color DIM).

**Transitions:** Reached from ← `subj-add` (modal, "GPA"). (Sibling state with `subj-add-pct`; returns to `subj-add` Letter via the Letter segment.)

---

## subj-add-pct — state — Add subject, Target as %
Component `<ADD_SUBJECT_PCT/>` = `<AddSubjectBody fmt="%"/>`. **Same as subj-add** except the Target-grade input. State toggled by selecting the **"%"** format segment.

**% input block** (replaces Letter chips): WHITE, `borderRadius:12`, SHADOW, `border:1.5px solid ACC`, `padding:11px 14px`, marginBottom 9, `display:flex` align-baseline space-between:
- Left value "85" (fontSize 19, fontWeight 800, letterSpacing -0.5) + "%" suffix (fontSize 14, color MED) + caret `|` (color ACC, fontWeight 400).
- Right hint "target %" (fontSize 12, fontWeight 700, color DIM).

**Transitions:** Reached from ← `subj-add` (modal, "%"). (Sibling state with `subj-add-gpa`.)

---

## subj-file — sheet — Add file to subject (GCS upload)
Component `<ADD_FILE_SHEET/>`. Bottom sheet over a dimmed subject context.

**Layers (back→front) inside `<Phone>`:**
1. Color wash: absolute fill, `background: SUBJECTS[0].color` (#6b5cf0), `opacity:0.3`, no pointer events.
2. Scrim: `position:absolute inset:0`, `background:rgba(20,15,28,0.3)`.
3. **Bottom sheet**: absolute bottom 0, full width, WHITE, `borderRadius:24px 24px 0 0`, `boxShadow:0 -10px 44px rgba(0,0,0,0.22)`, `padding:12px 18px 22px`.
   - Grab handle: 38×4, `borderRadius:2`, `background:#e0ddd7`, `margin:0 auto 16px`.
   - Title "Add to Compiler Construction" (SANS, fontSize 19, fontWeight 800, marginBottom 2).
   - Subtitle "Ada can read these to plan smarter" (fontSize 11.5, color MED, marginBottom 16).
   - **Source list** (`display:flex` column, gap 8, marginBottom 14) — 4 rows, each `background:BG`, `borderRadius:14`, `padding:11px 13px`, gap 12: leading 38×38 rounded square (`borderRadius:11`, `background: c+"1c"`) with icon (fontSize 19, color c); label (fontSize 12.5, fontWeight 800) over sub (fontSize 9.5, color DIM, fontWeight 600); trailing `chevron_right` (fontSize 18, color DIM):
     - `description` · "Syllabus" · "PDF or doc — Ada builds your plan from it" · c ACC `#6b5cf0`
     - `slideshow` · "Lecture slides" · "Decks and handouts" · c `#e8a430`
     - `edit_note` · "Notes" · "Your own notes & summaries" · c `#5cbbff`
     - `quiz` · "Past papers" · "Previous exams to practice" · c SUCC `#2a9d6b`
   - **Action buttons** (`display:flex` gap 8): two equal outline pills (flex 1, `border:1.5px solid BORDER`, `borderRadius:100`, `padding:11px 0`, centered, fontSize 12, fontWeight 800, gap 6): `folder_open`(16)+"Browse" · `document_scanner`(16)+"Scan".

**Transitions:** Reached from ← `subj-detail` (modal, "+ File"). Leads to → (terminal; picks a source → returns to subject detail with the uploaded file).

---

## subj-menu — menu — ··· semester menu
Component `<SUBJECT_MENU/>`. Popover anchored to the header `···`, over a dimmed Subjects list.

**Layout:**
1. Status bar.
2. Container `height:452`, `position:relative`, `padding:0 16px`.
3. **Dimmed background** (`opacity:0.35`, no pointer events): `SubjHeader` + title row ("Subjects" SANS fontSize 30 fontWeight 800 + count "4" fontSize 13 fontWeight 700 DIM, marginBottom 12) + one `SubjectRow s={SUBJECTS[0]}`.
4. **Popover** (`position:absolute`, top 44, right 12, width 224, WHITE, `borderRadius:20`, `boxShadow:0 14px 44px rgba(0,0,0,0.18)`, `padding:10px 0`, overflow hidden):
   - Section label "SEMESTER" (fontSize 9, fontWeight 800, letterSpacing 0.1em, color DIM, `padding:4px 18px 8px`).
   - Three semester rows (each `display:flex` gap 10, `padding:9px 18px`): leading `check` icon (fontSize 17, color = ACC if on else `transparent`) + name (fontSize 13.5): `["Spring '26" → on/checked, fontWeight 800, color TEXT]`, `["Fall '25" → off, fontWeight 600, color MED]`, `["Spring '25" → off]`.
   - Divider: `borderTop:1px solid BORDER`, `margin:6px 0`.
   - Three action rows (each `display:flex` gap 12, `padding:10px 18px`, icon fontSize 18 color TEXT, label fontSize 13.5 fontWeight 600): `add` "Add semester" · `edit_calendar` "Edit semesters" · `sort` "Sort subjects".
5. **`BNav active={0}`**.

**Transitions:** Reached from ← `subj-list` (modal, "···"). Leads to → `subj-add-sem` (modal, "Add semester" row) · `subj-edit-sem` (modal, "Edit semesters" row) · `subj-sort` (modal, "Sort subjects" row).

---

## Shared shell `SubjSheet` (used by subj-add-sem, subj-edit-sem, subj-sort)
Dimmed Subjects list behind a bottom sheet (matches Plan picker-sheet language).
- Container `height:492`, relative, overflow hidden.
- **Dimmed bg** (`opacity:0.3`, `padding:0 16px`): `SubjHeader` + title row ("Subjects" SANS 30/800 + count "4" 13/700 DIM, marginBottom 12) + `SubjectRow s={SUBJECTS[0]}` + `SubjectRow s={SUBJECTS[1]}`.
- **Scrim**: absolute inset 0, `rgba(20,15,28,0.30)`.
- **Sheet**: absolute bottom 0, full width, WHITE, `borderRadius:24px 24px 0 0`, `boxShadow:0 -8px 40px rgba(0,0,0,0.22)`, `padding:12px 18px 18px`.
  - Grab handle 38×4 `borderRadius:2` `#e0ddd7` `margin:0 auto 14px`.
  - Title row (space-between, `marginBottom: sub?3:14`): title (SANS, fontSize 20, fontWeight 800) | 26×26 circle `background:BG` with `✕` (fontSize 12, color MED).
  - Optional subtitle `sub` (fontSize 11.5, color MED, marginBottom 14).
  - Children (form body).
  - Optional `cta` button (marginTop 16, `background:INK`, `borderRadius:100`, `padding:13px 0`, centered, fontSize 13, fontWeight 800, color #fff).

---

## subj-add-sem — sheet/dialog — Add semester
Component `<SUBJECT_ADD_SEM/>` = `SubjSheet title="Add semester" cta="Create semester"` (no subtitle).

**Sheet body (top→bottom):**
1. SLabel "Name" + name input: `background:BG`, `borderRadius:12`, `padding:11px 14px`, fontSize 14, fontWeight 700, marginBottom 12 — text "Fall '26" + caret `|` (color ACC, fontWeight 400).
2. SLabel "Term" + segment row (`display:flex` gap 7, marginBottom 12): 3 equal segments, each `padding:9px 0`, `borderRadius:11`, fontSize 12.5, fontWeight 800. ["Spring" off, "Summer" off, "Fall" active]. Active: `background:ACCL`, color ACC, `border:1.5px solid ACC`. Inactive: `background:BG`, color MED, `border:1.5px solid transparent`.
3. Dates row (`display:flex` gap 10): each flex 1. "Starts": SLabel + box (`background:BG`, `borderRadius:12`, `padding:11px 14px`, fontSize 12.5, fontWeight 700, color TEXT) "1 Sep 2026". "Ends": same → "20 Dec 2026".
4. CTA "Create semester" (INK pill per `SubjSheet`).

**Transitions:** Reached from ← `subj-menu` (modal). Leads to → (terminal; "Create semester" returns to subjects list with the new term).

---

## subj-edit-sem — route/sheet — Edit semesters
Component `<SUBJECT_EDIT_SEM/>` = `SubjSheet title="Edit semesters" sub="Rename, reorder or remove a term"` (no cta).

**Sheet body** — `display:flex` column, gap 8:
- Three semester rows, each: `background:BG`, `borderRadius:14`, `padding:11px 14px`, gap 11. Leading `drag_indicator` (fontSize 18, color DIM). Middle: title (fontSize 13.5, fontWeight 800) + optional "Current" badge (fontSize 9.5, fontWeight 800, color ACC, `background:ACCL`, `borderRadius:100`, `padding:2px 7px`, marginLeft 7) over count (fontSize 10.5, color DIM, fontWeight 600, marginTop 1). Trailing `edit` (fontSize 17, color MED) + `delete_outline` (fontSize 17, color `#e85476`).
  - "Spring '26" · "4 subjects" · **Current** badge
  - "Fall '25" · "5 subjects"
  - "Spring '25" · "4 subjects"
- **Add-semester dashed button**: centered, gap 7, `border:1.5px dashed BORDER`, `borderRadius:14`, `padding:11px 0`, color ACC, fontSize 12.5, fontWeight 800, `add` icon (17) + "Add semester".

**Transitions:** Reached from ← `subj-menu` (modal). Leads to → (terminal; per-row edit/delete; dashed button conceptually opens `subj-add-sem`).

---

## subj-sort — menu/sheet — Sort subjects
Component `<SUBJECT_SORT/>` = `SubjSheet title="Sort subjects" sub="Choose how your subjects are ordered"` (no cta).

**Sheet body:**
1. Option list (`display:flex` column, gap 1) of 5 `OptRow`s (icon / label / sub):
   - `drag_indicator` "Manual order" "Drag to arrange" — **active** (background ACCL, ACC text, trailing ✓).
   - `sort_by_alpha` "Alphabetical" "A → Z".
   - `grade` "Grade" "Highest target first".
   - `workspace_premium` "Credits" "Most credits first".
   - `sentiment_satisfied` "Mood" "How you feel about each".
2. **Reverse order** toggle row (`display:flex` space-between, marginTop 12, `padding:0 6px`): label "Reverse order" (fontSize 12.5, fontWeight 700, color TEXT) + switch OFF: track 40×23, `borderRadius:100`, `background:BG`; knob 19×19 `borderRadius:50%`, WHITE, `boxShadow:0 1px 3px rgba(0,0,0,0.2)`, position top 2 left 2.

**Transitions:** Reached from ← `subj-menu` (modal). Leads to → (terminal; selecting an option re-sorts and returns to subjects list).

---

## subj-share — sheet — Share / referral sheet
Component `<TASK_SHARE/>` (reused referral/share sheet). **Note:** the dimmed background here is the legacy **Tasks** page shell (Today/This week/All tabs), not the Subjects list — a known shared-component reuse; the live screen would dim the Subjects/subject-detail context. Sheet content (the invite card) is the load-bearing part.

**Layers (back→front):**
1. **Dimmed bg** (absolute top 0, `padding:0 16px`, `opacity:0.3`): a header (Share pill left + ···/+ pill right, same styling as SubjHeader) + a 3-tab segmented control on `background:BG borderRadius:10 padding:2`: ["Today" active (WHITE, color TEXT), "This week", "All"] (fontSize 11, fontWeight 700, inactive color DIM, `borderRadius:8`).
2. **Scrim**: absolute inset 0, `rgba(20,15,28,0.28)`.
3. **Sheet** (absolute top 74, full width to bottom, WHITE, `borderRadius:24px 24px 0 0`, `boxShadow:0 -10px 44px rgba(0,0,0,0.22)`, `padding:10px 18px 24px`, flex column):
   - Grab handle 38×4 `#e0ddd7` `margin:0 auto 16px`.
   - Content block (flex 1, centered column):
     - **Invite hero card**: `borderRadius:20`, overflow hidden, `background: linear-gradient(135deg, ACC 0%, #b39df5 52%, #e9c8d8 100%)`, `padding:17px 18px`, centered, marginBottom 13, `boxShadow:0 8px 24px {ACC}3a`; inner inset ring `boxShadow:inset 0 0 0 1px rgba(255,255,255,0.4)`. Logo `assets/aqademiq-logo-new.png` 54×54 (drop-shadow). Wordmark "Aqademiq" (Plus Jakarta Sans, fontSize 22, fontWeight 800, color #fff, letterSpacing -0.5, marginTop 2). Subtext "Invite by Ridhwan Ahamed" (fontSize 11, fontWeight 700, color rgba(255,255,255,0.92), marginTop 4).
     - Heading "Help us grow!" (SANS / Plus Jakarta Sans, fontSize 19, fontWeight 800, centered, lineHeight 1.2, marginBottom 6).
     - Body "Share your code with friends and help us reach more students. It means the world to us 💜." (color MED, centered, lineHeight 1.5, marginBottom 14, `padding:0 6px`, fontSize 13).
     - Eyebrow "YOUR REFERRAL CODE" (fontSize 9, fontWeight 800, letterSpacing 0.12em, uppercase, color DIM, centered, marginBottom 9).
     - **Code boxes** (`display:flex` gap 7, centered, marginBottom 15): 5 cells `["A","D","A","4","2"]`, each 38×44, `borderRadius:11`, `background:BG`, MONO, fontSize 22, fontWeight 800, color TEXT, `boxShadow:inset 0 0 0 1px BORDER`.
     - **Share Invite button**: full width, `padding:13px 16px`, `borderRadius:100`, `background: linear-gradient(120deg, ACC, #9f8bef)`, color #fff, fontSize 14, fontWeight 700, centered, gap 9, `boxShadow:0 6px 20px {ACC}40`, `ios_share` icon (18) + "Share Invite".

**Transitions:** Reached from ← `subj-detail` (modal, "Share"). (In-app also reachable from the Subjects-list Share pill.) Leads to → (terminal; native share sheet / copy code).
