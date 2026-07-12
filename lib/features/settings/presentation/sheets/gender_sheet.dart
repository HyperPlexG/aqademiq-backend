import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// settings-gender sheet (spec §13a). Opens over the dimmed Profile screen and
/// returns the chosen label (or `null` on dismiss).
///
/// Options: Female, Male, Non-binary, "Prefer not to say" (default selected).
Future<String?> showGenderSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x6B140F1C),
    isScrollControlled: true,
    builder: (_) => const _GenderSheet(),
  );
}

class _GenderSheet extends StatefulWidget {
  const _GenderSheet();

  @override
  State<_GenderSheet> createState() => _GenderSheetState();
}

class _GenderSheetState extends State<_GenderSheet> {
  static const _options = <String>[
    'Female',
    'Male',
    'Non-binary',
    'Prefer not to say',
  ];

  String _selected = 'Prefer not to say';

  void _pick(String label) {
    setState(() => _selected = label);
    Navigator.of(context).pop(label);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.sheetTop),
          ),
          boxShadow: colors.sheetShadow,
        ),
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0DDD7),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                'Gender',
                style: AppText.sans(size: 20, weight: FontWeight.w800),
              ),
            ),
            for (final label in _options)
              _OptionRow(
                label: label,
                selected: label == _selected,
                onTap: () => _pick(label),
              ),
          ],
        ),
      ),
    );
  }
}

/// Pill option row used by the gender sheet (spec `OptionRow`).
class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
          decoration: BoxDecoration(
            color: selected ? colors.accentSoft : colors.hilite,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              width: 1.5,
              color: selected ? colors.accent : Colors.transparent,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: AppText.sans(
                  size: 13.5,
                  weight: FontWeight.w700,
                  color: selected ? colors.accent : colors.text,
                ),
              ),
              if (selected)
                Icon(Icons.check_circle, size: 20, color: colors.accent),
            ],
          ),
        ),
      ),
    );
  }
}
