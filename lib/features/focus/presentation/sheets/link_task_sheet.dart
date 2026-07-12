import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/hex_color.dart';
import '../../../../data/models/tag.dart';
import '../../../../data/models/task.dart';
import '../../../../data/repositories/tags_repository.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../plan/providers/plan_providers.dart';

/// Result of the `fc-link` sheet: the chosen [Task], or `task: null` for "Focus
/// without a task". The outer Future is `null` only when dismissed.
typedef LinkTaskResult = ({Task? task});

/// Unselected trailing radio / unchecked color (prototype literal `#cfcbc4`).
const _uncheckedColor = Color(0xFFCFCBC4);

/// Presents the "Link a task" sheet (`fc-link`) over the dimmed Focus setup.
/// Lists the selected day's real tasks plus "Focus without a task"; the CTA pops
/// the selection. Returns `null` when dismissed.
Future<LinkTaskResult?> showLinkTaskSheet(BuildContext context) {
  return showModalBottomSheet<LinkTaskResult>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x66140F1C),
    isScrollControlled: true,
    builder: (_) => const _LinkTaskSheet(),
  );
}

class _LinkTaskSheet extends ConsumerStatefulWidget {
  const _LinkTaskSheet();

  @override
  ConsumerState<_LinkTaskSheet> createState() => _LinkTaskSheetState();
}

class _LinkTaskSheetState extends ConsumerState<_LinkTaskSheet> {
  String? _selectedId;
  bool _noTask = false;

  void _link(List<Task> tasks) {
    Task? selected;
    if (!_noTask) {
      final id = _selectedId ?? (tasks.isNotEmpty ? tasks.first.id : null);
      for (final t in tasks) {
        if (t.id == id) selected = t;
      }
    }
    Navigator.of(context).pop((task: selected));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tasks = ref.watch(dayTasksProvider).value ?? const <Task>[];
    final tagsById = ref.watch(tagsByIdProvider).value ?? const <String, Tag>{};
    final effectiveId = _selectedId ?? (tasks.isNotEmpty ? tasks.first.id : null);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        boxShadow: colors.sheetShadow,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(0, 10, 0, 18),
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
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Link a task', style: AppText.sans(size: 18, weight: FontWeight.w800, color: colors.text)),
                    const SizedBox(height: 2),
                    Text('Optional — track this session against a task', style: AppText.sans(size: 11, color: colors.textMed)),
                  ],
                ),
              ),
              _NoTaskRow(
                selected: _noTask,
                onTap: () => setState(() => _noTask = true),
              ),
              if (tasks.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 11, 18, 5),
                  child: Text(
                    'TODAY',
                    style: AppText.sans(size: 9, weight: FontWeight.w800, letterSpacing: AppText.em(0.08, 9), color: colors.textDim),
                  ),
                ),
              for (final t in tasks)
                _TaskRow(
                  task: t,
                  tag: tagsById[t.tagId],
                  selected: !_noTask && t.id == effectiveId,
                  onTap: () => setState(() {
                    _noTask = false;
                    _selectedId = t.id;
                  }),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                child: PrimaryButton(label: 'Link task', onPressed: () => _link(tasks)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NoTaskRow extends StatelessWidget {
  const _NoTaskRow({required this.selected, required this.onTap});

  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        decoration: BoxDecoration(
          border: Border.symmetric(horizontal: BorderSide(color: colors.border)),
        ),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
              child: Icon(Icons.do_not_disturb_on, size: 17, color: colors.textMed),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text('Focus without a task', style: AppText.sans(size: 12.5, weight: FontWeight.w700, color: colors.text)),
            ),
            Icon(
              selected ? Icons.check_circle : Icons.radio_button_unchecked,
              size: 19,
              color: selected ? colors.accent : _uncheckedColor,
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task, required this.tag, required this.selected, required this.onTap});

  final Task task;
  final Tag? tag;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = tag != null ? hexColor(tag!.color) : colors.accent;
    final meta = '${tag?.label ?? task.tagId} · ${task.durationMin ?? 0}m';
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
        color: selected ? colors.accentSoft : Colors.transparent,
        child: Row(
          children: [
            Container(width: 9, height: 9, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.title, style: AppText.sans(size: 12.5, weight: FontWeight.w700, color: colors.text)),
                  const SizedBox(height: 1),
                  Text(meta, style: AppText.sans(size: 10, color: colors.textDim)),
                ],
              ),
            ),
            Icon(
              selected ? Icons.check_circle : Icons.radio_button_unchecked,
              size: 19,
              color: selected ? colors.accent : _uncheckedColor,
            ),
          ],
        ),
      ),
    );
  }
}
