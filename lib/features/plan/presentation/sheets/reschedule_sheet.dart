import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/hex_color.dart';
import '../../../../data/models/tag.dart';
import '../../../../data/models/task.dart';
import '../../../../data/repositories/tags_repository.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../providers/plan_providers.dart';

const _weekdaysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const _monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _fmtDate(DateTime d) => '${_weekdaysFull[d.weekday - 1]}, ${d.day} ${_monthsShort[d.month - 1]}';

/// Presents the reschedule review (`plan-resched`) — a full-bleed modal listing
/// the day's remaining (incomplete) tasks. Its CTAs actually move those tasks
/// (PLAN-14 / PLAN-15). Returns `null` on dismiss.
Future<void> showRescheduleSheet(BuildContext context) {
  return showDialog<void>(
    context: context,
    barrierColor: const Color(0x47140F1C),
    builder: (_) => const _RescheduleReview(),
  );
}

class _RescheduleReview extends ConsumerWidget {
  const _RescheduleReview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final selected = ref.watch(selectedDateProvider);
    final tasks = ref.watch(dayTasksProvider).value ?? const <Task>[];
    final remaining = tasks.where((t) => !t.done).toList();
    final tagsById = ref.watch(tagsByIdProvider).value ?? const <String, Tag>{};
    final tomorrow = selected.add(const Duration(days: 1));

    Future<void> moveAll(DateTime to) async {
      final ctrl = ref.read(dayTasksProvider.notifier);
      for (final t in remaining) {
        await ctrl.move(t, to);
      }
    }

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              bottom: remaining.isEmpty ? 0 : 78,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: _CloseCircle(onTap: () => Navigator.of(context).pop()),
                    ),
                    const SizedBox(height: 4),
                    _DatePill(label: _fmtDate(selected), colors: colors),
                    const SizedBox(height: 8),
                    Text('Remaining tasks', style: AppText.sans(size: 26, weight: FontWeight.w800, color: colors.text)),
                    const SizedBox(height: 5),
                    Text(
                      remaining.isEmpty
                          ? "You're all caught up — nothing left to move."
                          : 'These are the remaining tasks. Anything you want to move to another day?',
                      style: AppText.sans(size: 12, height: 1.5, color: colors.textMed),
                    ),
                    const SizedBox(height: 14),
                    if (remaining.isNotEmpty) ...[
                      Text('Move ${remaining.length} to tomorrow?', style: AppText.sans(size: 15, weight: FontWeight.w800, color: colors.text)),
                      const SizedBox(height: 10),
                      for (var i = 0; i < remaining.length; i++)
                        Padding(
                          padding: EdgeInsets.only(bottom: i == remaining.length - 1 ? 0 : 8),
                          child: _ReviewRow(
                            task: remaining[i],
                            color: hexColor(tagsById[remaining[i].tagId]?.color ?? '#6b5cf0'),
                            colors: colors,
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ),
            if (remaining.isNotEmpty)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _StickyFooter(
                  colors: colors,
                  count: remaining.length,
                  onMoveTomorrow: () async {
                    await moveAll(tomorrow);
                    if (context.mounted) Navigator.of(context).pop();
                  },
                  onMoreOptions: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: tomorrow,
                      firstDate: DateTime(selected.year - 1),
                      lastDate: DateTime(selected.year + 2),
                    );
                    if (picked == null) return;
                    await moveAll(picked);
                    if (context.mounted) Navigator.of(context).pop();
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CloseCircle extends StatelessWidget {
  const _CloseCircle({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
        child: Text('✕', style: TextStyle(fontSize: 13, color: colors.textMed, height: 1)),
      ),
    );
  }
}

class _DatePill extends StatelessWidget {
  const _DatePill({required this.label, required this.colors});

  final String label;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 4),
      decoration: BoxDecoration(color: colors.accentSoft, borderRadius: BorderRadius.circular(AppRadius.pill)),
      child: Text(label, style: AppText.sans(size: 13, weight: FontWeight.w700, color: colors.accent)),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.task, required this.color, required this.colors});

  final Task task;
  final Color color;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    final meta = task.durationMin != null ? '${task.durationMin} min' : 'Anytime';
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: colors.ink, shape: BoxShape.circle),
          child: const Text('✓', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white, height: 1)),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(AppRadius.rowInput), boxShadow: colors.cardShadow),
            child: Row(
              children: [
                Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                const SizedBox(width: 9),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(task.title, style: AppText.sans(size: 12.5, weight: FontWeight.w800, color: colors.text)),
                      const SizedBox(height: 2),
                      Text(meta, style: AppText.sans(size: 10, color: colors.textDim)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _StickyFooter extends StatelessWidget {
  const _StickyFooter({
    required this.colors,
    required this.count,
    required this.onMoveTomorrow,
    required this.onMoreOptions,
  });

  final AppColors colors;
  final int count;
  final VoidCallback onMoveTomorrow;
  final VoidCallback onMoreOptions;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 20, offset: Offset(0, -6))],
      ),
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          PrimaryButton(label: 'Move to tomorrow ($count)', onPressed: onMoveTomorrow),
          const SizedBox(height: 8),
          PrimaryButton(label: 'More options to move ($count)', ghost: true, onPressed: onMoreOptions),
        ],
      ),
    );
  }
}
