import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';

/// The action the user picked from the Plan overflow (`···`) popover.
enum PlanMenuResult {
  /// "Reschedule tasks" → opens the reschedule-remaining review.
  reschedule,

  /// "Log mood" → opens the mood check-in sheet.
  logMood,

  /// Grouping options → "List" grouping.
  groupingList,

  /// Grouping options → "Timeline" grouping (current selection).
  groupingTimeline,
}

/// Presents the per-day Plan overflow menu (`plan-menu` / `plan-grouping`): a
/// 220-wide white popover anchored to the top-right, dropped from the `···`
/// button. The "Grouping options" header expands to reveal List / Timeline.
///
/// Returns the chosen [PlanMenuResult], or `null` when dismissed.
Future<PlanMenuResult?> showPlanMenu(BuildContext context) {
  return showDialog<PlanMenuResult>(
    context: context,
    barrierColor: const Color(0x2E140F1C),
    builder: (_) => const _PlanMenuPopover(),
  );
}

class _PlanMenuPopover extends StatefulWidget {
  const _PlanMenuPopover();

  @override
  State<_PlanMenuPopover> createState() => _PlanMenuPopoverState();
}

class _PlanMenuPopoverState extends State<_PlanMenuPopover> {
  bool _groupingOpen = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Align(
      alignment: Alignment.topRight,
      child: Padding(
        padding: const EdgeInsets.only(top: 40, right: 12),
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: 220,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x2E000000),
                  blurRadius: 44,
                  offset: Offset(0, 14),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _MenuRow(
                  icon: Icons.event_note,
                  label: 'Reschedule tasks',
                  onTap: () =>
                      Navigator.of(context).pop(PlanMenuResult.reschedule),
                ),
                _MenuRow(
                  icon: Icons.favorite_border,
                  label: 'Log mood',
                  onTap: () =>
                      Navigator.of(context).pop(PlanMenuResult.logMood),
                ),
                _GroupingHeader(
                  open: _groupingOpen,
                  onTap: () =>
                      setState(() => _groupingOpen = !_groupingOpen),
                ),
                if (_groupingOpen) ...[
                  Container(
                    height: 1,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: colors.border,
                  ),
                  _GroupingOption(
                    icon: Icons.format_list_bulleted,
                    label: 'List',
                    selected: false,
                    onTap: () => Navigator.of(context)
                        .pop(PlanMenuResult.groupingList),
                  ),
                  _GroupingOption(
                    icon: Icons.view_agenda,
                    label: 'Timeline',
                    selected: true,
                    onTap: () => Navigator.of(context)
                        .pop(PlanMenuResult.groupingTimeline),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A default popover action row (icon + label).
class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        child: Row(
          children: [
            Icon(icon, size: 19, color: colors.text),
            const SizedBox(width: 13),
            Text(
              label,
              style: AppText.sans(size: 14, color: colors.text),
            ),
          ],
        ),
      ),
    );
  }
}

/// The "Grouping options" header row that toggles the expanded group.
class _GroupingHeader extends StatelessWidget {
  const _GroupingHeader({required this.open, required this.onTap});

  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Grouping options',
              style: AppText.sans(
                size: 14,
                weight: FontWeight.w800,
                color: colors.text,
              ),
            ),
            Icon(
              open ? Icons.expand_more : Icons.chevron_right,
              size: 18,
              color: colors.text,
            ),
          ],
        ),
      ),
    );
  }
}

/// A grouping choice inside the expanded group ("List" / "Timeline").
class _GroupingOption extends StatelessWidget {
  const _GroupingOption({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        child: Row(
          children: [
            if (selected) ...[
              Icon(Icons.check, size: 18, color: colors.accent),
              const SizedBox(width: 12),
            ],
            Icon(icon, size: 19, color: colors.text),
            const SizedBox(width: 12),
            Text(
              label,
              style: AppText.sans(
                size: 14,
                weight: selected ? FontWeight.w800 : FontWeight.w600,
                color: colors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
