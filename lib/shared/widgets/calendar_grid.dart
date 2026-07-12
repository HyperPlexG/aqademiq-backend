import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text.dart';

/// A month calendar grid (prototype `CalGrid`): MON–SUN headers + day circles,
/// with one accented (selected) day. [firstCol] is the 0-based column (0=Mon) of
/// day 1; [total] is the number of days in the month.
class CalendarGrid extends StatelessWidget {
  const CalendarGrid({
    super.key,
    required this.firstCol,
    required this.total,
    this.accentDay,
    this.onDayTap,
  });

  final int firstCol;
  final int total;
  final int? accentDay;
  final ValueChanged<int>? onDayTap;

  static const _headers = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cells = <Widget>[];
    for (var i = 0; i < firstCol; i++) {
      cells.add(const SizedBox.shrink());
    }
    for (var day = 1; day <= total; day++) {
      final isAccent = day == accentDay;
      cells.add(
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onDayTap == null ? null : () => onDayTap!(day),
          child: SizedBox(
            height: 28,
            child: Center(
              child: Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isAccent ? colors.accent : Colors.transparent,
                ),
                child: Text(
                  '$day',
                  style: AppText.sans(
                    size: 13,
                    weight: FontWeight.w700,
                    color: isAccent ? Colors.white : colors.text,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              for (final h in _headers)
                Expanded(
                  child: Text(
                    h,
                    textAlign: TextAlign.center,
                    style: AppText.sans(
                      size: 8,
                      weight: FontWeight.w800,
                      color: colors.textDim,
                    ),
                  ),
                ),
            ],
          ),
        ),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 3,
          padding: EdgeInsets.zero,
          children: cells,
        ),
      ],
    );
  }
}
