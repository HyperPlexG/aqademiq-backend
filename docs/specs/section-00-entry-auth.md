# Section 00 — Entry & Auth — Build Spec

Pixel-exact spec extracted from `prototypes/Aqademiq V1 Full Flow v5.html`. All five frames are **route** screens. Transitions cross-checked against `prototypes/Aqademiq User Flow - Comprehensive.html` (note: flow-map node ids `signup`/`otp` correspond to artboard ids `auth-signup`/`auth-otp`).

## Shared tokens & primitives (resolved values, light mode / default accent #6b5cf0)

Default tweaks: accent `#6b5cf0`, warmth `Warm`, darkMode `false`.

| Token | Value | Notes |
|---|---|---|
| `WHITE` | `#ffffff` | card / phone bg |
| `BG` | `#f4f3f0` | warm app bg; also used as input field fill |
| `TEXT` | `#111111` | primary text |
| `INK` | `#111111` | primary button fill (= TEXT in light mode) |
| `MED` | `#777777` | secondary text |
| `DIM` | `#c0c0c0` | tertiary / muted, uppercase labels |
| `BORDER` | `rgba(0,0,0,0.07)` | hairline borders / unfocused input border |
| `ACC` | `#6b5cf0` | accent (focused input border, links, OTP cursor) |
| `ACCL` | `#edeafd` | accent-light fill (filled OTP cells) |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` | card shadow |
| `SUCC` / `WARN` | `#2a9d6b` / `#e8a430` | not used in this section |
| `SANS` | `"Plus Jakarta Sans", system-ui, sans-serif` | all UI text |

**Phone frame** (`<Phone>`): width `262`, height `522`, borderRadius `34`, bg passed per-screen (all five pass `WHITE`), overflow hidden, fontFamily SANS, color TEXT, base fontSize `12`, boxShadow `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
- **Status bar** (top of every Phone): height `30`, padding `0 18px`, flex space-between, fontSize `10`, fontWeight `700`. Left: `9:41` (color TEXT). Center: pill 36×12, bg `#111`, radius `6`. Right: `●▊` (color TEXT, letterSpacing `-1`).
- The screen content area below the status bar is a single child div with `height: 492`.

**PBtn (primary button)** `<PBtn>`: width 100%, padding `13px 16px`, bg `INK` (`#111111`), border none, borderRadius `100`, color `#fff`, fontSize `14`, fontWeight `800`, letterSpacing `0.01em`, fontFamily SANS.
- **Ghost variant** (`ghost` prop): bg `WHITE` (`#fff`), border `1.5px solid BORDER`, color `TEXT`.

**SLabel (field label)** `<SLabel>`: fontSize `9`, fontWeight `800`, letterSpacing `0.12em`, textTransform uppercase, color `DIM` (`#c0c0c0`), marginBottom `7`.

**Card** `<Card>`: bg WHITE, borderRadius `16`, padding `12px 14px`, boxShadow SHADOW.

Material icons used: `visibility_off`, `arrow_back` (Material Icons Outlined font).

---

## splash — route — Splash (auto-advances to Welcome)

**Kind:** route. Brand splash; auto-advances to Welcome (timer-driven, no user input).

**Layout (top→bottom), content div: `height: 492`, flex column, alignItems center, justifyContent center, position relative:**
1. **Logo** — `assets/aqademiq-logo-new.png`, width `150`, height `150`, objectFit contain.
2. **Wordmark** — text `Aqademiq`. fontFamily `"Plus Jakarta Sans"`, fontSize `34`, fontWeight `800`, letterSpacing `-1`, marginTop `20`, marginBottom `6`, color TEXT (#111).
3. **Tagline** — text `Your focus sanctuary.` fontSize `12`, color `DIM` (#c0c0c0), letterSpacing `0.07em`.
4. **Progress dots** — absolutely positioned: bottom `30`, left/right `0`, flex justify center, gap `6`. Three dots, each `6×6`, borderRadius 50%. Dot 0 (active): bg `ACC` (#6b5cf0), opacity `1`. Dots 1 & 2: bg `DIM` (#c0c0c0), opacity `0.4`.

**Transitions:**
- INTO: app launch (first screen).
- OUT: `splash → welcome` — auto/`flow` (auto-advances; no label).

---

## welcome — route — Welcome (Jump in / Sign up / Sign in fork)

**Kind:** route. The fork: Jump in as guest, Sign up, or Sign in. (Flow-map marks this a hub.)

**Layout, content div: `height: 492`, flex column, alignItems center, padding `0 22px`, position relative:**
1. **Top spacer block** — `flex: 1`, flex column, center/center, textAlign center, containing:
   - **Logo** — `assets/aqademiq-logo-new.png`, width `124`, height `124`, objectFit contain.
   - **Heading** — `Welcome to` / `Aqademiq` (two lines via `<br/>`). fontFamily `"Plus Jakarta Sans"`, fontSize `27`, fontWeight `800`, letterSpacing `-0.5`, lineHeight `1.2`, marginTop `18`, marginBottom `8`, color TEXT.
2. **Bottom action block** — width 100%, paddingBottom `18`:
   - **PBtn (solid)** — label `Sign in / Sign up`, marginBottom `9`. (INK bg, radius 100, fontSize 14, weight 800.)
   - **PBtn ghost** — label `Jump right in!`, marginBottom `12`. (white bg, 1.5px BORDER, TEXT color.)
   - **Disclaimer** — `Jumping in as a guest? Your progress saves the moment you create an account.` textAlign center, fontSize `10.5`, color `MED` (#777), lineHeight `1.5`, padding `0 8px`.

**Transitions:**
- INTO: `splash → welcome` (flow).
- OUT (3 forks):
  - `welcome → auth` — `flow`, label **"Sign in"**.
  - `welcome → signup` (auth-signup) — `flow`, label **"Sign up"**.
  - `welcome → guest-home` — `cross`, label **"Jump in"**.
  - (UI note: the single `Sign in / Sign up` PBtn leads to the auth fork; `Jump right in!` ghost button is the guest path.)

---

## auth — route — Sign in (password)

**Kind:** route. Returning users sign in with email + password. Includes SSO (Apple/Google).

**Layout, content div: padding `10px 22px 0`, `height: 492`:**
1. **Title** — `Welcome.` fontFamily SANS, fontSize `30`, fontWeight `800`, marginBottom `4`, color TEXT.
2. **Subtitle** — `Sign in to continue` fontSize `12`, color `MED` (#777), marginBottom `22`.
3. **SSO buttons** (`<SSOButtons>`): flex column, gap `10`, marginBottom `18`:
   - **Apple** — bg `#000`, borderRadius `100`, height `44`, flex center, gap `8`. Apple logo svg size `17` color `#fff` + label `Sign in with Apple` (fontFamily `-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif`, fontSize `15`, fontWeight `600`, color `#fff`).
   - **Google** — bg `#fff`, borderRadius `100`, height `44`, flex center, gap `10`, border `1.5px solid #747775`. Google color logo svg size `18` + label `Sign in with Google` (fontFamily `"Roboto", arial, sans-serif`, fontSize `14`, fontWeight `500`, color `#1f1f1f`).
4. **Divider row** — flex center, gap `10`, marginBottom `16`: line (`flex:1`, height `1`, bg BORDER) · text `or email` (fontSize `11`, color DIM) · line (same).
5. **SLabel** `Email`.
6. **Email field** (filled/display) — bg `BG` (#f4f3f0), borderRadius `14`, padding `12px 16px`, fontSize `13`, color TEXT, marginBottom `12`, border `1.5px solid BORDER`. Value: `ridhwan@bits.ac.in`.
7. **SLabel** `Password`.
8. **Password field (focused)** — bg BG, borderRadius `14`, padding `12px 16px`, flex align center, marginBottom `8`, **border `1.5px solid ACC` (#6b5cf0)**. Contains: masked dots `••••••••` (`flex:1`, fontSize `15`, fontWeight `700`, letterSpacing `3`, color TEXT) + `visibility_off` icon (fontSize `17`, color MED).
9. **Forgot password** — `Forgot password?` fontSize `11.5`, fontWeight `700`, color `ACC` (#6b5cf0), textAlign right, marginBottom `14`.
10. **PBtn** — label `Sign in →`, marginBottom `14`.
11. **Footer** — `New here? ` (fontSize `11.5`, color MED, textAlign center) + inline `Create an account` (fontWeight `700`, color TEXT). The inline span is the link to signup.

**Transitions:**
- INTO: `welcome → auth` (flow, "Sign in").
- OUT:
  - `auth → plan-timeline` — `cross`, label **"Returning"** (successful sign-in lands on the real Plan/Timeline home).
  - `Create an account` link → `auth-signup` (implied UI link; flow map routes new accounts via `welcome → signup`).

---

## auth-signup — route — Create an account

**Kind:** route. New account by email + password + confirm; then sends a verification code → OTP.

**Layout, content div: padding `10px 22px 0`, `height: 492`:**
1. **Back button** — 32×32 circle, borderRadius 50%, bg `BG` (#f4f3f0), flex center, marginBottom `16`. Contains `arrow_back` icon (fontSize `18`, color TEXT).
2. **Title** — `Create account` fontFamily SANS, fontSize `28`, fontWeight `800`, marginBottom `4`.
3. **Subtitle** — `Save your streak, grades & plan` fontSize `12`, color MED, marginBottom `22`.
4. **SLabel** `Email`.
5. **Email field (focused)** — bg BG, radius `14`, padding `12px 16px`, fontSize `13`, color TEXT, marginBottom `14`, **border `1.5px solid ACC`**. Value `ridhwan@bits.ac.in`.
6. **SLabel** `Password`.
7. **Password field (unfocused)** — bg BG, radius `14`, padding `12px 16px`, flex center, marginBottom `14`, border `1.5px solid BORDER`. Masked `••••••••` (fontSize 15, weight 700, letterSpacing 3, color TEXT) + `visibility_off` icon (fontSize 17, color MED).
8. **SLabel** `Confirm password`.
9. **Confirm password field** — identical styling to password field but **marginBottom `22`**, border `1.5px solid BORDER`. Masked `••••••••` + `visibility_off`.
10. **PBtn** — label `Create account →`, marginBottom `14`.
11. **Footer** — `Already have an account? ` (fontSize `11.5`, color MED, center) + inline `Sign in` (fontWeight `700`, color TEXT) → links back to auth.

**Transitions:**
- INTO: `welcome → signup` (flow, "Sign up"); also `guest-save → signup` (cross, "Save") and via auth's "Create an account" link.
- OUT: `signup → otp` (auth-otp) — `flow` (no label). Back button → previous (welcome). `Sign in` link → auth.

---

## auth-otp — route — OTP verification

**Kind:** route. Enter the 6-digit code to confirm the email.

**Layout, content div: padding `10px 22px 0`, `height: 492`:**
1. **Back button** — 32×32 circle, borderRadius 50%, bg BG, flex center, **marginBottom `20`**. `arrow_back` icon (fontSize 18, color TEXT).
2. **Title** — `Verify it's you` fontFamily SANS, fontSize `28`, fontWeight `800`, marginBottom `6`.
3. **Subtitle** — `We sent a 6-digit code to` + `<br/>` + `ridhwan@bits.ac.in` (the email span: fontWeight `700`, color TEXT). Container fontSize `12.5`, color MED, lineHeight `1.6`, marginBottom `28`.
4. **OTP cells row** — flex, gap `8`, marginBottom `24`. Six cells, values `['4','1','9','','','']`. Each cell: `flex:1`, `aspectRatio '1'` (square), borderRadius `14`, flex center, fontFamily `"Plus Jakarta Sans", sans-serif`, fontSize `22`, fontWeight `800`, color TEXT.
   - **Filled cell** (has digit): bg `ACCL` (#edeafd), border `2px solid ACC + '55'` = `#6b5cf055` (~33% alpha accent). Renders the digit.
   - **Active/focused cell** (index 3, empty): bg `BG` (#f4f3f0), border `2px solid ACC` (#6b5cf0 full). Renders a blinking cursor: a 2px-wide, 22px-tall bar, bg `ACC`.
   - **Empty cells** (index 4,5): bg `BG`, border `2px solid BORDER`, no content.
5. **PBtn** — label `Verify →`, marginBottom `16`.
6. **Resend footer** — `Didn't get a code? ` (fontSize `11.5`, color MED, textAlign center, lineHeight `1.7`) + inline `Resend in 0:24` (fontWeight `700`, color `ACC` #6b5cf0). Countdown text; resend disabled until 0:00.

**Transitions:**
- INTO: `signup → otp` (flow).
- OUT: `otp → ob-referral` — `cross`, label **"Verified"** (successful verification enters onboarding at the referral step). Back button → signup.
