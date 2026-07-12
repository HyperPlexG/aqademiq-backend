import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/hex_color.dart';
import '../../../../data/models/tag.dart';
import '../../../../data/models/task.dart';

/// A single task row (prototype `PlanTask`): optional left color bar, title,
/// inline tag + duration, and a tappable done circle. The inline tag is a
/// borderless dot + colored label (not the bordered `TagChip`).
class PlanTaskCard extends StatelessWidget {
  const PlanTaskCard({
    super.key,
    required this.task,
    this.tag,
    this.showBar = false,
    this.onToggleDone,
    this.onTap,
  });

  final Task task;
  final Tag? tag;
  final bool showBar;
  final VoidCallback? onToggleDone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tagColor = tag != null ? hexColor(tag!.color) : colors.accent;
    final tagLabel = tag?.label ?? task.tagId;

    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: task.done ? 0.5 : 1,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            boxShadow: colors.cardShadow,
          ),
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 13),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (showBar) ...[
                  Container(
                    width: 4,
                    decoration: BoxDecoration(
                      color: tagColor,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 11),
                ],
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: AppText.sans(
                          size: 13,
                          weight: FontWeight.w800,
                          height: 1.25,
                          color: colors.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          _InlineTag(label: tagLabel, color: tagColor),
                          if (task.durationMin != null)
                            Text(
                              '${task.durationMin}m',
                              style: AppText.sans(
                                size: 10.5,
                                color: colors.textDim,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 11),
                Center(
                  child: _DoneCircle(done: task.done, onTap: onToggleDone),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InlineTag extends StatelessWidget {
  const _InlineTag({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppText.sans(size: 9.5, weight: FontWeight.w800, color: color),
        ),
      ],
    );
  }
}

class _DoneCircle extends StatelessWidget {
  const _DoneCircle({required this.done, this.onTap});
  final bool done;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: done ? colors.accent : Colors.transparent,
          border: Border.all(
            color: done ? colors.accent : const Color(0xFFD6D3CE),
            width: 2,
          ),
        ),
        child: done
            ? Text(
                '✓',
                style: AppText.sans(
                  size: 11,
                  weight: FontWeight.w800,
                  color: Colors.white,
                ),
              )
            : null,
      ),
    );
  }
}
