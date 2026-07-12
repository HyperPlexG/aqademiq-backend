# Section 05 — Ada AI

Family `ada`, segment `05`, **core** flow. Three frames: `ada-empty` (intro/empty state), `ada-chat` (active conversation), `ada-history` (chat-history slide-over).

## Shared foundations (apply to all three frames)

### Palette (light theme — default)
| Token | Value |
|---|---|
| `WHITE` | `#ffffff` |
| `BG` | `#f4f3f0` (warm-default; `#f5f5f5` Neutral, `#f0f3f7` Cool) |
| `ACC` (accent) | `#6b5cf0` |
| `ACCL` (accent light) | `#edeafd` (default; theme-overridable via PALETTE_LIGHT) |
| `INK` | `#111111` |
| `TEXT` | `#111111` |
| `MED` | `#777777` |
| `DIM` | `#c0c0c0` |
| `BORDER` | `rgba(0,0,0,0.07)` |
| `SHADOW` | `0 2px 16px rgba(0,0,0,0.08)` |
| Local `INK` inside ADA_SCREEN/ADA_CHAT input "Speak/↑" button | `#1a1320` (a fixed dark ink, NOT the global `#111111`) |

> Note: ADA_SCREEN and ADA_CHAT each define a **local** `const INK = '#1a1320'` used for the send/Speak button background. Use `#1a1320` for the chat input action button, not `#111111`.

### Typography
- Font family `SANS` = `"Plus Jakarta Sans", system-ui, sans-serif`. The two display lines (`ada-empty` headline, `ada-history` "Chat history" title) explicitly re-set `fontFamily: "Plus Jakarta Sans"`.

### Phone shell (`Phone`)
- Outer: width **262**, height **522**, borderRadius **34**, background = `WHITE` (these frames pass `bg={WHITE}`), `overflow: hidden`, `position: relative`, color `TEXT`, base fontSize **12**, fontFamily `SANS`.
- Box shadow: `0 14px 52px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)`.
- Status bar: height **30**, padding `0 18px`, fontSize **10**, fontWeight **700**, space-between. Left `9:41` (color `TEXT`); center pill 36×12 background `#111` radius 6; right `●▊` (letterSpacing −1).
- Below status bar each frame uses a content block of fixed `height: 492`.

### Bottom nav (`BNav active={4}`)
- Absolute: `bottom: 8, left: 10, right: 10`, height **56**, background `WHITE`, borderRadius **20**, shadow `0 4px 28px rgba(0,0,0,0.13)`, padding `0 8px`, flex row space-between, items center.
- Visual order (5 slots): Subjects (`menu_book`, idx0) · Planner (`calendar_today`, idx1) · **Ada center face (idx4)** · Timer (`timer`, idx2) · Stats (`bar_chart`, idx3).
- All three Ada frames pass `active={4}`, so the **center Ada face is the active tab**.
- Icon tab chip: 46×40, borderRadius 14, active background `INK` (`#111111`) with white icon, inactive transparent with `MED` icon; material-icons-outlined fontSize 24.
- Center Ada face slot: outer circle 44×44 radius 50%; when active background `INK`, when inactive background `WHITE` + `1.5px solid BORDER`. Inside it renders `AdaNavFace size={34}`.
  - `AdaNavFace`: circle size 34, `radial-gradient(circle at 36% 30%, #cbbcfd 0%, #b7a6f5 46%, #6b5cf0 100%)`, inset shadow `inset 0 -2px 5px rgba(40,25,90,0.18)`; smiley drawn with stroke `#31237c` strokeWidth 2.4 (two eyebrow arcs + filled smile path).

### AdaBlob (Ada character)
`AdaBlob({ size, mood })` renders `CubeSVG size={size} tone={CUBE_TONES[4]} melt={0} expr={mood} bubbles={3}`.
- `CUBE_TONES[4]` (vivid/best): `{ border: '#5a44f1', body: '#cbbcfd', ink: '#31237c' }`.
- Used at **size 72 mood "happy"** in `ada-empty`, and **size 22** (default mood "happy") for each Ada message avatar in `ada-chat`.

---

## ada-empty — kind: route (Ada intro / empty conversation state)

Renders `<ADA_SCREEN />`. Marked `{ hub: 1 }` in the flow map — it is the hub entry for the Ada family (reached by tapping the center Ada tab in the bottom nav). Background `WHITE`.

### Layout (top → bottom inside the 492-high content block)

1. **Header row** — `padding: 0 16px 10px`, `borderBottom: 1px solid rgba(0,0,0,0.07)`, flex space-between, items center.
   - Left group (flex, gap **9**, items center):
     - Chat-history button: circle **32×32**, borderRadius 50%, background `WHITE`, boxShadow `SHADOW` (`0 2px 16px rgba(0,0,0,0.08)`), centered, `cursor: pointer`, title "Chat history". Icon = hamburger SVG 15×15 (viewBox 0 0 18 18), stroke `TEXT` (`#111111`), strokeWidth 2, round caps: three lines y=4.5 (x 2.5→15.5), y=9 (x 2.5→11.5), y=13.5 (x 2.5→8).
     - "Ada" label: fontFamily `SANS`, fontSize **15**, fontWeight **800**.
   - Right "↑ Upload" pill: background `BG` (`#f4f3f0`), borderRadius **100**, padding `5px 11px`, fontSize **10**, fontWeight **700**, flex gap 4 items center.

2. **Hero block** — flex column, centered both axes, `padding: 24px 28px`, height **258**, textAlign center.
   - `AdaBlob size={72} mood="happy"`.
   - Headline: fontFamily `"Plus Jakarta Sans"`, fontSize **17**, fontWeight **700**, marginTop **16**, lineHeight **1.4**. Text: "Drop your thoughts." `<br/>` "I'll turn them into a plan."

3. **Suggestion chips row** — `padding: 0 12px 8px`, flex, gap **6**, `overflow: hidden`. Four chips, each: padding `5px 10px`, borderRadius **100**, border `1px solid #6b5cf044` (ACC at 44 hex alpha ≈ 27%), fontSize **10**, color `ACC` (`#6b5cf0`), fontWeight **600**, `whiteSpace: nowrap`, `flexShrink: 0`. Labels in order: `Plan my week`, `I'm overwhelmed`, `Break this down`, `Deadline help`.

4. **Input bar** — absolute, `bottom: 66, left: 10, right: 10`, background `BG`, borderRadius **18**, padding `10px 14px`, flex items center, gap **8**.
   - Placeholder text (flex:1): "What's on your mind?", fontSize **12**, color `DIM` (`#c0c0c0`).
   - "Speak" button: background `#1a1320` (local INK), borderRadius **100**, padding `6px 14px`, fontSize **11**, fontWeight **700**, color `#fff`, flex gap 5 items center. Content: `◈` (fontSize 12) + "Speak".

5. **BNav** `active={4}` (center Ada face active).

### Transitions
- **OUT → `ada-chat`** — type `flow`, label **"Ask"** (sending/asking a question moves to the active chat).
- **IN ← bottom nav** — hub frame for the Ada family; reached by tapping the center Ada tab (active idx 4) from anywhere in the app.

---

## ada-chat — kind: route (active conversation; Claude via Vertex AI, streamed)

Renders `<ADA_CHAT />`. Background `WHITE`. Same header as `ada-empty` except the "↑ Upload" pill has **no** inner flex/gap styling (just background `BG`, borderRadius 100, padding `5px 11px`, fontSize 10, fontWeight 700).

### Layout (top → bottom inside the 492-high content block)

1. **Header row** — identical structure to `ada-empty` header: padding `0 16px 10px`, borderBottom `1px solid rgba(0,0,0,0.07)`. Chat-history button 32×32 (same hamburger SVG, stroke TEXT, strokeWidth 2). "Ada" label fontSize 15 fontWeight **800**. Right "↑ Upload" pill (background BG, radius 100, padding 5px 11px, fontSize 10, fontWeight 700).

2. **Message list** — `padding: 10px 14px`, flex column, gap **10**, height **330**, `overflow: hidden`, `justifyContent: flex-end` (messages anchored to bottom).
   - **Ada bubble 1** (incoming): row flex gap **7**, items flex-start. Avatar `AdaBlob size={22}` in a `flexShrink:0` wrapper `marginTop: 2`. Bubble: background `BG`, borderRadius `12px 12px 12px 3px` (tail bottom-left), padding `8px 10px`, maxWidth **185**, fontSize **12**, lineHeight **1.55**. Text: "Hey Ridhwan — your CC viva is 3 days away. Want me to build a prep plan?"
   - **User bubble** (outgoing): row flex `justifyContent: flex-end`. Bubble: background `ACC` (`#6b5cf0`), borderRadius `12px 12px 3px 12px` (tail bottom-right), padding `8px 10px`, maxWidth **170**, fontSize **12**, lineHeight **1.55**, color `#fff`. Text: "Yes — and I need to finish NLP assignment 3 too"
   - **Ada bubble 2** (incoming, with plan card): same row layout (gap 7, avatar `AdaBlob size={22}`, marginTop 2). Bubble: background `BG`, radius `12px 12px 12px 3px`, padding `8px 10px`, maxWidth **190**. Contents:
     - Intro line: fontSize 12, lineHeight 1.55, marginBottom **7** — "Done. Scheduled across 2 days:"
     - **Plan card**: background `ACCL` (`#edeafd`), borderRadius **9**, padding `8px 10px`. Two day groups (each `marginBottom: 6`):
       - Day label: fontSize **9**, fontWeight **800**, color `ACC`, `textTransform: uppercase`, letterSpacing **0.08em**, marginBottom 2.
       - Two task lines each: fontSize **11**, color `TEXT`, prefixed "· " (line1 marginBottom 1).
       - Group 1 "Today": "· LL(1) notes — 35m", "· NLP draft — 45m".
       - Group 2 "Tomorrow": "· CC viva mock — 1h", "· NLP final edits — 30m".
     - Footer: fontSize **10**, color `DIM`, marginTop **5** — "Added to your plan ✓".

3. **Input bar** — absolute `bottom: 66, left: 10, right: 10`, background `BG`, borderRadius **18**, padding `8px 14px` (note: 8px vertical here vs 10px in ada-empty), flex gap **8** items center.
   - Placeholder (flex:1): "Ask Ada anything...", fontSize **12**, color `DIM`.
   - Send button: background `#1a1320` (local INK), **30×30**, borderRadius 50% (circle), centered, fontSize **14**, color `#fff`, glyph `↑`.

4. **BNav** `active={4}`.

### Transitions
- **IN ← `ada-empty`** — type `flow`, label "Ask".
- **OUT → `ada-history`** — type `modal`, label **"History"** (tap the chat-history ☰ button in the header).
- **OUT → `plan-timeline`** — type `cross`, label **"Added to plan"** (the scheduled-plan card flows results into the Planner timeline).

---

## ada-history — kind: sheet/route (Chat history slide-over; tap ☰)

Renders `<CHAT_HISTORY />`. A slide-over panel overlaying the Ada screen: the dimmed Ada screen peeks at the right edge. Phone background `WHITE`.

### Layout

Content block height **492**, `position: relative`, containing two layers:

1. **Dimmed peek** (behind, right edge): absolute `top:0, right:0, bottom:0`, width **30**, background `#cdcbc9` (hardcoded warm grey, not a token).

2. **Panel** (foreground): absolute `top:0, left:0, bottom:0, right:24` (leaves 24px gap at right so the peek shows), background `WHITE`, borderRadius `0 16px 16px 0`, boxShadow `6px 0 30px rgba(0,0,0,0.12)`, padding `0 16px`, `overflow: hidden`. Inside, top → bottom:

   a. **Header row** — padding `0 0 14px`, flex space-between items center.
      - Chat-history button (same as other frames): circle 32×32, radius 50%, background WHITE, boxShadow SHADOW, centered. Same hamburger SVG (15×15, stroke TEXT, strokeWidth 2, three lines).
      - "↑ Upload" pill: background `BG`, borderRadius 100, padding `5px 11px`, fontSize 10, fontWeight 700, flex gap 4 items center.

   b. **Title row** — flex space-between items center, marginBottom **16**.
      - "Chat history" title: fontFamily `"Plus Jakarta Sans"`, fontSize **26**, fontWeight **800**, letterSpacing **−0.5**.
      - New-chat button: circle **36×36**, radius 50%, background WHITE, boxShadow SHADOW, centered, `cursor: pointer`, title "New chat". Icon = material-icons-outlined `edit_note`, fontSize **17**, color `TEXT`.

   c. **Dated conversation list** — flex column, gap **16**. Five entries; each is a `cursor: pointer` item:
      - Date label: fontSize **9**, fontWeight **800**, letterSpacing **0.08em**, color `DIM` (`#c0c0c0`), marginBottom 3.
      - Title: fontSize **15**, color `TEXT`, fontWeight **700**.
      - Entries (date → title):
        1. `MONDAY, 1 JUN` → "CC viva prep plan"
        2. `FRIDAY, 22 MAY` → "NLP assignment 3 breakdown"
        3. `MONDAY, 18 MAY` → "Exam-week schedule"
        4. `FRIDAY, 15 MAY` → "I'm overwhelmed — triage"
        5. `MONDAY, 9 FEB` → "Google Calendar import"

3. **BNav** `active={4}` — rendered outside the panel (the bottom nav remains visible/active below the slide-over).

### Transitions
- **IN ← `ada-chat`** — type `modal`, label **"History"** (tap the ☰ chat-history button). Listed as a modal of the Ada family. Treated as a slide-over sheet over the Ada screen.
- **OUT** — no explicit outbound edges in the flow map. Dismissal returns to the underlying Ada screen (tap the peek/☰ to close); the `edit_note` "New chat" button conceptually starts a fresh conversation (no wired edge); tapping a list item conceptually opens that conversation (no wired edge).
