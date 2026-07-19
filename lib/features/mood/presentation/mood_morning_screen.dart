import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../core/utils/date_format.dart';
import '../../../data/models/enums.dart';
import '../../../data/repositories/mood_repository.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/mood_blob.dart';
import '../../../shared/widgets/primary_button.dart';

/// Frame `mood-morning` — full-screen morning check-in. Morphs the Ada ice-cube
/// blob across the 5-step MOODS scale, logs the chosen mood, then jumps to the
/// Timeline home ("Start day").
class MoodMorningScreen extends ConsumerStatefulWidget {
  const MoodMorningScreen({super.key});

  @override
  ConsumerState<MoodMorningScreen> createState() => _MoodMorningScreenState();
}

class _MoodMorningScreenState extends ConsumerState<MoodMorningScreen> {
  /// MOODS ramp colors (idx 0→4): Rough → Great (prototype `MOODS`).
  static const List<Color> _moodColors = [
    Color(0xFFA79FC4),
    Color(0xFF9286D2),
    Color(0xFF7D70D9),
    Color(0xFF6A5CE4),
    Color(0xFF5A44F1),
  ];

  int _selectedMood = 3;

  void _selectMood(int idx) => setState(() => _selectedMood = idx);

  Future<void> _setIntention() async {
    await ref.read(moodRepositoryProvider).log(
          date: AppDate.today(),
          phase: MoodPhase.morning,
          mood: _selectedMood,
        );
    ref.invalidate(moodWeekProvider);
    if (mounted) context.go(Routes.plan);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final moodColor = _moodColors[_selectedMood];

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 10, 22, 0),
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => context.go(Routes.plan),
                  child: Text(
                    'Skip',
                    style: AppText.sans(size: 11, color: colors.textDim),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Morning\ncheck-in',
                textAlign: TextAlign.center,
                style: AppText.sans(
                  size: 26,
                  weight: FontWeight.w800,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'How are you feeling today?',
                style: AppText.sans(size: 12, color: colors.textDim),
              ),
              const SizedBox(height: 14),
              MoodBlob(idx: _selectedMood, size: 84),
              const SizedBox(height: 6),
              Text(
                MoodScale.labels[_selectedMood],
                style: AppText.sans(
                  size: 13,
                  weight: FontWeight.w800,
                  color: moodColor,
                ),
              ),
              const SizedBox(height: 14),
              _MoodSlider(
                selectedMood: _selectedMood,
                moodColors: _moodColors,
                onSelect: _selectMood,
              ),
              const SizedBox(height: 6),
              _AdaTipCard(),
              const SizedBox(height: 14),
              const Spacer(),
              PrimaryButton(
                label: "Set today's intention →",
                onPressed: () => unawaited(_setIntention()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 5-step mood slider: dot nodes connected by bars. Bars at/left of the
/// selected node are accent @45%; the selected node is enlarged and ringed.
class _MoodSlider extends StatelessWidget {
  const _MoodSlider({
    required this.selectedMood,
    required this.moodColors,
    required this.onSelect,
  });

  final int selectedMood;
  final List<Color> moodColors;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 0, 22, 22),
      child: Row(
        children: [
          for (var i = 0; i < 5; i++) ...[
            if (i > 0)
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: i <= selectedMood
                        ? moodColors[selectedMood].withAlpha(115)
                        : colors.bg,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            _MoodNode(
              idx: i,
              selected: i == selectedMood,
              color: moodColors[i],
              onTap: () => onSelect(i),
            ),
          ],
        ],
      ),
    );
  }
}

/// A single mood node: the outer ring + inner dot + tiny label beneath.
class _MoodNode extends StatelessWidget {
  const _MoodNode({
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
    final outer = selected ? 34.0 : 24.0;
    final inner = selected ? 13.0 : 8.0;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: outer,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: outer,
              height: outer,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? color.withAlpha(0x22) : colors.surface,
                border: Border.all(
                  color: selected ? color : colors.border,
                  width: selected ? 2.5 : 2,
                ),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: color.withAlpha(0x40),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Center(
                child: Container(
                  width: inner,
                  height: inner,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withAlpha(selected ? 0xFF : 115),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 7),
            Text(
              MoodScale.labels[idx],
              maxLines: 1,
              overflow: TextOverflow.visible,
              style: AppText.sans(
                size: 8.5,
                weight: FontWeight.w700,
                color: selected ? color : colors.textDim,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Ada's encouraging tip card (accent-soft fill, no shadow): mascot + a line of
/// copy tied to the pre-selected "Good" day.
class _AdaTipCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AdaMascot(size: 24),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Nice! On "Good" days you average 2.4 hrs of deep focus. '
              "I've scheduled your hardest task for 2 PM.",
              style: AppText.sans(size: 11, height: 1.6, color: colors.text),
            ),
          ),
        ],
      ),
    );
  }
}
