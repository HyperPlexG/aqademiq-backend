import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/mood_blob.dart';
import '../../../../shared/widgets/primary_button.dart';

/// MOODS palette (index 0→4): Rough, Tired, OK, Good, Great. These match the
/// `border` tone of each cube tone in the prototype.
const List<Color> _moodColors = [
  Color(0xFFA79FC4),
  Color(0xFF9286D2),
  Color(0xFF7D70D9),
  Color(0xFF6A5CE4),
  Color(0xFF5A44F1),
];

/// plan-logmood — "How are you feeling?" check-in bottom sheet.
///
/// Presents the 5-step mood scale (idx 0–4) with idx 3 (Good) preselected.
/// Returns the chosen mood index on "Log mood", or `null` if the user taps
/// "Skip for now" or dismisses the sheet.
Future<int?> showLogMoodSheet(BuildContext context) {
  return showModalBottomSheet<int>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x42140F1C),
    isScrollControlled: true,
    builder: (context) => const _LogMoodSheet(),
  );
}

class _LogMoodSheet extends StatefulWidget {
  const _LogMoodSheet();

  @override
  State<_LogMoodSheet> createState() => _LogMoodSheetState();
}

class _LogMoodSheetState extends State<_LogMoodSheet> {
  int _selected = 3;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadius.sheetTop),
        ),
        boxShadow: colors.sheetShadow,
      ),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 22),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0DDD7),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Text(
                'How are you feeling?',
                textAlign: TextAlign.center,
                style: AppText.sans(size: 21, weight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                'A quick check-in helps Ada tune your day',
                textAlign: TextAlign.center,
                style: AppText.sans(size: 11.5, color: colors.textMed),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (var i = 0; i < 5; i++) _MoodColumn(
                    idx: i,
                    selected: _selected == i,
                    onTap: () => setState(() => _selected = i),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              PrimaryButton(
                label: 'Log mood',
                onPressed: () => Navigator.of(context).pop(_selected),
              ),
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Text(
                  'Skip for now',
                  style: AppText.sans(size: 11.5, color: colors.textMed),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MoodColumn extends StatelessWidget {
  const _MoodColumn({
    required this.idx,
    required this.selected,
    required this.onTap,
  });

  final int idx;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final moodColor = _moodColors[idx];

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? moodColor.alpha8(0x1E) : null,
              border: Border.all(
                color: selected ? moodColor : Colors.transparent,
                width: 2,
              ),
            ),
            child: MoodBlob(idx: idx, size: selected ? 34 : 32),
          ),
          const SizedBox(height: 6),
          Text(
            MoodScale.labels[idx],
            style: AppText.sans(
              size: 8.5,
              weight: selected ? FontWeight.w800 : FontWeight.w600,
              color: selected ? moodColor : colors.textMed,
            ),
          ),
        ],
      ),
    );
  }
}
