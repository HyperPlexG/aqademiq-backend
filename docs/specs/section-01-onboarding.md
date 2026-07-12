# Section 01 — Onboarding (build spec)

Source prototype: `prototypes/Aqademiq V1 Full Flow v5.html`
Flow map: `prototypes/Aqademiq User Flow - Comprehensive.html`
Default theme (resolved from `TWEAK_DEFAULTS`: accent `#6b5cf0`, warmth `Warm`, light mode).

## Shared tokens (light mode, Warm warmth) — used by every frame below
- `ACC` (accent) = `#6b5cf0`
- `ACCL` (accent light bg) = `#edeafd`
- `BG` (page/field bg) = `#f4f3f0`
- `WHITE` = `#ffffff`
- `TEXT` = `#111111`
- `INK` = `#111111` (primary-button bg, dark pills)
- `MED` (secondary text) = `#777777`
- `DIM` (faint text/labels) = `#c0c0c0`
- `BORDER` = `rgba(0,0,0,0.07)`
- `SHADOW` = `0 2px 16px rgba(0,0,0,0.08)`
- `SUCC` = `#2a9d6b`, `WARN` = `#e8a430`
- `SANS` = `"Plus Jakarta Sans", system-ui, sans-serif` (all UI text)
- `MOODS` (5-step, idx 0→4): `0 Rough #a79fc4` · `1 Tired #9286d2` · `2 OK #7d70d9` · `3 Good #6a5ce4` · `4 Great #5a44f1`

## Shared primitives (reuse across all onboarding frames)
- **Phone shell** (`Phone`): width 262 × height 522, `borderRadius: 34`, bg `WHITE` for all onboarding frames (passed `bg={WHITE}`), `overflow: hidden`, `position: relative`, fontFamily SANS, color TEXT, base fontSize 12, boxShadow `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
  - Status bar: height 30, flex space-between, padding `0 18px`, fontSize 10, fontWeight 700 → left `9:41`; center notch pill 36×12 bg `#111` radius 6; right `●▊` letterSpacing -1.
  - Content area below status bar: a div with `padding: '4px 22px 0'` and `height: 492` (except `adaload`, see that frame).
- **Dots** (step indicator): flex row, `gap: 5`, `marginBottom: 20`. Each segment height 4, radius 2. Active segment: width 22, bg `ACC` `#6b5cf0`. Inactive: width 6, bg `#e0e0e0`. Onboarding uses `total={7}`.
- **SLabel** (section label): fontSize 9, fontWeight 800, letterSpacing `0.12em`, textTransform uppercase, color `DIM` `#c0c0c0`, marginBottom 7.
- **PBtn** (primary CTA button): width 100%, padding `13px 16px`, bg `INK` `#111111`, no border, borderRadius 100, color `#fff`, fontSize 14, fontWeight 800, letterSpacing `0.01em`. (Ghost variant: bg WHITE, `1.5px solid BORDER`, color TEXT — not used in onboarding.)
- **Chip**: padding `5px 12px`, borderRadius 100, fontSize 11, fontWeight 600, whiteSpace nowrap. Inactive: border `1.5px solid BORDER`, bg WHITE, color `MED`. Active (no custom color): border `1.5px solid ACC`, bg `ACCL`, color `ACC`.
- **Card**: bg WHITE, borderRadius 16, padding `12px 14px`, boxShadow `SHADOW`. Onboarding "Ada hint" cards override bg→`ACCL` and boxShadow→`none`.
- **AdaBlob** (mascot): `<CubeSVG>` ice-cube avatar; props `size` (px) and `mood` (expression: `happy`, `focused`). Render as a rounded purple ice-cube blob mascot of the given size.
- **Big screen titles**: fontFamily SANS, fontSize 26, fontWeight 800, lineHeight 1.2. Subtitles: fontSize 12, color `MED`.

**Onboarding step→Dots index map** (all `total=7`): ob-referral=0, ob1=1, ob2=2 (and ob2-add=2), ob-mood=3, ob3=4, ob4=5, ob5=6. (adaload has no Dots.) Note: there are 7 dots but step 7 = adaload is a loader without a Dots bar.

**Flow-map edge legend:** `flow` = primary forward navigation (push) · `modal` = opens an overlay/dialog (present over current) · `cross` = jump/loop between journeys (cross-section). Onboarding has NO explicit back edges in the map; provide a standard back affordance per platform.

---

## ob-referral — route — Referral code (optional)

Artboard: `<DCArtboard id="ob-referral">` → `<OB_REFERRAL/>` (component lines 621–641). Phone bg WHITE; content div `padding: '4px 22px 0'`, height 492.

Top-to-bottom layout:
1. **Dots** total 7, active 0.
2. **Title** `Got a referral<br/>code?` — fontSize 26, fontWeight 800, lineHeight 1.2, marginBottom 20. (Two lines, explicit break.)
3. **SLabel** `Referral code`.
4. **OTP-style code boxes** — flex row, `gap: 7`, marginBottom 16. 5 boxes, each `flex: 1`, `aspectRatio: '1'` (square), borderRadius 12, fontFamily `"Plus Jakarta Sans", sans-serif`, fontSize 20, fontWeight 800, color TEXT, centered. Prefilled values `['A','D','A','','']`:
   - Filled box (has char): bg `ACCL` `#edeafd`, border `2px solid #6b5cf055` (ACC at 55 alpha hex).
   - Box index 3 (the active/cursor slot): border `2px solid ACC` `#6b5cf0`; shows a blinking caret = a 2px-wide × 20px-tall bar bg `ACC`.
   - Empty box (index 4): bg `BG` `#f4f3f0`, border `2px solid BORDER` `rgba(0,0,0,0.07)`.
5. **Ada hint Card** — Card override: bg `ACCL`, boxShadow none, display flex, gap 10, alignItems flex-start, marginBottom 22. Contains: `AdaBlob size=28 mood="happy"` + text span fontSize 11, color TEXT, lineHeight 1.6: "A friend invited you? Pop in their code and you both earn Aqademiq Pro perks."
6. **PBtn** `Continue →`.
7. **"I don't have one"** skip link — textAlign center, fontSize 11.5, color `MED`, fontWeight 600, marginTop 12, cursor pointer.

Transitions:
- **INTO:** `otp → ob-referral` (`cross`, label "Verified"); `guest-ada → ob-referral` (`cross`, label "Set up").
- **OUT OF:** `ob-referral → ob1` (`flow`) — both "Continue →" and "I don't have one" advance to ob1.

---

## ob1 — route — Step 1: Name

Artboard: `<DCArtboard id="ob1">` → `<OB1/>` (lines 644–658). Phone bg WHITE; content `padding: '4px 22px 0'`, height 492.

Top-to-bottom:
1. **Dots** total 7, active 1.
2. **Title** `What should we<br/>call you?` — 26/800/1.2, marginBottom 4.
3. **Subtitle** `First name is fine` — fontSize 12, color MED, marginBottom 20.
4. **Name input field** (filled state) — bg `BG` `#f4f3f0`, borderRadius 14, padding `13px 16px`, fontSize 18, fontWeight 700, marginBottom 6, border `2px solid ACC` `#6b5cf0`. Content: `Ridhwan` + caret span (a `|` at opacity 0.35).
5. **Helper text** `Ada uses this in sessions and check-ins` — fontSize 11, color `DIM` `#c0c0c0`, marginBottom 20.
6. **Ada hint Card** — bg ACCL, boxShadow none, flex, gap 10, alignItems flex-start, marginBottom 24. `AdaBlob size=28 mood="happy"` + span fontSize 11, color TEXT, lineHeight 1.6: "Hi, I'm Ada — your focus companion. I'll learn how you work and help you build your week accordingly."
7. **PBtn** `Continue →`.

Transitions:
- **INTO:** `ob-referral → ob1` (`flow`).
- **OUT OF:** `ob1 → ob2` (`flow`, via Continue).

---

## ob2 — route — Step 2: What you study

Artboard: `<DCArtboard id="ob2">` → `<OB2/>` (lines 661–678). Phone bg WHITE; content `padding: '4px 22px 0'`, height 492.

Top-to-bottom:
1. **Dots** total 7, active 2.
2. **Title** `What are you<br/>studying?` — 26/800/1.2, marginBottom 4.
3. **Subtitle** `Ada shapes your plan around your workload` — fontSize 12, color MED, marginBottom 16.
4. **SLabel** `Level`.
5. **Level chips** — flex wrap, gap 6, marginBottom 14: `Undergraduate` (active) · `Postgraduate` · `School` · `Self-taught`. (Active = ACC border + ACCL bg + ACC text; others default Chip.)
6. **SLabel** `Subjects`.
7. **Subject chips** — flex wrap, gap 6, marginBottom 24: `Engineering` (active) · `CS` (active) · `Medicine` · `Business` · `Law`, followed by a **"+ More" pseudo-chip**: span padding `5px 12px`, borderRadius 100, fontSize 11, fontWeight 600, border `1.5px dashed #6b5cf088` (ACC at 88 alpha), color `ACC`, cursor pointer.
8. **PBtn** `Continue →`.

Transitions:
- **INTO:** `ob1 → ob2` (`flow`).
- **OUT OF:** `ob2 → ob2-add` (`modal`, label "Add") — tapping the "+ More" chip; `ob2 → ob-mood` (`flow`, via Continue).

---

## ob2-add — dialog — Step 2: Add subject popup

Artboard: `<DCArtboard id="ob2-add">` → `<OB2_ADD_SUBJECT/>` (lines 683–702). Modal sheet over a dimmed ob2. Reached from the "+ More" chip.

Layout (three stacked layers inside the Phone):
1. **Dimmed background = ob2 content** — same div as ob2 but `opacity: 0.26`, `pointerEvents: 'none'`. Contains Dots(7, active 2), the same title/subtitle, Level chips (same 4, Undergraduate active, marginBottom 14), SLabel Subjects, and subject chips `Engineering`(active) `CS`(active) `Medicine` `Business` (note: NO "Law", NO "+ More", and no bottom marginBottom on this row, no Continue button — it is just a faded backdrop).
2. **Scrim** — `position: absolute; inset: 0; background: rgba(20,15,28,0.34)`.
3. **Bottom sheet** — `position: absolute; left:0; right:0; top: 30; bottom: 0`, bg `BG` `#f4f3f0`, borderRadius `24px 24px 0 0`, boxShadow `0 -10px 44px rgba(0,0,0,0.28)`, overflow hidden. Sheet starts 30px from the top of the phone (just under status bar). Contains **`<AddSubjectBody/>`** (the shared subject form, lines 1666–1728):

   AddSubjectBody (default `fmt='Letter'`), wrapper height 492, overflow hidden:
   - **Header card** — bg WHITE, borderRadius 22, padding `12px 16px 13px`, margin `4px 10px 8px`, boxShadow `0 2px 10px rgba(0,0,0,0.05)`.
     - Top row (flex space-between, marginBottom 11): close button = 30×30 circle, bg `BG`, centered `✕` fontSize 13 fontWeight 700 color MED · center title `New subject` fontSize 16 fontWeight 800 SANS · `Save` pill = bg `INK` `#111`, radius 100, padding `6px 14px`, fontSize 12, fontWeight 700, color #fff.
     - Name field: bg `BG`, borderRadius 12, padding `12px 14px`, fontSize 15, fontWeight 700, color TEXT, text `Compiler Construction` + caret `|` in color ACC.
   - **Body** (`padding: '0 16px'`):
     - **Code + Credits row** (flex, gap 8, marginBottom 9): each `flex:1`.
       - Code: SLabel `Code` + field bg WHITE radius 12 boxShadow SHADOW padding `10px 12px` fontSize 12.5 fontWeight 700 → `CC 401`.
       - Credits: SLabel `Credits · optional` (the "· optional" suffix color DIM fontWeight 600) + field same style, flex space-between, color DIM → `Add` + `＋` (the `＋` colored TEXT).
     - **SLabel** `Professor` + field bg WHITE radius 12 boxShadow SHADOW padding `10px 12px` fontSize 12.5 fontWeight 700 marginBottom 9 → `Prof. S. Rao`.
     - **SLabel** `Target grade`. Format selector row (flex gap 6 marginBottom 7): 3 equal segments `Letter` / `GPA` / `%`, each flex:1, textAlign center, padding `6px 0`, borderRadius 9, fontSize 11, fontWeight 800, boxShadow SHADOW. Selected (`Letter`): bg `INK` color #fff. Others: bg WHITE color MED.
     - **Letter grade row** (since fmt=Letter): flex gap 6 marginBottom 9, 5 cells `A+` `A` `A−` `B+` `B`, each flex:1 textAlign center padding `7px 0` borderRadius 9 fontSize 12 fontWeight 800. Selected cell = index 1 (`A`): bg `ACCL` color ACC border `1.5px solid ACC`. Others: bg WHITE color TEXT border `1.5px solid BORDER`.
     - **SLabel** `Colour`. Color swatches row (flex gap 9 marginBottom 9): circles 26×26, colors `[ACC #6b5cf0, #5cbbff, SUCC #2a9d6b, WARN #e8a430, #e85476, #c0497b]`. Selected = index 0 (ACC): border `2.5px solid TEXT` + boxShadow `0 0 0 2px WHITE`. Others: border `2.5px solid transparent`.
     - **SLabel** `How do you feel about it?`. Mood row (flex space-between, padding `0 2px`): 5 MoodBlobs idx 0→4. Each wrapped in a circle pad; selected = index 1: padding 2.5, border `2px solid MOODS[1].color #9286d2`, bg `#9286d220`, MoodBlob size 32. Unselected: border 2px transparent, MoodBlob size 29.

Transitions:
- **INTO:** `ob2 → ob2-add` (`modal`, label "Add").
- **OUT OF:** No explicit edge in the flow map. Save/✕ dismiss the sheet back to `ob2`.

---

## ob-mood — route — Step 3: Feelings per subject

Artboard: `<DCArtboard id="ob-mood">` → `<OB_MOOD/>` (lines 711–748). Data: `SUBJECT_MOODS = [{subject:'Engineering', pre:2}, {subject:'Computer Science', pre:4}]`. Phone bg WHITE; content `padding: '4px 22px 0'`, height 492.

Top-to-bottom:
1. **Dots** total 7, active 3.
2. **Title** `How do you feel<br/>about each?` — 26/800/1.2, marginBottom 14.
3. **Subject mood cards** — flex column, gap 8, marginBottom 10. One Card per subject (Card override padding `9px 14px`):
   - Header row (flex space-between, marginBottom 6): subject name fontSize 13 fontWeight 700 + current mood label fontSize 10 fontWeight 700 color `MOODS[pre].color`. (Engineering pre=2 → label "OK" color `#7d70d9`; Computer Science pre=4 → label "Great" color `#5a44f1`.)
   - Mood scale row (flex space-between, alignItems flex-end): 5 MoodBlobs (idx 0→4). Each in a column (gap 4). Active blob (i === pre): wrapper padding 3, borderRadius 50%, border `2px solid MOODS[i].color`, bg `MOODS[i].color + '1c'`; inactive: border `2px solid transparent`, transparent bg. MoodBlob size 26.
   - Endpoint labels row (flex space-between, marginTop 5, padding `0 2px`): `Dread it` (left) · `Love it` (right), each fontSize 8.5, color DIM.
4. **Ada hint Card** — bg ACCL, boxShadow none, padding `10px 12px`, flex, gap 9, alignItems flex-start, marginBottom 12. `AdaBlob size=24 mood="happy"` + span fontSize 11, color TEXT, lineHeight 1.5: "I'll schedule the subjects you dread in shorter, gentler sessions — and pair them with Prism focus audio."
5. **PBtn** `Continue →`.

Transitions:
- **INTO:** `ob2 → ob-mood` (`flow`).
- **OUT OF:** `ob-mood → ob3` (`flow`).

---

## ob3 — route — Step 4: Upload syllabus

Artboard: `<DCArtboard id="ob3">` → `<OB3/>` (lines 751–769). (GCS upload + async parse downstream.) Phone bg WHITE; content `padding: '4px 22px 0'`, height 492.

Top-to-bottom:
1. **Dots** total 7, active 4.
2. **Title** `Let Ada plan<br/>your week` — 26/800/1.2, marginBottom 4.
3. **Subtitle** `Upload your syllabus, notes, or reading list` — fontSize 12, color MED, marginBottom 14.
4. **Dropzone** — border `1.5px dashed #6b5cf066` (ACC at 66 alpha), borderRadius 20, padding `26px 16px`, textAlign center, bg `ACCL` `#edeafd`, marginBottom 12, cursor pointer:
   - Up-arrow glyph `↑` fontSize 26, color ACC, marginBottom 8, fontWeight 700.
   - `Tap to upload` fontSize 13, fontWeight 700, color ACC, marginBottom 4.
   - `PDF, photo, or paste a link` fontSize 11, color MED.
5. **"What Ada does with it" Card** — Card override boxShadow none, bg `BG` `#f4f3f0`, marginBottom 14:
   - Title `What Ada does with it` fontSize 11 fontWeight 700 marginBottom 5.
   - Body fontSize 11 color MED lineHeight 1.65: "Reads your deadlines → breaks work into sessions → maps them across your week. You just show up."
6. **PBtn** `Upload materials` (override marginBottom 9).
7. **Skip link** `Skip — I'll add tasks manually →` — textAlign center, fontSize 11, color MED, cursor pointer.

Transitions:
- **INTO:** `ob-mood → ob3` (`flow`).
- **OUT OF:** `ob3 → ob4` (`flow`) — both "Upload materials" and "Skip…" advance to ob4.

---

## ob4 — route — Step 5: Peak time + goal

Artboard: `<DCArtboard id="ob4">` → `<OB4/>` (lines 772–797). Phone bg WHITE; content `padding: '4px 22px 0'`, height 492.

Top-to-bottom:
1. **Dots** total 7, active 5.
2. **Title** `When do you<br/>work best?` — 26/800/1.2, marginBottom 4.
3. **Subtitle** `Ada schedules your hardest tasks at your peak` — fontSize 12, color MED, marginBottom 18.
4. **Peak-time chips** — flex wrap, gap 6, marginBottom 20: `Early bird` · `Afternoon` (active) · `Evening` · `Night owl` · `Flexible`.
5. **SLabel** `Daily focus goal`.
6. **Slider Card** (default Card, marginBottom 24):
   - Top row (flex space-between, marginBottom 10): label `Target per day` fontSize 12 color MED + value `3 hrs` fontFamily `"Plus Jakarta Sans"` fontSize 16 fontWeight 800 color ACC.
   - Track: position relative, height 5, bg `BG`, borderRadius 3. Fill: width `38%`, height 100%, bg ACC, borderRadius 3. Thumb: position absolute left `38%`, top 50%, translate(-50%,-50%), 18×18 circle, bg WHITE, boxShadow `0 2px 8px rgba(0,0,0,0.25)`, border `2px solid ACC`.
   - Scale labels row (flex space-between, marginTop 5): `1 hr` (left) · `8 hrs` (right), fontSize 9, color DIM.
7. **PBtn** `Continue →`.

Transitions:
- **INTO:** `ob3 → ob4` (`flow`).
- **OUT OF:** `ob4 → ob5` (`flow`).

---

## ob5 — route — Step 6: Meet Prism

Artboard: `<DCArtboard id="ob5">` → `<OB5/>` (lines 800–819). Phone bg WHITE; content `padding: '4px 22px 0'`, height 492.

Top-to-bottom:
1. **Dots** total 7, active 6.
2. **Title** `Meet Prism` (single line) — fontSize 26, fontWeight 800, marginBottom 4 (note: no lineHeight override here).
3. **Subtitle** `Psychoacoustic audio that deepens focus. Auto-plays in sessions.` — fontSize 12, color MED, marginBottom 22.
4. **SLabel** `Prism modes`.
5. **Mode cards** — flex column, gap 9, marginBottom 24. Four Cards (Card override: display flex, alignItems center, gap 11, padding `11px 13px`). Each: a 30×30 left icon tile (borderRadius 10, bg `color + '18'`, border `1.5px solid color44`, centered, flexShrink 0) containing `<PrismGlyph color={color}/>`; then a text block — name fontSize 12 fontWeight 700 marginBottom 1, desc fontSize 10 color MED. Rows:
   - `ACC` `#6b5cf0` — **Deep Work** — "Low-freq focus carrier. Hard cognitive tasks."
   - `SUCC` `#2a9d6b` — **Flow** — "Smooth ambient. Sustained concentration."
   - `WARN` `#e8a430` — **Review** — "Steady midtempo. Reading, flashcards, revision."
   - `MED` `#777777` — **Wind-down** — "Slow, calming. End-of-session decompression."
   - **PrismGlyph**: 22×22 svg (viewBox 0 0 24 24): outer circle cx12 cy12 r9 stroke=color strokeWidth 1.6 no fill; plus 5 vertical bars at x = 6,9,12,15,18 with heights 4,7,10,7,4 (centered on y=12), stroke=color strokeWidth 1.6 round caps (an equalizer inside a ring).
6. **PBtn** `Let's go →`.

Transitions:
- **INTO:** `ob4 → ob5` (`flow`).
- **OUT OF:** `ob5 → adaload` (`flow`).

---

## adaload — route — Ada building your week (loading/transition)

Artboard: `<DCArtboard id="adaload">` → `<ADA_LOAD/>` (lines 822–840). Loading/transition screen (no Dots). Phone bg WHITE.

Container: a single div, height 492, display flex, flexDirection column, alignItems center, justifyContent center, textAlign center, padding `0 28px` (vertically centered content).

Top-to-bottom (centered):
1. **AdaBlob** `size=76 mood="focused"` (large mascot, focused expression).
2. **Title** `Ada's getting ready` — fontFamily `"Plus Jakarta Sans"`, fontWeight 800, fontSize 20, marginTop 18, marginBottom 6.
3. **Subtitle** `Building your first plan...` — fontSize 12, color MED, marginBottom 30.
4. **Checklist** — flex column, gap 14, textAlign left, width 200. Three rows `[done, label]`:
   - `[true, 'Reading your materials']`
   - `[true, 'Mapping your deadlines']`
   - `[false, 'Building your week']`
   Each row: flex, alignItems center, gap 10.
   - Status circle 22×22, borderRadius 50%, flexShrink 0:
     - **Done:** bg `ACC` `#6b5cf0`, no border, centered `✓` fontSize 10 color `#fff` fontWeight 800.
     - **Not done (in-progress):** bg transparent, border `1.5px solid DIM` `#c0c0c0`; contains a spinner = 10×10 circle, border `2px solid ACC` with `borderTopColor: transparent` (animate as a rotating spinner).
   - Label text: fontSize 12. Done → color `DIM`, fontWeight 400, `textDecoration: line-through`. Not done → color `TEXT`, fontWeight 700, no line-through.

Behavior: this is an automatic loading/transition screen — once Ada finishes building the week it auto-advances into the app (no button).

Transitions:
- **INTO:** `ob5 → adaload` (`flow`).
- **OUT OF:** `adaload → plan-timeline` (`cross`, label "Enter app") — auto-advance into the Plan/Home tab root once loading completes.
