# DESIGN_SYSTEM.md — build contract for screens (Phase B)

> How every screen/sheet/dialog must be built so the app stays consistent.
> Source of truth for **values** = `docs/specs/section-*.md` (pixel-exact) and
> `PROTOTYPE_SPECS.md`. When the prototype and README conflict, the prototype wins.

## Conventions
- Screens are **presentational** `ConsumerWidget` / `ConsumerStatefulWidget`. They read data ONLY from Riverpod providers (never Dio/DTOs).
- Async data: `ref.watch(xProvider)` returns `AsyncValue<T>`; render with `.when(loading:, error:, data:)`. Always handle loading/empty/error.
- Mutations: `ref.read(xControllerProvider.notifier).method(...)`. Optimistic where it makes sense.
- Colors: `context.colors.<token>` (see below). Never hardcode hex except the documented literals (`#d6d3ce`, `#c4c1bb`, `#e0ddd7`, `#dedede`) and brand SSO colors.
- Text: `AppText.sans(size:, weight:, letterSpacing:, height:, color:)`, `AppText.numeral(...)` (Playfair, big numbers only), `AppText.mono(...)`. `AppText.em(emValue, fontSize)` converts CSS `em` letter-spacing. Default weight is `w600`.
- Radii: `AppRadius.card(16) group(18) sheetTop(24) rowInput(14) pill(100) nav(20) tile(10) cellSmall(12)`.
- Spacing: `AppSpacing.screenSide(16) x2(8) x3(12) x4(16) x5(20) x6(24)`.
- Border width is **1.5**. Card shadow = `colors.cardShadow`.
- Navigation: `import 'package:go_router/go_router.dart'` → `context.go(Routes.x)` (replace) / `context.push(Routes.x)` (stack; wrap in `unawaited(...)` inside async). Route consts in `lib/core/router/app_router.dart`.
- Full-screen routes (outside the tab shell): `Scaffold(backgroundColor: context.colors.surface OR .bg, body: SafeArea(child: ...))`. Auth/onboarding use `surface`; in-app pages use `bg`.
- Tab screens live inside the shell — use `AppScaffold(child:)` (adds 16 side pad + bottom clearance for the floating nav). Don't add a Scaffold inside a tab screen.

## color tokens (`context.colors.*`)
`bg, surface, text, textMed, textDim, border, hilite, ink, accent, accentSoft, success, warn, danger, frameBg, cardShadow, navShadow, sheetShadow`. Use `Color.alpha8(0x18)` for the prototype's accent/color tints.

## Shared widgets (`lib/shared/widgets/`, `lib/shared/mascot/`)
- `AppScaffold({required child, horizontalPadding=16, bottomClearance=92, top=true})` — tab-screen body wrapper.
- `PrimaryButton({required label, onPressed, ghost=false, icon})` — full-width pill (ink/white or ghost).
- `AppCard({required child, padding, radius=16, onTap})`.
- `TagChip({required label, color, active=false, dashed=false, onTap, onRemove})`.
- `AppToggle({required value, onChanged})`.
- `SectionPill({required label, count, icon, onTap})` — centered ink pill.
- `SettingsRow({required label, icon, avatar, sub, value, pill, toggle, onToggle, showChevron=false, onTap, danger=false, last=false})`; wrap rows in `SetGroup(children:[...])` under a `GroupLabel('TEXT')`. `TimePill('value')` for inline value pills.
- `MoodBlob({idx=2, size=80})` — MOODS 0..4 (Rough..Great); `MoodScale.labels`.
- `AppTextField({controller, hint, obscureText=false, keyboardType, suffix, autofocus, onSubmitted, textInputAction})` + `FieldLabel('LABEL')` (uppercase field label).
- `CircleBackButton({onTap, icon=arrow_back})` — 32px back circle.
- `ComingSoon({required title, subtitle, expr})` — placeholder body (replace as sections are built).
- Mascot: `AdaMascot({size=60, toneIndex=4, melt=0, expr=AdaExpr.happy, bubbles=3, cheeks, sparkles, sweat})`, `AdaNavFace({size=34})`, `FocusTimerRing({required minutes, maxMinutes=60, progress, size=168})`.
- Bottom sheets: `showAppBottomSheet<T>(context, title:, child:, subtitle:, scrim:)` (scrim `AppScrim.picker/.settings/.dialog`). Dialogs: `showAppDialog<T>(context, title:, subtitle:, child:)`.

## Providers (read these; don't recreate)
- Theme: `themeModeProvider` (ThemeMode), `accentProvider` (AppAccent).
- Auth/session: `authRepositoryProvider`, `authStateProvider` (`AsyncValue<AppUser?>`), `isGuestProvider` (bool). Actions: `authControllerProvider` (`.guest()/.signIn()/.signUp()/.verify()`, watch `.isLoading`).
- Plan: `selectedDateProvider` (DateTime; `.select()/.goToToday()`), `dayTasksProvider` (`AsyncValue<List<Task>>`; `.toggleDone(task)`).
- Tags: `tagsProvider` (`AsyncValue<List<Tag>>`), `tagsByIdProvider` (`AsyncValue<Map<String,Tag>>`).
- Subjects: `subjectsProvider`, `semestersProvider`, `subjectsByIdProvider`; `subjectsRepositoryProvider`.
- Focus: `focusControllerProvider` (`FocusSession`; `.configure()/.start()/.pause()/.resume()/.complete()/.reset()`).
- Mood: `moodWeekProvider` (`AsyncValue<List<MoodLog>>`); `moodRepositoryProvider.log(...)`.
- Profile: `statsProvider` (`AsyncValue<UserStats>`).
- Ada: `adaChatProvider` (`AdaChatState{messages, typing}`; `.send(text)/.clear()`).

## Models (`lib/data/models/`)
`Task{id,title,tagId,date,dayPart,startTime,durationMin,repeat,subtasks,done}`, `Subtask`, `RepeatRule`, `Subject{id,name,color,semesterId,target,fileCount}`, `SubjectTarget{kind,value}`, `Semester`, `Tag{id,label,color}`, `FocusSession{...,progress}`, `MoodLog{id,date,phase,mood,note}`, `AppUser{...,isGuest}`, `UserStats{streakDays,focusMinutesThisWeek,tasksCompletedThisWeek,weekMoods}`, `AdaMessage{id,role,text,createdAt}`. Enums in `enums.dart`: `DayPart, RepeatFrequency, SubjectTargetKind, FocusStatus, MoodPhase, AdaRole`. Hex→Color via `hexColor(String)`.

## Reference implementations (copy these patterns)
- Tab screen with AsyncValue.when + sections: `lib/features/plan/presentation/plan_screen.dart`.
- Full-screen form (fields, buttons, nav): `lib/features/auth/presentation/signin_screen.dart`, `signup_screen.dart`.
- Sheet/dialog usage: `app_shell.dart` (`showAppDialog`).
