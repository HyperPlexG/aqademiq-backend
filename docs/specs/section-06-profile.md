# Section 06 — Profile

Source prototype: `prototypes/Aqademiq V1 Full Flow v5.html`
Flow map: `prototypes/Aqademiq User Flow - Comprehensive.html`

## Shared design tokens (resolved, default tweaks: accent `#6b5cf0`, warmth Warm, light mode)

| Token | Value |
|---|---|
| `ACC` (accent) | `#6b5cf0` |
| `ACCL` (accent light) | `#edeafd` |
| `BG` (page / paper) | `#f4f3f0` |
| `WHITE` | `#ffffff` |
| `TEXT` | `#111111` |
| `MED` (medium grey) | `#777777` |
| `DIM` (dim grey) | `#c0c0c0` |
| `BORDER` | `rgba(0,0,0,0.07)` |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` |
| `INK` | `#111111` |
| `WARN` | `#e8a430` |
| `FRAME_BG` (canvas behind phone) | `#dbd9d5` |
| `SANS` | `"Plus Jakarta Sans", system-ui, sans-serif` |
| `NUMSERIF` / `SERIF` | `"Playfair Display", Georgia, serif` |
| `MONO` | `"JetBrains Mono", "Courier New", monospace` |

### Phone shell (all three frames)
- Outer device: `width 262 · height 522 · borderRadius 34 · background BG (#f4f3f0) · overflow hidden · position relative · fontFamily SANS · color TEXT · fontSize 12`. Shadow `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
- Status bar: height 30, padded `0 18px`, flex space-between, fontSize 10 / fontWeight 700. Left `9:41`; center pill `36×12` `#111` radius 6; right `●▊` letterSpacing -1.
- Below status bar each Profile screen uses a scroll body: `padding '0 16px' · height 452 · overflow hidden`.

### Bottom nav `BNav active={3}` (shown on profile-top and profile-main; hidden behind scrim on referral)
- Absolute, `bottom 8 · left 10 · right 10 · height 56 · background WHITE · borderRadius 20 · shadow 0 4px 28px rgba(0,0,0,0.13) · padding 0 8px`, flex row space-between, items centered.
- Visual order L→R: `menu_book` (Subjects, idx0), `calendar_today` (Planner, idx1), center Ada face button (idx4), `timer` (idx2), `bar_chart` (Stats/Profile, idx3).
- `active={3}` ⇒ the `bar_chart` tab is active: pill `46×40 · borderRadius 14 · background INK (#111)`, icon material-icons-outlined `bar_chart` fontSize 24 color `#fff`. Inactive icon tabs: transparent bg, icon color MED (`#777777`).
- Center Ada button: `44×44` circle; inactive bg WHITE + `1.5px solid BORDER`; contains `AdaNavFace size={34}`.

### Card primitive
`background WHITE · borderRadius 16 · padding 12px 14px · boxShadow SHADOW` (overridable per use).

---

## profile-top — route (tab root / hub) — "Profile — top (streak & mood)"

Artboard `DCArtboard id="profile-top"` renders `<PROFILE_TOP_A />` (the "Identity-led A" variant; B and C exist in source but are NOT wired to any artboard). FRAMES.md kind: **route**. Flow map: `{hub:1}` = bottom-nav tab root for family `support` (segment 06, "Profile / Stats", accent `#e8a430`).

Body container: `padding '0 16px' · height 452 · overflow hidden`. Top-to-bottom:

1. **Header row** (`ProfileTopHead`) — flex, align center, space-between, `marginBottom 14`.
   - Left name pill: text "Ridhwan Ahamed". `background WHITE · borderRadius 100 · padding 6px 14px · boxShadow SHADOW · fontSize 12 · fontWeight 700`.
   - Right action cluster: flex, align center, `gap 2`, `background WHITE · borderRadius 100 · padding 4px 6px · boxShadow SHADOW`. Two `30×30` circular buttons, each centered, icon material-icons-outlined fontSize 16 color TEXT: `ios_share`, then `settings`.

2. **Identity / greeting row** — flex, align center, `gap 12`, `margin '2px 2px 14px'`.
   - `CubeSVG size={46} tone=CUBE_TONES[4] melt={0} expr="happy" cheeks sparkles` (vivid happy ice-cube: body `#cbbcfd`, border `#5a44f1`, ink `#31237c`; happy curved eyes, two-tone smile `#31237c`/`#e8607f` mouth, pink cheeks `#f0a0b6`@0.72, border-colored sparkles top-right). SVG viewBox 0 0 60 60.
   - Text block: title "Keep it frozen, Ridhwan" — fontSize 15 / fontWeight 800 / letterSpacing -0.2. Subtitle "3-day streak · Prism 3 days" — fontSize 10.5 / color MED / marginTop 2.

3. **Stats card** (split, two metrics) — `Card` override `display flex · padding 0 · marginBottom 8`. Two equal columns (`flex 1`), each `padding 12px 14px`; the second column has `borderLeft 1px solid BORDER`.
   - Column data: `['3','DAY STREAK','3/7 days',0.43]` and `['0','COMPLETED','0/1 tasks',0]`.
   - Inside each column: a baseline row (`display flex · align baseline · gap 6`) with value span `fontFamily NUMSERIF · fontSize 26 · fontWeight 800` and label span `fontSize 8.5 · fontWeight 800 · letterSpacing 0.1em · color DIM`.
   - Progress track: `height 4 · background BG · borderRadius 2 · margin '7px 0 4px'`; fill `width prog*100% (43% / 0%) · height 100% · background ACC · borderRadius 2`.
   - Sub-label: `fontSize 9 · color DIM` ("3/7 days" / "0/1 tasks").

4. **Mood card** — `Card` override `marginBottom 8`.
   - Eyebrow: text "MOOD & DAILY REFLECTIONS" — fontSize 10 / fontWeight 800 / letterSpacing 0.08em / color DIM / marginBottom 9.
   - `MoodWeekRow cube={24}`: flex row space-between of 7 day columns (`flex column · align center · gap 3`).
     - Data `MOOD_WEEK_DATA = [['M',3],['T',2],['W',null],['T',null],['F',null],['S',null],['S',null]]`; `MOOD_TODAY_I = 2` (the Wed slot is "today").
     - Each cube slot is a `(cube+4)×(cube+4)` = 28×28 centering box.
     - Logged days (idx not null) render `CubeSVG size=24 tone=CUBE_TONES[idx] melt=(4-idx)/4 expr=MOOD_EXPR[idx] bubbles=0`. `MOOD_EXPR = ['sad','meh','neutral','smile','happy']`. So Mon=idx3 (`smile`, melt 0.25, tone border `#6a5ce4`/body `#d2c5fa`), Tue=idx2 (`neutral`, melt 0.5, tone border `#7d70d9`/body `#dcd3f7`).
     - Null days render a placeholder `(cube-3)×(cube-3)`=21×21, `borderRadius 8`, `1.5px dashed` border. For the today slot (i===2) border color = ACC and it shows a centered `+` (fontSize 12 / color ACC / fontWeight 700 / lineHeight 1); other null slots border `#d8d4cc`, no `+`.
     - Day label under each: fontSize 9 / fontWeight 700 / color = (i===today ? ACC : DIM). Labels: M T W T F S S.

5. **Support links card** (`ProfileLinks`, default rows) — `Card`. Three rows: "Rate the app", "Share feedback", "FAQ". Each row: flex space-between align center, `padding 6px 0`; rows except the last have `borderBottom 1px solid BORDER`. Label fontSize 12; trailing chevron `›` color DIM.

6. **`BNav active={3}`** (see shared spec).

### CubeSVG melt/tone reference (for mood cubes)
- `CUBE_TONES` index → {border, body, ink}: 0 `#a79fc4/#eae8f2/#938eac`, 1 `#9286d2/#e4ddf3/#787299`, 2 `#7d70d9/#dcd3f7/#5c5499`, 3 `#6a5ce4/#d2c5fa/#41358f`, 4 `#5a44f1/#cbbcfd/#31237c`.
- melt 0 = crisp tall cube; melt 1 = pale melted puddle. Mood uses `melt=(4-idx)/4`.

### Transitions
- **INTO:** tab root — reached by tapping the Stats/Profile (`bar_chart`, idx3) tab on the bottom-nav rail from any core hub (plan-timeline, subj-list, fc-set, ada-empty). No explicit inbound edge in the flow map besides the nav rail.
- **OUT OF:** `['profile-top','profile-main','flow','Scroll']` → scrolling the page reveals profile-main (same route, scrolled). (profile-main carries the further Invite/Settings edges.)

---

## profile-main — state (same route, scrolled) — "Profile — bottom (hub)"

Artboard `DCArtboard id="profile-main"` renders `<PROFILE />`. FRAMES.md kind: **state** — same Profile route as profile-top, scrolled to the bottom. It is toggled on the parent by **scrolling the profile page down** (flow edge `profile-top → profile-main` label "Scroll").

Body container: `padding '0 16px' · height 452 · overflow hidden`. Top-to-bottom:

1. **Header row** — identical to profile-top header (name pill "Ridhwan Ahamed" + `ios_share`/`settings` cluster), `marginBottom 14`. Same exact styles.

2. **Support links card** — `Card` override `marginBottom 16`. FOUR rows (one more than profile-top): "Rate the app", "Share feedback", "FAQ", "Follow us on Instagram". Each row: flex space-between align center, `padding 8px 0` (note: 8px here vs 6px on profile-top); rows except last have `borderBottom 1px solid BORDER`. Label fontSize 12; trailing chevron `›` color DIM.

3. **Invite / brand hero card** (also the referral hero) — `position relative · borderRadius 20 · overflow hidden · padding 17px 18px · textAlign center`.
   - Background gradient: `linear-gradient(135deg, #6b5cf0 0%, #b39df5 52%, #e9c8d8 100%)`.
   - Card shadow: `0 8px 24px #6b5cf03a` (ACC at ~23% alpha).
   - Inset border overlay: absolute `inset 0 · borderRadius 20 · boxShadow inset 0 0 0 1px rgba(255,255,255,0.4) · pointerEvents none`.
   - Logo: `<img src="assets/aqademiq-logo-new.png">` `54×54 · objectFit contain · filter drop-shadow(0 2px 6px rgba(0,0,0,0.18))`.
   - Wordmark "Aqademiq": fontFamily `"Plus Jakarta Sans"` / fontSize 22 / fontWeight 800 / color #fff / letterSpacing -0.5 / marginTop 2.
   - Tagline "Your focus sanctuary.": fontSize 11 / fontWeight 700 / color rgba(255,255,255,0.92) / marginTop 4.

4. **`BNav active={3}`** (see shared spec).

### Transitions
- **INTO:** `['profile-top','profile-main','flow','Scroll']` — scroll down from profile-top (same route).
- **OUT OF:**
  - `['profile-main','referral','modal','Invite']` → tapping the invite hero card opens the **referral** sheet (modal). (Trigger: the invite/brand card; also conceptually the header `ios_share`.)
  - `['profile-main','settings-home','cross','Settings']` → tapping the header `settings` gear cross-navigates to Settings home (segment 13).

---

## referral — sheet (modal) — "Referral sheet (tap ↑)"

Artboard `DCArtboard id="referral"` renders `<REFERRAL />`. FRAMES.md kind: **sheet**. Flow map: opened as a `modal` from profile-main via "Invite". Description: "Invite-a-friend sheet (tap ↑)." Structure = dimmed profile underneath + scrim + bottom sheet.

1. **Dimmed profile background** — absolute `top 30 · left 0 · right 0 · bottom 0 · padding '0 16px' · opacity 0.32 · pointerEvents none`.
   - Header row (same name pill "Ridhwan Ahamed" + `ios_share`/`settings` cluster), `marginBottom 14`.
   - Below it: a `68×68` circle, `borderRadius 50% · background radial-gradient(circle at 38% 33%, #edeafd, #6b5cf0) · margin '0 auto'` (the Prism orb placeholder).

2. **Scrim** — absolute `inset 0 · background rgba(20,15,28,0.28)`.

3. **Sheet** — absolute `top 74 · left 0 · right 0 · bottom 0 · background WHITE · borderRadius '24px 24px 0 0' · boxShadow '0 -10px 44px rgba(0,0,0,0.22)' · padding '10px 18px 24px' · overflow hidden`, flex column.
   - **Grabber:** `width 38 · height 4 · borderRadius 2 · background #e0ddd7 · margin '0 auto 16px' · flexShrink 0`.
   - **Content wrapper:** `flex 1 · flex column · justifyContent center`.
   - **Gift / brand hero card** (identical styling to profile-main invite hero) — `position relative · borderRadius 20 · overflow hidden · padding 17px 18px · textAlign center · marginBottom 13 · boxShadow 0 8px 24px #6b5cf03a`. Gradient `linear-gradient(135deg, #6b5cf0 0%, #b39df5 52%, #e9c8d8 100%)`. Inset border overlay `inset 0 0 0 1px rgba(255,255,255,0.4)`.
     - Logo `assets/aqademiq-logo-new.png` `54×54 · objectFit contain · drop-shadow(0 2px 6px rgba(0,0,0,0.18))`.
     - Wordmark "Aqademiq": fontFamily `"Plus Jakarta Sans"` / fontSize 22 / fontWeight 800 / #fff / letterSpacing -0.5 / marginTop 2.
     - Subline "Invite by Ridhwan Ahamed": fontSize 11 / fontWeight 700 / color rgba(255,255,255,0.92) / marginTop 4.
   - **Headline "Help us grow!"** — fontFamily `"Plus Jakarta Sans"` / fontSize 19 / fontWeight 800 / textAlign center / lineHeight 1.2 / marginBottom 6.
   - **Body copy** "Share your code with friends and help us reach more students. It means the world to us 💜." — color MED / textAlign center / lineHeight 1.5 / marginBottom 14 / padding '0 6px' / fontSize 13.
   - **Code label "Your referral code"** — fontSize 9 / fontWeight 800 / letterSpacing 0.12em / textTransform uppercase / color DIM / textAlign center / marginBottom 9.
   - **Referral code cells** — flex row `gap 7 · justifyContent center · marginBottom 15`. Five cells for `A D A 4 2`, each: `width 38 · height 44 · borderRadius 11 · background BG (#f4f3f0)` centered, `fontFamily MONO · fontSize 22 · fontWeight 800 · color TEXT`, `boxShadow inset 0 0 0 1px BORDER`.
   - **Share button** — `width 100% · padding 13px 16px · borderRadius 100 · background linear-gradient(120deg, #6b5cf0, #9f8bef) · color #fff · fontSize 14 · fontWeight 700`, flex center `gap 9`, `boxShadow 0 6px 20px #6b5cf040 · cursor pointer`. Content: material-icons-outlined `ios_share` fontSize 18, then text "Share Invite".
   - No `BNav` (sheet covers it; nav lives in the dimmed-out background only by implication, not rendered here).

### Notes
- This referral sheet is visually identical in content to `TASK_SHARE` (`subj-share` artboard) — same gift hero, copy, code cells `A D A 4 2`, and Share button. They differ only in the dimmed background behind (profile vs. tasks page) and the hero subline ("Invite by Ridhwan Ahamed" in both). Same sheet geometry (`top 74`, radius `24px 24px 0 0`, shadow `0 -10px 44px rgba(0,0,0,0.22)`, padding `10px 18px 24px`).

### Transitions
- **INTO:** `['profile-main','referral','modal','Invite']` — modal presentation from profile-main (tap Invite hero / share). The label "(tap ↑)" / "(tap ↑)" denotes the upward share-sheet gesture.
- **OUT OF:** none in the flow map — terminal modal; dismiss (swipe down / scrim tap) returns to profile-main. The flow legend marks dead-end modals as "Terminal / returns via bottom nav."
