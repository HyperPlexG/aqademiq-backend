import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/mood_blob.dart';
import '../../../shared/widgets/primary_button.dart';
import '../providers/onboarding_controller.dart';
import 'widgets/onboarding_scaffold.dart';

/// Frame `ob-mood` (step 3): how the student feels about each subject. A mood
/// scale (Dread it → Love it) per subject, written to the draft via
/// [OnboardingController.setSubjectMood].
class ObMoodScreen extends ConsumerWidget {
  const ObMoodScreen({super.key});

  /// MOODS scale colors (idx 0→4): Rough → Great (prototype `MOODS`).
  static const List<Color> _moodColors = [
    Color(0xFFA79FC4),
    Color(0xFF9286D2),
    Color(0xFF7D70D9),
    Color(0xFF6A5CE4),
    Color(0xFF5A44F1),
  ];

  static const List<String> _subjects = ['Engineering', 'Computer Science'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final moods = ref.watch(onboardingProvider).subjects.isEmpty
        ? const <String, int>{}
        : ref.watch(onboardingProvider).subjectMoods;

    return OnboardingScaffold(
      activeStep: 3,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'How do you feel\nabout each?',
            style: AppText.sans(size: 26, weight: FontWeight.w800, height: 1.2),
          ),
          const SizedBox(height: 14),
          for (var s = 0; s < _subjects.length; s++) ...[
            _SubjectMoodCard(
              subject: _subjects[s],
              active: moods[_subjects[s]] ?? 2,
              moodColors: _moodColors,
              onSelect: (i) => ref
                  .read(onboardingProvider.notifier)
                  .setSubjectMood(_subjects[s], i),
            ),
            if (s < _subjects.length - 1) const SizedBox(height: 8),
          ],
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: colors.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.card),
            ),
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdaMascot(size: 24),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    "I'll schedule the subjects you dread in shorter, gentler "
                    'sessions — and pair them with Prism focus audio.',
                    style: AppText.sans(
                      size: 11,
                      height: 1.5,
                      color: colors.text,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
      footer: PrimaryButton(
        label: 'Continue →',
        onPressed: () => unawaited(context.push(Routes.obSyllabus)),
      ),
    );
  }
}

/// A single subject's mood card: header (name + current label) and a 5-step
/// mood scale with the active blob ringed in its MOODS color.
class _SubjectMoodCard extends StatelessWidget {
  const _SubjectMoodCard({
    required this.subject,
    required this.active,
    required this.moodColors,
    required this.onSelect,
  });

  final String subject;
  final int active;
  final List<Color> moodColors;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final activeIdx = active.clamp(0, 4);
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                subject,
                style: AppText.sans(size: 13, weight: FontWeight.w700),
              ),
              Text(
                MoodScale.labels[activeIdx],
                style: AppText.sans(
                  size: 10,
                  weight: FontWeight.w700,
                  color: moodColors[activeIdx],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (var i = 0; i < 5; i++)
                _MoodCell(
                  idx: i,
                  active: i == activeIdx,
                  color: moodColors[i],
                  onTap: () => onSelect(i),
                ),
            ],
          ),
          const SizedBox(height: 5),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Dread it',
                  style: AppText.sans(size: 8.5, color: colors.textDim),
                ),
                Text(
                  'Love it',
                  style: AppText.sans(size: 8.5, color: colors.textDim),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A tappable mood blob; the active one sits inside a tinted, bordered circle.
class _MoodCell extends StatelessWidget {
  const _MoodCell({
    required this.idx,
    required this.active,
    required this.color,
    required this.onTap,
  });

  final int idx;
  final bool active;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? color.withAlpha(0x1C) : Colors.transparent,
          border: Border.all(
            width: 2,
            color: active ? color : Colors.transparent,
          ),
        ),
        child: MoodBlob(idx: idx, size: 26),
      ),
    );
  }
}
