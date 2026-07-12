import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/calendar_grid.dart';

/// plan-pick-date — bottom sheet date picker (spec section-02b).
///
/// Presents the "Pick a date" sheet over the dimmed real screen and resolves to
/// the chosen date string (e.g. `'Mon, 18 May'`), or `null` if dismissed.
Future<String?> showTaskDatePicker(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x4C140F1C),
    builder: (_) => const _DatePickerSheet(),
  );
}

class _DatePickerSheet extends StatelessWidget {
  const _DatePickerSheet();

  static const _selectedDate = 'Mon, 18 May';

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius:
            const BorderRadius.vertical(top: Radius.circular(AppRadius.sheetTop)),
        boxShadow: colors.sheetShadow,
      ),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
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
                      'Pick a date',
                      style: AppText.sans(
                        size: 20,
                        weight: FontWeight.w800,
                        color: colors.text,
                      ),
                    ),
                  ),
                  _CloseButton(onTap: () => Navigator.of(context).pop()),
                ],
              ),
              const SizedBox(height: 12),
              const _QuickChipsRow(),
              const SizedBox(height: 14),
              _MonthHeader(),
              const SizedBox(height: 10),
              const CalendarGrid(firstCol: 4, total: 31, accentDay: 18),
              const SizedBox(height: 14),
              _SetDateButton(
                label: 'Set date · $_selectedDate',
                onTap: () => Navigator.of(context).pop(_selectedDate),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickChipsRow extends StatelessWidget {
  const _QuickChipsRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        _QuickChip(label: 'Today'),
        SizedBox(width: 6),
        _QuickChip(label: 'Tomorrow'),
        SizedBox(width: 6),
        _QuickChip(label: '18 May', active: true),
        SizedBox(width: 6),
        _QuickChip(label: 'Next week'),
      ],
    );
  }
}

class _QuickChip extends StatelessWidget {
  const _QuickChip({required this.label, this.active = false});

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: active ? colors.accent : colors.bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.clip,
        style: AppText.sans(
          size: 10.5,
          weight: FontWeight.w700,
          color: active ? Colors.white : colors.textMed,
        ),
      ),
    );
  }
}

class _MonthHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'May 2026',
          style: AppText.sans(
            size: 15,
            weight: FontWeight.w800,
            color: colors.text,
          ),
        ),
        Row(
          children: [
            Icon(Icons.chevron_left, size: 18, color: colors.textDim),
            Icon(Icons.chevron_right, size: 18, color: colors.text),
          ],
        ),
      ],
    );
  }
}

class _SetDateButton extends StatelessWidget {
  const _SetDateButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderRadius = BorderRadius.circular(AppRadius.pill);
    return Material(
      color: colors.ink,
      borderRadius: borderRadius,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 13),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppText.sans(
              size: 13,
              weight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 26,
        height: 26,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
        child: Text(
          '✕',
          style: TextStyle(fontSize: 12, color: colors.textMed, height: 1),
        ),
      ),
    );
  }
}
