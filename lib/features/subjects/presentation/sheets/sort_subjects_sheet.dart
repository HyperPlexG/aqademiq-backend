import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/app_toggle.dart';

/// Presents the "Sort subjects" sheet (`subj-sort`) — a bottom sheet over the
/// dimmed Subjects list. Lists five ordering options plus a "Reverse order"
/// toggle. Tapping an option pops with its label; returns `null` on dismiss.
Future<String?> showSortSubjectsSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x4C140F1C),
    isScrollControlled: true,
    builder: (_) => const _SortSubjectsSheet(),
  );
}

/// One sortable ordering option as shown in the sheet.
class _SortOption {
  const _SortOption({
    required this.icon,
    required this.label,
    required this.sub,
  });

  final IconData icon;
  final String label;
  final String sub;
}

const _options = <_SortOption>[
  _SortOption(
    icon: Icons.drag_indicator,
    label: 'Manual order',
    sub: 'Drag to arrange',
  ),
  _SortOption(
    icon: Icons.sort_by_alpha,
    label: 'Alphabetical',
    sub: 'A to Z',
  ),
  _SortOption(
    icon: Icons.grade,
    label: 'Grade',
    sub: 'Highest target first',
  ),
  _SortOption(
    icon: Icons.workspace_premium,
    label: 'Credits',
    sub: 'Most credits first',
  ),
  _SortOption(
    icon: Icons.sentiment_satisfied,
    label: 'Mood',
    sub: 'How you feel about each',
  ),
];

class _SortSubjectsSheet extends StatefulWidget {
  const _SortSubjectsSheet();

  @override
  State<_SortSubjectsSheet> createState() => _SortSubjectsSheetState();
}

class _SortSubjectsSheetState extends State<_SortSubjectsSheet> {
  bool _reverse = false;

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
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0DDD7),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Sort subjects',
                      style: AppText.sans(
                        size: 20,
                        weight: FontWeight.w800,
                        color: colors.text,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colors.bg,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '✕',
                        style: AppText.sans(size: 12, color: colors.textMed),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                'Choose how your subjects are ordered',
                style: AppText.sans(size: 11.5, color: colors.textMed),
              ),
              const SizedBox(height: 14),
              for (var i = 0; i < _options.length; i++)
                Padding(
                  padding: EdgeInsets.only(
                    bottom: i == _options.length - 1 ? 0 : 1,
                  ),
                  child: _OptRow(
                    option: _options[i],
                    active: i == 0,
                    onTap: () =>
                        Navigator.of(context).pop(_options[i].label),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Reverse order',
                      style: AppText.sans(
                        size: 12.5,
                        weight: FontWeight.w700,
                        color: colors.text,
                      ),
                    ),
                    AppToggle(
                      value: _reverse,
                      onChanged: (v) => setState(() => _reverse = v),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptRow extends StatelessWidget {
  const _OptRow({
    required this.option,
    required this.active,
    required this.onTap,
  });

  final _SortOption option;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = colors.accent;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        decoration: BoxDecoration(
          color: active ? colors.accentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadius.cellSmall),
        ),
        child: Row(
          children: [
            Icon(
              option.icon,
              size: 19,
              color: active ? accent : colors.textMed,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    option.label,
                    style: AppText.sans(
                      size: 13.5,
                      weight: active ? FontWeight.w800 : FontWeight.w600,
                      color: active ? accent : colors.text,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    option.sub,
                    style: AppText.sans(size: 10.5, color: colors.textDim),
                  ),
                ],
              ),
            ),
            if (active) ...[
              const SizedBox(width: 12),
              Icon(Icons.check, size: 14, color: accent),
            ],
          ],
        ),
      ),
    );
  }
}
