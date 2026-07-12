import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../data/fixtures/fixtures.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/mood_log.dart';
import '../../../data/repositories/mood_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/dismiss_keyboard.dart';
import '../../../shared/widgets/mood_blob.dart';
import '../../../shared/widgets/primary_button.dart';

/// Frame `mood-evening` — full-screen Evening reflection. A left-aligned column
/// with a 5-mood picker row (pre-selected "Good"/idx 3), an optional note field,
/// and a "This week's mood" card. The CTA logs the reflection via
/// [MoodRepository.log] (phase [MoodPhase.evening]) and returns to the planner.
class MoodEveningScreen extends ConsumerStatefulWidget {
  const MoodEveningScreen({super.key});

  @override
  ConsumerState<MoodEveningScreen> createState() => _MoodEveningScreenState();
}

class _MoodEveningScreenState extends ConsumerState<MoodEveningScreen> {
  /// MOODS scale colors (idx 0→4): Rough → Great (prototype `MOODS`).
  static const List<Color> _moodColors = [
    Color(0xFFA79FC4),
    Color(0xFF9286D2),
    Color(0xFF7D70D9),
    Color(0xFF6A5CE4),
    Color(0xFF5A44F1),
  ];

  static const String _weekLetters = 'MTWTFSS';

  final TextEditingController _note = TextEditingController();
  int _sel = 3;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    await ref.read(moodRepositoryProvider).log(
          date: Fixtures.today,
          phase: MoodPhase.evening,
          mood: _sel,
          note: _note.text.isEmpty ? null : _note.text,
        );
    ref.invalidate(moodWeekProvider);
    if (mounted) context.go(Routes.plan);
  }

  /// Latest logged mood per weekday (Mon→Sun) for the demo week, or null.
  int? _moodForDay(List<MoodLog> logs, DateTime monday, int i) {
    final day = monday.add(Duration(days: i));
    int? mood;
    for (final l in logs) {
      if (l.date.year == day.year && l.date.month == day.month && l.date.day == day.day) {
        mood = l.mood;
      }
    }
    return mood;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final logs = ref.watch(moodWeekProvider).value ?? const <MoodLog>[];
    final monday = Fixtures.today.subtract(Duration(days: Fixtures.today.weekday - 1));
    return Scaffold(
      backgroundColor: colors.surface,
      body: DismissKeyboard(
        child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 10, 22, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'MON · 18 MAY',
                    style: AppText.sans(
                      size: 10,
                      weight: FontWeight.w800,
                      letterSpacing: AppText.em(0.1, 10),
                      color: colors.textDim,
                    ),
                  ),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => context.go(Routes.plan),
                    child: Text(
                      'Skip',
                      style: AppText.sans(size: 11, color: colors.textDim),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Evening\nreflection',
                style: AppText.sans(
                  size: 26,
                  weight: FontWeight.w800,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'How did today go?',
                style: AppText.sans(size: 12, color: colors.textDim),
              ),
              const SizedBox(height: 18),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    for (var i = 0; i < 5; i++)
                      _MoodPick(
                        idx: i,
                        selected: i == _sel,
                        color: _moodColors[i],
                        onTap: () => setState(() => _sel = i),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              const FieldLabel('Optional note'),
              Container(
                constraints: const BoxConstraints(minHeight: 70),
                padding: const EdgeInsets.symmetric(
                  vertical: 12,
                  horizontal: 14,
                ),
                decoration: BoxDecoration(
                  color: colors.bg,
                  borderRadius: BorderRadius.circular(AppRadius.rowInput),
                ),
                child: TextField(
                  controller: _note,
                  maxLines: null,
                  cursorColor: colors.text,
                  style: AppText.sans(size: 12, color: colors.text),
                  decoration: InputDecoration.collapsed(
                    hintText: 'What made today that way?',
                    hintStyle: AppText.sans(size: 12, color: colors.textDim),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "This week's mood",
                      style: AppText.sans(size: 13, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        for (var i = 0; i < 7; i++)
                          _WeekDay(
                            idx: _moodForDay(logs, monday, i),
                            letter: _weekLetters[i],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              PrimaryButton(
                label: 'Save reflection →',
                onPressed: () => unawaited(_save()),
              ),
            ],
          ),
        ),
        ),
      ),
    );
  }
}

/// One entry in the evening mood picker: a [MoodBlob] in a padded ring (tinted +
/// bordered when selected) with its MOODS label below.
class _MoodPick extends StatelessWidget {
  const _MoodPick({
    required this.idx,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  final int idx;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? color.alpha8(0x14) : Colors.transparent,
              border: Border.all(
                width: 2,
                color: selected ? color : Colors.transparent,
              ),
            ),
            child: MoodBlob(idx: idx, size: selected ? 34 : 31),
          ),
          const SizedBox(height: 6),
          Text(
            MoodScale.labels[idx],
            style: AppText.sans(
              size: 8.5,
              weight: FontWeight.w700,
              color: selected ? color : colors.textDim,
            ),
          ),
        ],
      ),
    );
  }
}

/// A single column in the "This week's mood" strip: either a logged [MoodBlob]
/// or an empty placeholder circle, with the day letter beneath.
class _WeekDay extends StatelessWidget {
  const _WeekDay({required this.idx, required this.letter});

  final int? idx;
  final String letter;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final mood = idx;
    return Column(
      children: [
        SizedBox.square(
          dimension: 24,
          child: Center(
            child: mood == null
                ? Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colors.bg,
                    ),
                  )
                : MoodBlob(idx: mood, size: 24),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          letter,
          style: AppText.sans(size: 9, color: colors.textDim),
        ),
      ],
    );
  }
}
