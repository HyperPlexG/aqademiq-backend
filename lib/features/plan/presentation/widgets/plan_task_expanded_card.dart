import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/date_format.dart';
import '../../../../core/utils/hex_color.dart';
import '../../../../data/models/tag.dart';
import '../../../../data/models/task.dart';

/// FRAMES `plan-breakdown` — a planned task expanded into Ada microtasks, with a
/// progress header and a connector-rail subtask list.
class PlanTaskExpandedCard extends StatelessWidget {
  const PlanTaskExpandedCard({
    super.key,
    required this.task,
    this.tag,
    this.onCollapse,
  });

  final Task task;
  final Tag? tag;
  final VoidCallback? onCollapse;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = tag != null ? hexColor(tag!.color) : colors.accent;
    final subtasks = task.subtasks;
    final doneCount = subtasks.where((s) => s.done).length;
    final total = subtasks.isEmpty ? 1 : subtasks.length;
    final progress = doneCount / total;

    return GestureDetector(
      onTap: onCollapse,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          boxShadow: colors.cardShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 4, color: color),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(0, 11, 13, 9),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(task.title, style: AppText.sans(size: 13, weight: FontWeight.w800, color: colors.text)),
                              _AdaBadge(steps: subtasks.length),
                            ],
                          ),
                          const SizedBox(height: 5),
                          Row(
                            children: [
                              if (task.startTime != null) ...[
                                Text(AppDate.time12h(task.startTime!), style: AppText.sans(size: 10, weight: FontWeight.w800, color: colors.text)),
                                const SizedBox(width: 8),
                              ],
                              Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                              const SizedBox(width: 4),
                              Text(tag?.label ?? task.tagId, style: AppText.sans(size: 9.5, weight: FontWeight.w800, color: color)),
                              if (task.durationMin != null) ...[
                                const SizedBox(width: 8),
                                Text('${task.durationMin}m', style: AppText.sans(size: 10.5, color: colors.textDim)),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: 13, top: 11),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text.rich(
                          TextSpan(
                            text: '$doneCount',
                            style: AppText.sans(size: 13, weight: FontWeight.w800, color: colors.accent, height: 1),
                            children: [
                              TextSpan(text: '/${subtasks.length}', style: AppText.sans(size: 13, weight: FontWeight.w800, color: colors.textDim, height: 1)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text('DONE', style: AppText.sans(size: 7.5, weight: FontWeight.w800, letterSpacing: AppText.em(0.06, 7.5), color: colors.textDim)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 13),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 3,
                  backgroundColor: colors.bg,
                  valueColor: AlwaysStoppedAnimation(colors.accent),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 14, 10),
              child: Column(
                children: [
                  for (var i = 0; i < subtasks.length; i++)
                    _MicrotaskRow(
                      subtask: subtasks[i],
                      isFirst: i == 0,
                      isLast: i == subtasks.length - 1,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdaBadge extends StatelessWidget {
  const _AdaBadge({required this.steps});
  final int steps;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: colors.accentSoft, borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('✦', style: TextStyle(fontSize: 9, color: colors.accent, height: 1)),
          const SizedBox(width: 3),
          Text('Ada · $steps steps', style: AppText.sans(size: 8.5, weight: FontWeight.w800, color: colors.accent)),
        ],
      ),
    );
  }
}

class _MicrotaskRow extends StatelessWidget {
  const _MicrotaskRow({required this.subtask, required this.isFirst, required this.isLast});
  final Subtask subtask;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final done = subtask.done;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 16,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Positioned(
                  top: isFirst ? null : 0,
                  bottom: isLast ? null : 0,
                  child: Container(width: 1.5, height: isFirst || isLast ? null : double.infinity, color: colors.border),
                ),
                Container(
                  width: 15,
                  height: 15,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: done ? colors.accent : colors.surface,
                    border: Border.all(color: done ? colors.accent : const Color(0xFFCFCBC4), width: 1.5),
                    boxShadow: [BoxShadow(color: colors.surface, spreadRadius: 3)],
                  ),
                  child: done ? const Icon(Icons.check, size: 8, color: Colors.white) : null,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                subtask.title,
                style: AppText.sans(
                  size: 11.5,
                  color: done ? colors.textDim : colors.text,
                ).copyWith(decoration: done ? TextDecoration.lineThrough : null),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
