# Section 07 — Mood Check-in

Two full-screen routes that morph the "Ada" ice-cube blob mascot to match a 5-step mood scale. Source artboards live in `Aqademiq V1 Full Flow v5.html` under `<DCSection id="checkin" title="07 — Mood Check-in" subtitle="Ada blob morphs per mood · morning + evening">`. Both render inside the standard `<Phone>` shell with `bg={WHITE}`.

## Shared tokens & primitives (resolved for default theme: accent `#6b5cf0`, warmth Warm, light mode)

Color tokens (all hex literal after resolving `applyTweaks(TWEAK_DEFAULTS)`):
- `WHITE` = `#ffffff` (screen bg for both frames)
- `BG` = `#f4f3f0` (warm-neutral fill; used for slider track empty segments, note field, empty week dots)
- `TEXT` = `#111111`
- `DIM` = `#c0c0c0` (secondary/placeholder/label text)
- `MED` = `#777777`
- `BORDER` = `rgba(0,0,0,0.07)`
- `INK` = `#111111` (primary button fill)
- `ACCL` = `#edeafd` (accent-light; used as morning Ada tip-card bg)
- `SHADOW` = `0 2px 16px rgba(0,0,0,0.08)` (Card default; morning tip-card overrides to `none`)
- Accent `ACC` = `#6b5cf0`

Fonts:
- `SANS` = `"Plus Jakarta Sans", system-ui, sans-serif` (all text here)

`MOODS` ramp (index 0→4, "paling-periwinkle"; drives labels, ring borders, slider fill, selected text color):
| idx | label | color |
|-----|-------|-------|
| 0 | Rough | `#a79fc4` |
| 1 | Tired | `#9286d2` |
| 2 | OK    | `#7d70d9` |
| 3 | Good  | `#6a5ce4` |
| 4 | Great | `#5a44f1` |

`MOOD_EXPR` (cube face per idx) = `['sad','meh','neutral','smile','happy']`
`MOOD_BUBBLES` (white bubble count per idx) = `[0,1,1,2,3]`
`CUBE_TONES` (cube border / body / ink per idx):
| idx | border | body | ink |
|-----|--------|------|-----|
| 0 | `#a79fc4` | `#eae8f2` | `#938eac` |
| 1 | `#9286d2` | `#e4ddf3` | `#787299` |
| 2 | `#7d70d9` | `#dcd3f7` | `#5c5499` |
| 3 | `#6a5ce4` | `#d2c5fa` | `#41358f` |
| 4 | `#5a44f1` | `#cbbcfd` | `#31237c` |

**`MoodBlob({ idx=2, size=80 })`** — outer flex box `size × size`, centered. Renders `CubeSVG` at `size × scale` where `scale = 0.72 + idx*0.07` (worse mood = physically smaller cube). Props passed: `tone=CUBE_TONES[idx]`, `melt=(4-idx)/4` (worst idx 0 = fully melted puddle, best idx 4 = crisp), `expr=MOOD_EXPR[idx]`, `bubbles=MOOD_BUBBLES[idx]`, `cheeks=(idx===4)`, `sparkles=(idx===4)`, `sweat=(idx===1)`. The cube is a rounded ice-block SVG (viewBox `0 0 60 60`); as `melt`→1 the top narrows/sinks, base spreads, stroke thins (`3.4-1.2*melt`), a ground-shadow ellipse widens. Eyes: `happy`=upward arcs, `sad`=down-slanted lines, else=filled dots. `happy` mouth = filled smile + inner tongue `#e8607f`; idx 4 also gets pink cheeks `#f0a0b6` @0.72 + accent sparkles; idx 1 gets a blue sweat drop `#8fd0ef`/`#6bb8e0`.

**`AdaBlob({ size=24, mood='happy' })`** — fixed crisp vivid cube: `CubeSVG size tone=CUBE_TONES[4] melt=0 expr=mood bubbles=3`. Used only in morning tip-card.

**`Card({ children, style })`** — `<div>` `background:WHITE`, `borderRadius:16`, `padding:'12px 14px'`, `boxShadow:SHADOW`, then spread `style`.

**`SLabel({ children })`** — `<div>` `fontSize:9`, `fontWeight:800`, `letterSpacing:'0.12em'`, `textTransform:uppercase`, `color:DIM`, `marginBottom:7`.

**`PBtn({ children })`** (primary CTA) — full-width `<button>`: `padding:'13px 16px'`, `background:INK` (`#111111`), `border:none`, `borderRadius:100`, `color:#fff`, `fontSize:14`, `fontWeight:800`, `letterSpacing:'0.01em'`, font `SANS`.

**`Phone` shell** — `width:262`, `height:522`, `borderRadius:34`, `background:WHITE` (override), `overflow:hidden`, font `SANS`, `color:TEXT`, `fontSize:12`, `boxShadow:'0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)'`. Status bar: 30px tall row, `padding:'0 18px'`, `fontSize:10`, `fontWeight:700`: left `9:41`; center pill `36×12` `#111` radius 6; right `●▊` `letterSpacing:-1`.

> Note on `kind`: FRAMES.md lists both as **route/sheet**. Flow map `nodes` has neither in a `modals:[]` array (their section's modals list is empty), so they render as full-screen states, not overlays. The User Flow doc describes them as "time / system triggered" (no in-app tap surfaces them) — surface morning at day start, evening at day end.

---

## mood-morning — route/sheet (full-screen) — Morning check-in

Component: `<MOOD_CHECKIN />`. `<Phone bg={WHITE}>` wrapping a single content column.

### Layout (top → bottom)
Outer content `<div>`: `height:492`, `display:flex`, `flexDirection:column`, `alignItems:center`, `padding:'10px 22px 0'`.

1. **Skip row** — full-width `<div>` `display:flex`, `justifyContent:flex-end`, `marginBottom:8`.
   - `Skip` text: `fontSize:11`, `color:DIM` (`#c0c0c0`), `fontWeight:600`.
2. **Title** — `<div>` font `SANS`, `fontSize:26`, `fontWeight:800`, `lineHeight:1.2`, `textAlign:center`, `marginBottom:4`. Text: `Morning` `<br/>` `check-in` (two lines).
3. **Subtitle** — `<div>` `fontSize:12`, `color:DIM`, `marginBottom:14`. Text: `How are you feeling today?`
4. **Hero blob** — `<MoodBlob idx={3} size={84} />` (the "Good" cube; melt `0.25`, smile face, 2 bubbles, scale `0.93` → cube ≈ 78px).
5. **Selected mood label** — `<div>` `fontSize:13`, `fontWeight:800`, `color:MOODS[3].color` (`#6a5ce4`), `marginTop:6`, `marginBottom:14`. Text: `Good`.
6. **Mood slider** — wrapper `<div>` `width:100%`, `padding:'0 22px 22px'`, `marginBottom:6`, `position:relative`. Inner row `display:flex`, `alignItems:center`. For each of 5 `MOODS` (`sel = i===3`, `filled = i<=3`):
   - Connector bar (rendered for `i>0`, i.e. 4 bars): `flex:1`, `height:4`, `borderRadius:2`, `background = filled ? MOODS[3].color (#6a5ce4) : BG (#f4f3f0)`, `opacity = filled ? 0.45 : 1`. (Bars left of/at the selected node are accent @45%; bars after are BG @100%.)
   - Dot node: `position:relative`, `flexShrink:0`, centered flex.
     - Outer circle: size `sel ? 34 : 24` square, `borderRadius:50%`. Selected: `background = mood.color + '22'` (12.5% alpha), `border:2.5px solid mood.color`, `boxShadow:'0 2px 8px ' + mood.color + '40'`. Unselected: `background:WHITE`, `border:2px solid BORDER`, `boxShadow:none`.
     - Inner dot: size `sel ? 13 : 8` square, `borderRadius:50%`, `background:mood.color`, `opacity = sel ? 1 : 0.45`.
     - Label `<span>`: absolute `top:100%`, `left:50%`, `transform:translateX(-50%)`, `marginTop:7`, `fontSize:8.5`, `fontWeight:700`, `whiteSpace:nowrap`, `color = sel ? mood.color : DIM`. Text = `mood.label` (Rough/Tired/OK/Good/Great). Node 3 ("Good") is the selected state shown.
7. **Ada tip card** — `<Card style={{ width:'100%', background:ACCL (#edeafd), boxShadow:'none', marginBottom:14 }}>`. Inner `<div>` `display:flex`, `gap:8`, `alignItems:flex-start`:
   - `<AdaBlob size={24} mood="happy" />` (crisp vivid happy cube, 24px).
   - `<span>` `fontSize:11`, `color:TEXT` (`#111111`), `lineHeight:1.6`. Text: `Nice! On "Good" days you average 2.4 hrs of deep focus. I've scheduled your hardest task for 2 PM.`
8. **Primary CTA** — `<PBtn>Set today's intention →</PBtn>` (full-width, `#111` pill, white 14px/800 text). Bottom-most element.

### Transitions
- **IN:** No explicit in-edge in the flow map (system/time-triggered at start of day). FRAMES.md kind route/sheet → present at app open in the morning.
- **OUT:** `['mood-morning', 'plan-timeline', 'cross', 'Start day']` — kind **cross** (jump/loop between journeys; rendered as a 2px line @ stroke-opacity 0.5). Label **"Start day"** → `plan-timeline` (the Timeline home hub). The CTA `Set today's intention →` drives this transition.

---

## mood-evening — route/sheet (full-screen) — Evening reflection

Component: `<MOOD_EVENING />`. `<Phone bg={WHITE}>` wrapping a single content column. Note: this column is **left-aligned** (no `alignItems:center`, unlike morning).

### Layout (top → bottom)
Outer content `<div>`: `height:492`, `display:flex`, `flexDirection:column`, `padding:'10px 22px 0'`.

1. **Header row** — full-width `<div>` `display:flex`, `alignItems:center`, `justifyContent:space-between`, `marginBottom:8`.
   - Date `<span>` (left): `fontSize:10`, `fontWeight:800`, `letterSpacing:'0.1em'`, `color:DIM`. Text: `MON · 18 MAY`.
   - `Skip` `<span>` (right): `fontSize:11`, `color:DIM`, `fontWeight:600`.
2. **Title** — `<div>` font `SANS`, `fontSize:26`, `fontWeight:800`, `lineHeight:1.2`, `marginBottom:4` (left-aligned). Text: `Evening` `<br/>` `reflection`.
3. **Subtitle** — `<div>` `fontSize:12`, `color:DIM`, `marginBottom:18`. Text: `How did today go?`
4. **Mood picker row** — `<div>` `display:flex`, `justifyContent:space-between`, `marginBottom:22`, `padding:'0 2px'`. Five entries (idx 0→4), each a column `display:flex`, `flexDirection:column`, `alignItems:center`, `gap:6`:
   - Ring wrapper `<div>` `padding:3`, `borderRadius:50%`. Selected (`i===3`): `border:2px solid mood.color` (`#6a5ce4`), `background = mood.color + '14'` (≈8% alpha). Others: `border:2px solid transparent`, `background:transparent`.
     - `<MoodBlob idx={i} size={ i===3 ? 34 : 31 } />` — each cube morphs to its own mood (idx 0 melted/sad → idx 4 crisp/sparkly). Selected one is slightly larger (34 vs 31).
   - Label `<span>`: `fontSize:8.5`, `fontWeight:700`, `color = i===3 ? mood.color : DIM`. Text = `mood.label`. Pre-selected state = **Good** (idx 3).
5. **Optional note label** — `<SLabel>Optional note</SLabel>` (9px/800, uppercase, `letterSpacing:0.12em`, color DIM, `marginBottom:7`).
6. **Note field** — `<div>` `background:BG` (`#f4f3f0`), `borderRadius:14`, `padding:'12px 14px'`, `fontSize:12`, `color:DIM`, `marginBottom:14`, `minHeight:70`. Placeholder text: `What made today that way?`
7. **Week mood card** — `<Card style={{ marginBottom:18 }}>` (WHITE bg, radius 16, padding 12/14, SHADOW).
   - Heading `<div>` font `SANS`, `fontSize:13`, `fontWeight:700`, `marginBottom:8`. Text: `This week's mood`.
   - Week row `<div>` `display:flex`, `justifyContent:space-between`. 7 days, data `[2, 3, 1, 4, 3, null, null]` mapped over labels `MTWTFSS` (i.e. M=idx2/OK, T=idx3/Good, W=idx1/Tired, T=idx4/Great, F=idx3/Good, S=empty, S=empty). Each day column: `display:flex`, `flexDirection:column`, `alignItems:center`, `gap:4`:
     - Slot `<div>` `width:24`, `height:24`, centered flex. If logged: `<MoodBlob idx={idx} size={24} />`. If `null`: empty placeholder `<div>` `width:22`, `height:22`, `borderRadius:50%`, `background:BG`.
     - Day letter `<span>`: `fontSize:9`, `color:DIM`. Text = `'MTWTFSS'[i]`.
8. **Primary CTA** — `<PBtn>Save reflection →</PBtn>` (full-width `#111` pill, white 14/800). Bottom-most element.

### Transitions
- **IN:** `['plan-timeline', 'mood-evening', 'cross', 'End of day']` — kind **cross** (jump/loop; 2px line @ opacity 0.5). Label **"End of day"** — surfaced from the `plan-timeline` Timeline hub at end of day (time/system triggered).
- **OUT:** No explicit out-edge in the flow map. The CTA `Save reflection →` saves and dismisses (implicitly returns to `plan-timeline`); no separate transition node is defined.
