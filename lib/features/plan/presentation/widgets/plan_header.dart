import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/date_format.dart';
import '../../../../shared/widgets/guest_badge.dart';

/// PLAN_TIMELINE header: day + month (calendar button), and the action capsule
/// (overflow ··· and add +). A "Today" pill appears when viewing another day.
class PlanHeader extends StatelessWidget {
  const PlanHeader({
    super.key,
    required this.date,
    required this.isToday,
    this.guest = false,
    this.onMonthTap,
    this.onToday,
    this.onMenu,
    this.onAdd,
  });

  final DateTime date;
  final bool isToday;
  final bool guest;
  final VoidCallback? onMonthTap;
  final VoidCallback? onToday;
  final VoidCallback? onMenu;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onMonthTap,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppDate.weekdayFull(date),
                    style: AppText.sans(
                      size: 15,
                      weight: FontWeight.w800,
                      letterSpacing: -0.3,
                      height: 1.1,
                      color: colors.text,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          AppDate.monthYearUpper(date),
                          style: AppText.sans(
                            size: 9.5,
                            weight: FontWeight.w800,
                            letterSpacing: AppText.em(0.04, 9.5),
                            color: colors.textMed,
                          ),
                        ),
                        Icon(Icons.chevron_right, size: 11, color: colors.textMed),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (!isToday) ...[
            _TodayPill(onTap: onToday),
            const SizedBox(width: 7),
          ],
          if (guest) ...[
            const GuestBadge(),
            const SizedBox(width: 7),
          ],
          _ActionCapsule(onMenu: onMenu, onAdd: onAdd),
        ],
      ),
    );
  }
}

class _TodayPill extends StatelessWidget {
  const _TodayPill({this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 15),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          boxShadow: colors.cardShadow,
        ),
        child: Text(
          'Today',
          style: AppText.sans(size: 12.5, weight: FontWeight.w800, color: colors.text),
        ),
      ),
    );
  }
}

class _ActionCapsule extends StatelessWidget {
  const _ActionCapsule({this.onMenu, this.onAdd});
  final VoidCallback? onMenu;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        boxShadow: colors.cardShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _CircleTap(
            onTap: onMenu,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Text(
                '···',
                style: AppText.sans(
                  size: 17,
                  weight: FontWeight.w800,
                  letterSpacing: 0.5,
                  height: 1,
                  color: colors.text,
                ),
              ),
            ),
          ),
          const SizedBox(width: 2),
          _CircleTap(
            onTap: onAdd,
            child: Icon(Icons.add, size: 21, color: colors.text),
          ),
        ],
      ),
    );
  }
}

class _CircleTap extends StatelessWidget {
  const _CircleTap({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(width: 30, height: 30, child: Center(child: child)),
    );
  }
}
