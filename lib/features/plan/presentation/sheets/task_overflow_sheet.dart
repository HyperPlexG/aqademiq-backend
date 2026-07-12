import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';

/// The six in-place task operations offered by the task-overflow action sheet
/// (section-09). Each action row pops one of these from the sheet.
enum TaskOverflowAction {
  markDone,
  startSession,
  reschedule,
  breakDown,
  moveTomorrow,
  delete,
}

/// Presents the task-overflow bottom action sheet (long-press on a Plan task).
///
/// Resolves to the [TaskOverflowAction] the user tapped, or `null` if dismissed
/// (tap scrim / grabber). The sheet shows a task header (subject dot + code,
/// title, subtitle) above six action rows.
Future<TaskOverflowAction?> showTaskOverflowSheet(
  BuildContext context, {
  required String title,
  required String subjectCode,
  required Color subjectColor,
  String subtitle = '35 min · Ada generated · 3 microtasks',
}) {
  return showModalBottomSheet<TaskOverflowAction>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x4C140F1C),
    builder: (_) => _TaskOverflowSheet(
      title: title,
      subjectCode: subjectCode,
      subjectColor: subjectColor,
      subtitle: subtitle,
    ),
  );
}

class _TaskOverflowSheet extends StatelessWidget {
  const _TaskOverflowSheet({
    required this.title,
    required this.subjectCode,
    required this.subjectColor,
    required this.subtitle,
  });

  final String title;
  final String subjectCode;
  final Color subjectColor;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x2E000000),
            blurRadius: 40,
            offset: Offset(0, -8),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(0, 10, 0, 18),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0DDD7),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            _TaskHeader(
              title: title,
              subjectCode: subjectCode,
              subjectColor: subjectColor,
              subtitle: subtitle,
            ),
            const _ActionRow(
              icon: Icons.check_circle_outline,
              label: 'Mark as done',
              action: TaskOverflowAction.markDone,
            ),
            _ActionRow(
              icon: Icons.timer_outlined,
              label: 'Start session',
              action: TaskOverflowAction.startSession,
              color: colors.accent,
            ),
            const _ActionRow(
              icon: Icons.event_outlined,
              label: 'Reschedule',
              action: TaskOverflowAction.reschedule,
            ),
            const _ActionRow(
              icon: Icons.auto_awesome_outlined,
              label: 'Break down more',
              action: TaskOverflowAction.breakDown,
            ),
            const _ActionRow(
              icon: Icons.arrow_forward,
              label: 'Move to tomorrow',
              action: TaskOverflowAction.moveTomorrow,
            ),
            const _ActionRow(
              icon: Icons.delete_outline,
              label: 'Delete',
              action: TaskOverflowAction.delete,
              color: Color(0xFFE85476),
              last: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskHeader extends StatelessWidget {
  const _TaskHeader({
    required this.title,
    required this.subjectCode,
    required this.subjectColor,
    required this.subtitle,
  });

  final String title;
  final String subjectCode;
  final Color subjectColor;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: subjectColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  subjectCode,
                  style: AppText.sans(
                    size: 9,
                    weight: FontWeight.w800,
                    color: subjectColor,
                  ),
                ),
              ],
            ),
          ),
          Text(
            title,
            style: AppText.sans(
              size: 15,
              weight: FontWeight.w700,
              color: colors.text,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              subtitle,
              style: AppText.sans(size: 11, color: colors.textDim),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.action,
    this.color,
    this.last = false,
  });

  final IconData icon;
  final String label;
  final TaskOverflowAction action;
  final Color? color;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tint = color ?? colors.text;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).pop(action),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          border: last ? null : Border(bottom: BorderSide(color: colors.border)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: tint),
            const SizedBox(width: 14),
            Text(
              label,
              style: AppText.sans(size: 13, color: tint),
            ),
          ],
        ),
      ),
    );
  }
}
