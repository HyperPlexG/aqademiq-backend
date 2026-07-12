import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/date_format.dart';

/// The horizontal week strip on PLAN_TIMELINE. Each cell = date number (top) +
/// large weekday letter, with a selected highlight + underline.
class PlanDateStrip extends StatelessWidget {
  const PlanDateStrip({
    super.key,
    required this.selected,
    required this.today,
    required this.onSelect,
  });

  final DateTime selected;
  final DateTime today;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    final monday = AppDate.mondayOf(selected);
    final days = List.generate(7, (i) => monday.add(Duration(days: i)));
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (final d in days)
            _DayCell(
              date: d,
              isSelected: AppDate.sameDay(d, selected),
              isToday: AppDate.sameDay(d, today),
              onTap: () => onSelect(d),
            ),
        ],
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.isSelected,
    required this.isToday,
    required this.onTap,
  });

  final DateTime date;
  final bool isSelected;
  final bool isToday;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final numberColor =
        (isToday && !isSelected) ? colors.accent : colors.textDim;
    final letterColor = isSelected
        ? colors.text
        : (isToday ? colors.accent : colors.textDim);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 34,
        padding: const EdgeInsets.symmetric(vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? colors.hilite : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${date.day}',
              style: AppText.sans(size: 10, weight: FontWeight.w700, color: numberColor),
            ),
            const SizedBox(height: 2),
            Text(
              AppDate.weekdayLetter(date.weekday),
              style: AppText.sans(size: 19, weight: FontWeight.w800, color: letterColor),
            ),
            const SizedBox(height: 2),
            Container(
              width: 14,
              height: 3,
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFFC4C1BB) : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
