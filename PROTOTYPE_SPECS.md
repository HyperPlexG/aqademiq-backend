# PROTOTYPE_SPECS.md — pixel-exact values extracted from `Aqademiq V1 Full Flow v5.html`

> Machine-extracted from the v5 prototype (the **primary** source of truth, listed
> first in the handoff). Where the prototype and README §3/§4 disagree, **the
> prototype wins** (README §2: "Fidelity HIGH… match them"; FRAMES.md: a frame is
> done only when it matches the artboard). All README deviations are listed in
> §"Deviations from README" at the bottom. Generated during Phase A.

## Tokens — colors (light / dark)

| Semantic (Flutter) | Prototype name | Light | Dark |
|---|---|---|---|
| bg | BG | `#f4f3f0` | `#0e0e0e` |
| surface | WHITE | `#ffffff` | `#1b1b1b` |
| text | TEXT | `#111111` | `#efefef` |
| textMed | MED | `#777777` | `#888888` |
| textDim | DIM | `#c0c0c0` | `#505050` |
| border | BORDER | `rgba(0,0,0,0.07)` (`0x12000000`) | `rgba(255,255,255,0.07)` (`0x12FFFFFF`) |
| hilite | HILITE | `#eceae7` | `#33333a` |
| ink | INK | `#111111` | **= accent** |
| frameBg | FRAME_BG | `#dbd9d5` | `#161616` |
| success | SUCC | `#2a9d6b` | `#2a9d6b` |
| warn | WARN | `#e8a430` | `#e8a430` |
| danger | — | `#e85476` | `#e85476` |
| cardShadow | SHADOW | `0 2px 16px rgba(0,0,0,0.08)` | `0 2px 20px rgba(0,0,0,0.55)` |
| navShadow | (BNav) | `0 4px 28px rgba(0,0,0,0.13)` | (same) |

**Accents (3):** violet `#6b5cf0` (default) · pink `#e85476` · green `#2a9d6b`.
**accentSoft** is a lookup, not computed:
- violet → light `#edeafd`, dark `#2a2340`
- pink → light `#fde8ed`, dark `#3a1422`
- green → light `#e8fdf3`, dark `#0d2b1d`
- In dark mode, `ink = accent`.
- Inline accent tints use hex-alpha suffixes, e.g. active chip bg = `accent` @ `0x18` alpha.

## Tokens — fonts
- **SANS** `Plus Jakarta Sans` — ALL UI/body/headings (weights 400/500/600/700/800).
- **NUMSERIF / SERIF** `Playfair Display` — big display numerals ONLY (timer, stats).
- **MONO** `JetBrains Mono` — rare.

## Tokens — study tags (label → hex)
Lecture `#5cbbff` · Class `#6b5cf0` · Exam `#e85476` · Assignment `#2a9d6b` · Report `#e8a430` · Presentation `#c0497b` · Reading `#7a8699`.

## Tokens — radii / spacing / shadow / motion
- Radius: **card 16** (not 18), sheet-top 24, rows/inputs 14, small cell 12, tile 10, pills/buttons/chips 100, nav bar 20, phone 34, progress bar 3.
- Spacing base 4; screen side pad 16; card pad `12×14`; task row pad `11×13`; input pad `12×16`; PBtn pad `13×16`; chip pad `5×12`; tag-chip pad `5×11`; sheet pad `12px 18px 18-24px`.
- Standard border width **1.5px** (not 1px).
- Scrim: pickers `rgba(20,15,28,0.30)`, dialogs `0.40`, settings `0.42` (canonical max).
- Motion: UI transitions ~200ms; the ice-cube melt is `0.9s linear`.

## Shell — Phone + floating BottomNav
- Phone shell 262×522, radius 34, bg `bg`; status bar h30 (`9:41`, 36×12 notch). Screen body side-pad 16.
- **BottomNav**: floating, `bottom:8 left:10 right:10` → width 242, height 56, bg surface, radius **20**, shadow `0 4px 28px rgba(0,0,0,0.13)`, pad `0 8`, 5 equal slots.
- **Order (L→R) with stable semantic indices**: `menu_book`=Subjects(0) · `calendar_today`=Planner(1) · **Ada center(4)** · `timer`=Timer(2) · `bar_chart`=Stats(3). (Indices are non-sequential — preserve.)
- Standard tab: 46×40 box, radius 14; active = ink rounded-rect, icon 24 white; inactive icon `textMed`.
- Ada center: 44×44 circle; active bg ink, else surface + `1.5px border`; holds AdaNavFace 34. (Prototype does **not** raise it or give it its own shadow — see deviations.)
- Guest lock: dims Ada (opacity .55) + adds LockDot (14×14 `warn` circle, white `lock` 8px, 2px white border) on Ada(4) + Stats(3).

## Ada ice-cube mascot (`CubeSVG`) — CustomPainter
- viewBox `0 0 60 60`, overflow visible (sparkles/shadow draw outside — don't clip). Symmetry axis x=30.
- `melt` m∈0..1 linearly drives: tY `8+15m`, bY `50+2m`, tL `11+7m`, tR `49-7m`, bL `11-6m`, bR `49+6m`, rTop `9+3m`, rBot `9+13m`, sag `2.5m`.
- Body = rounded trapezoid (see workflow output for exact Q-bezier sequence). Outer fill `tone.body`, stroke `tone.border` width `3.4-1.2m`; inner sheen white opacity `0.32(1-0.5m)`; gloss streak; bubbles; drop-shadow ellipse `cx30 cy bY+3 rx16+4m ry3.2 tone.border @.16`.
- Face: faceCY `(tY+bY)/2+1`, eyeY `faceCY-2`, eyeR `2.7-0.5m`, eyeDX `6-1.2m`, mY `faceCY+5`.
- Expressions: happy(arc eyes + filled 2-piece mouth w/ pink `#e8607f` tongue), sad(diagonal eyes + frown), smile/neutral/focused/meh(dot eyes + CUBE_MOUTHS path).
- **CUBE_TONES** (0 palest→4 vivid) {border, body, ink}: 0 `#a79fc4/#eae8f2/#938eac` · 1 `#9286d2/#e4ddf3/#787299` · 2 `#7d70d9/#dcd3f7/#5c5499` · 3 `#6a5ce4/#d2c5fa/#41358f` · 4 `#5a44f1/#cbbcfd/#31237c`.
- AdaNavFace = radial-gradient circle (`#cbbcfd→#b7a6f5→#6b5cf0`, inset shadow `0 -2px 5px rgba(40,25,90,.18)`) + 40-viewBox face (ink `#31237c`).

## Focus timer ring (`FocusRing`) — CustomPainter
- size 168, center (84,84), TRACK_R 58, stroke 10. Track `accentSoft`; progress arc `accent`, round cap, clockwise from 12 o'clock (`-π/2`), sweep `pct·2π`, end knob r7 `accent`.
- 60 ticks at radius 69; major (i%15==0) length 9 width 2, minor length 5 width 1; on `i/60<pct` `accent` else `#dedede`.
- Quarter labels 15/30/45/60 at cardinals, SANS 9 / w700 / `textDim`.
- Center: numeral Playfair 46 / w800 / lineHeight1 / ls -2 / `text`; under it `MINS` SANS 9 / w800 / ls .14em / `textMed`.

## PLAN_TIMELINE (default home)
- Header (`marginBottom 10`): left = day "Wednesday" SANS 15/w800/ls-0.3 + month "JUN 2026" 9.5/w800/`textMed`/ls.04em + `chevron_right` 11 (calendar button). Right = action capsule (surface pill, radius100, pad `4×6`, cardShadow) holding `···` (30×30, 17/w800) + `add` (30×30 circle, icon 21). "Today" pill only when not viewing today.
- Date strip (`marginBottom 10`): 7 cells, each w34, pad `5×0`, radius14; selected bg `hilite`; date number top (10/w700; today-unselected `accent` else `textDim`); weekday letter (19/w800; selected `text`, today `accent`, else `textDim`); selected underline 14×3 `#c4c1bb`. **No mood blob here.**
- Section header = **CollapseHead** (light `hilite` pill, radius100, pad `6px 13px 6px 7px` w/icon, gap7): leading `schedule` 15 `textMed`, label "ANYTIME (3)" 11.5/w800/ls.05em/`text`, trailing chevron 18 (`expand_more`/`expand_less`). (Distinct from the ink SectionPill component.)
- Task row = **PlanTask** card: surface, radius **16**, cardShadow, pad `11×13`, gap11, alignItems stretch; optional left bar w4 radius4 = tag color; title 13/w800/lh1.25; meta row gap8 (inline tag = 6px dot + colored text 9.5/w800 — NOT the bordered TagChip; duration 10.5/w600 `textDim`); done circle 22×22 border2 (`#d6d3ce` idle / `accent` done, ✓ white 11/w800). dim opacity .5.
- TimeLabel (planned rows) 11/w800/`text`, margin `10px 0 7px`.
- No FAB; add lives in header capsule.

## §4 widget library (consolidated)
- **PrimaryButton (PBtn)**: full-width, pad `13×16` (NOT 13×40), radius100, SANS 14/w800/ls.01em; filled bg `ink`/white text; ghost bg surface + `1.5px border`/`text`.
- **Chip**: pad `5×12`, radius100, 11/w600, `1.5px` border; active border `color||accent`, bg `color@0x18||accentSoft`, text `color||accent`; inactive border `border`, bg surface, text `textMed`.
- **AppCard (Card)**: surface, radius **16**, pad `12×14`, cardShadow.
- **TagChip**: pad `5×11`, radius100, gap6, 11/w600, `1.5px` solid/dashed; 7×7 dot = color (solid only); active bg `color@0x18`, text `color`; inactive text `textMed`.
- **AppToggle (Toggle)**: track 46×27 radius100 pad3; on `accent` / off `textDim`; knob 21×21 white circle, shadow `0 1px 3px rgba(0,0,0,.25)`; 200ms.
- **SettingsRow (SetRow)**: pad `12×15`, gap11, bottom border `1px border` (except last); order avatar→icon(20)→label(13.5/w600)+sub(11 `textMed`)+value(12.5 `textMed` right ellipsis)→pill(TimePill `hilite` 12/w700)→toggle→chevron(19 `textDim`). Long toggle-row labels wrap to 2 lines (no value). Wrapped in **SetGroup** (surface, radius **18**, cardShadow, clip) under **GroupLabel** (12.5/w700 `textMed`).
- **AppBottomSheet**: panel bottom-anchored, top radius 24, drag handle 38×4 radius2 `#e0ddd7`; title SANS 20/w800; close ✕ in 26×26 `bg` circle; over dimmed real screen + scrim (pickers .30 / settings .42); shadow panel `0 -12px 48px rgba(20,15,28,.28)` / picker `0 -8px 40px rgba(0,0,0,.22)`; CTA = ink pill `13px 0` 13/w800 white.
- **AppDialog (CenterDialog)**: centered, width ~226, radius 24, pad `17px 18px 18px`, shadow `0 20px 64px rgba(0,0,0,.34)`, scrim .40; title 19/w800; CTA ink pill `12px 0`.
- **SectionPill**: centered ink pill, radius100, pad `5×12`, gap6, mb10; icon 12 `white@.5`; label 10/w800/ls.1em/uppercase white `{label} ({count})`; caret `▾` `white@.4` 12.
- **MoodBlob**: CubeSVG with idx 0..4 → scale `0.72+idx*0.07`, melt `(4-idx)/4`, expr `[sad,meh,neutral,smile,happy]`, bubbles `[0,1,1,2,3]`, cheeks/sparkles only idx4, sweat only idx1. MOODS: 0 Rough · 1 Tired · 2 OK · 3 Good · 4 Great.

## Deviations from README (prototype wins)
1. **Card radius 16**, not 18 (README §3/§4). `SetGroup` is 18.
2. **PrimaryButton padding `13×16`**, not `13×40`.
3. **TagChip border 1.5px**, not 1px. The in-task tag is borderless (dot + colored text).
4. **Study-tag "Reading" `#7a8699`**, not `#9aa3b2`.
5. **Ada center nav button is NOT raised** and has no own shadow in the prototype (README §4 asks for raised + shadow). We follow the prototype.
6. Plan timeline section headers use the light **CollapseHead** pill, not the ink **SectionPill**.
7. Scrim is not a single value: pickers .30, dialog .40, settings .42.
8. Dark-mode `ink = accent` (README states this correctly).
9. Several literals absent from README §3: `frameBg`, nav shadow `0 4px 28px rgba(0,0,0,.13)`, selected-day underline `#c4c1bb`, idle done-circle `#d6d3ce`, drag handle `#e0ddd7`, off-tick `#dedede`.
