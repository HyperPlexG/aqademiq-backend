import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../core/utils/date_format.dart';
import '../../../core/utils/hex_color.dart';
import '../../../data/auth/auth_repository.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/tag.dart';
import '../../../data/models/task.dart';
import '../../../data/repositories/focus_repository.dart';
import '../../../data/repositories/mood_repository.dart';
import '../../../data/repositories/tags_repository.dart';
import '../../../data/repositories/tasks_repository.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/guest_nudge_card.dart';
import '../../focus/providers/linked_task_provider.dart';
import '../providers/plan_providers.dart';
import '../providers/plan_ui_providers.dart';
import 'sheets/log_mood_sheet.dart';
import 'sheets/month_picker_sheet.dart';
import 'sheets/plan_menu.dart';
import 'sheets/quick_add_sheet.dart';
import 'sheets/reschedule_sheet.dart';
import 'sheets/task_overflow_sheet.dart';
import 'widgets/collapse_head.dart';
import 'widgets/plan_date_strip.dart';
import 'widgets/plan_header.dart';
import 'widgets/plan_list_bits.dart';
import 'widgets/plan_task_card.dart';
import 'widgets/plan_task_expanded_card.dart';

/// PLAN_TIMELINE and its state variants (FRAMES `plan-timeline`, `plan-list`,
/// `plan-breakdown`, `plan-anytime/planned-collapsed`, `plan-otherday`).
class PlanScreen extends ConsumerStatefulWidget {
  const PlanScreen({super.key});

  @override
  ConsumerState<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends ConsumerState<PlanScreen> {
  bool _anytimeOpen = true;
  bool _plannedOpen = true;

  Future<void> _add() async {
    final result = await showQuickAddSheet(context);
    if (result == null || !mounted) return;
    if (result.details) {
      ref.read(taskDraftProvider.notifier).set(result.draft);
      unawaited(context.push(Routes.addTask));
    } else {
      await _createFromDraft(result.draft);
    }
  }

  Future<void> _createFromDraft(TaskDraft draft) async {
    if (draft.title.isEmpty) return;
    final date = ref.read(selectedDateProvider);
    final tags = ref.read(tagsProvider).value ?? const <Tag>[];
    final repeat = (draft.repeat != null && draft.repeat!.frequency != RepeatFrequency.none)
        ? draft.repeat
        : null;
    final task = Task(
      id: '',
      title: draft.title,
      tagId: tags.isNotEmpty ? tags.first.id : 'cc401',
      date: date,
      dayPart: draft.dayPart ?? DayPart.anytime,
      durationMin: 30,
      repeat: repeat,
    );
    await ref.read(tasksRepositoryProvider).create(task);
    ref.invalidate(dayTasksProvider);
  }

  /// Open the full Add-task form pre-bucketed to [part] (list-view group "+").
  void _addToBucket(DayPart part) {
    ref.read(taskDraftProvider.notifier).set(TaskDraft(dayPart: part));
    unawaited(context.push(Routes.addTask));
  }

  Future<void> _menu() async {
    final result = await showPlanMenu(context);
    if (!mounted || result == null) return;
    switch (result) {
      case PlanMenuResult.reschedule:
        await showRescheduleSheet(context);
      case PlanMenuResult.logMood:
        final mood = await showLogMoodSheet(context);
        if (mood != null) {
          await ref.read(moodRepositoryProvider).log(
                date: ref.read(selectedDateProvider),
                phase: MoodPhase.adhoc,
                mood: mood,
              );
          ref.invalidate(moodWeekProvider);
        }
      case PlanMenuResult.groupingList:
        ref.read(planViewModeProvider.notifier).set(PlanViewMode.list);
      case PlanMenuResult.groupingTimeline:
        ref.read(planViewModeProvider.notifier).set(PlanViewMode.timeline);
    }
  }

  Future<void> _pickMonth() async {
    final date = await showMonthPicker(context, selected: ref.read(selectedDateProvider));
    if (date != null && mounted) ref.read(selectedDateProvider.notifier).select(date);
  }

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(selectedDateProvider);
    final tasksAsync = ref.watch(dayTasksProvider);
    final tagsById = ref.watch(tagsByIdProvider).value ?? const <String, Tag>{};
    final guest = ref.watch(isGuestProvider);
    final viewMode = ref.watch(planViewModeProvider);
    final expandedId = ref.watch(expandedTaskProvider);
    final dateCtrl = ref.read(selectedDateProvider.notifier);

    return AppScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PlanHeader(
            date: selected,
            isToday: AppDate.sameDay(selected, AppDate.today()),
            guest: guest,
            onMonthTap: _pickMonth,
            onToday: dateCtrl.goToToday,
            onMenu: _menu,
            onAdd: _add,
          ),
          PlanDateStrip(
            selected: selected,
            today: AppDate.today(),
            onSelect: dateCtrl.select,
          ),
          if (guest) ...[
            GuestNudgeCard(
              body: 'Set up so Ada can plan your week & track stats.',
              ctaLabel: 'Set up now · 2 min →',
              onCta: () => context.go(Routes.obReferral),
            ),
            const SizedBox(height: 10),
          ],
          Expanded(
            child: tasksAsync.when(
              loading: () => const _PlanLoading(),
              error: (e, _) => _PlanError(onRetry: () => ref.invalidate(dayTasksProvider)),
              data: (tasks) {
                if (tasks.isEmpty) {
                  return _OtherDayEmpty(onAdd: _add);
                }
                if (viewMode == PlanViewMode.list) {
                  return _PlanListGrouped(tasks: tasks, tagsById: tagsById, onToggleDone: _toggleDone, onAddBucket: _addToBucket);
                }
                return _PlanTimeline(
                  tasks: tasks,
                  tagsById: tagsById,
                  anytimeOpen: _anytimeOpen,
                  plannedOpen: _plannedOpen,
                  expandedId: expandedId,
                  onToggleAnytime: () => setState(() => _anytimeOpen = !_anytimeOpen),
                  onTogglePlanned: () => setState(() => _plannedOpen = !_plannedOpen),
                  onToggleDone: _toggleDone,
                  onExpand: (t) => ref.read(expandedTaskProvider.notifier).toggle(t.id),
                  onLater: _later,
                  onDelete: _delete,
                  onOverflow: _overflow,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _toggleDone(Task t) => ref.read(dayTasksProvider.notifier).toggleDone(t);

  void _delete(Task t) => unawaited(ref.read(dayTasksProvider.notifier).delete(t));

  void _later(Task t) => _moveToTomorrow(t);

  void _moveToTomorrow(Task t) {
    final next = ref.read(selectedDateProvider).add(const Duration(days: 1));
    unawaited(ref.read(dayTasksProvider.notifier).move(t, next));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Moved "${t.title}" to tomorrow')),
    );
  }

  Future<void> _reschedule(Task t) async {
    final selected = ref.read(selectedDateProvider);
    final picked = await showDatePicker(
      context: context,
      initialDate: selected.add(const Duration(days: 1)),
      firstDate: DateTime(selected.year - 1),
      lastDate: DateTime(selected.year + 2),
    );
    if (picked != null && mounted) {
      await ref.read(dayTasksProvider.notifier).move(t, picked);
    }
  }

  void _startSession(Task t) {
    ref.read(linkedTaskProvider.notifier).set(t);
    ref.read(focusControllerProvider.notifier).configure(durationMin: t.durationMin ?? 25, taskId: t.id);
    unawaited(ref.read(focusControllerProvider.notifier).start());
    context.go(Routes.timer);
  }

  Future<void> _overflow(Task t) async {
    final tag = ref.read(tagsByIdProvider).value?[t.tagId];
    final color = tag != null ? hexColor(tag.color) : context.colors.accent;
    final action = await showTaskOverflowSheet(
      context,
      title: t.title,
      subjectCode: tag?.label ?? t.tagId,
      subjectColor: color,
    );
    if (!mounted || action == null) return;
    switch (action) {
      case TaskOverflowAction.markDone:
        _toggleDone(t);
      case TaskOverflowAction.startSession:
        _startSession(t);
      case TaskOverflowAction.reschedule:
        await _reschedule(t);
      case TaskOverflowAction.moveTomorrow:
        _moveToTomorrow(t);
      case TaskOverflowAction.breakDown:
        ref.read(expandedTaskProvider.notifier).toggle(t.id);
      case TaskOverflowAction.delete:
        _delete(t);
    }
  }
}

class _PlanTimeline extends StatelessWidget {
  const _PlanTimeline({
    required this.tasks,
    required this.tagsById,
    required this.anytimeOpen,
    required this.plannedOpen,
    required this.expandedId,
    required this.onToggleAnytime,
    required this.onTogglePlanned,
    required this.onToggleDone,
    required this.onExpand,
    required this.onLater,
    required this.onDelete,
    required this.onOverflow,
  });

  final List<Task> tasks;
  final Map<String, Tag> tagsById;
  final bool anytimeOpen;
  final bool plannedOpen;
  final String? expandedId;
  final VoidCallback onToggleAnytime;
  final VoidCallback onTogglePlanned;
  final ValueChanged<Task> onToggleDone;
  final ValueChanged<Task> onExpand;
  final ValueChanged<Task> onLater;
  final ValueChanged<Task> onDelete;
  final ValueChanged<Task> onOverflow;

  @override
  Widget build(BuildContext context) {
    final anytime = tasks.where((t) => t.startTime == null).toList();
    final planned = tasks.where((t) => t.startTime != null).toList()
      ..sort((a, b) => a.startTime!.compareTo(b.startTime!));

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        CollapseHead(label: 'ANYTIME', count: anytime.length, open: anytimeOpen, icon: Icons.schedule, onTap: onToggleAnytime),
        if (anytimeOpen)
          for (final t in anytime)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _SwipeableTask(
                task: t,
                onLater: () => onLater(t),
                onDelete: () => onDelete(t),
                onOverflow: () => onOverflow(t),
                child: PlanTaskCard(task: t, tag: tagsById[t.tagId], onToggleDone: () => onToggleDone(t)),
              ),
            ),
        const SizedBox(height: 8),
        CollapseHead(label: 'PLANNED', count: planned.length, open: plannedOpen, onTap: onTogglePlanned),
        if (plannedOpen)
          for (final t in planned) ...[
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 7),
              child: Text(
                AppDate.time12h(t.startTime!),
                style: AppText.sans(size: 11, weight: FontWeight.w800, color: context.colors.text),
              ),
            ),
            if (expandedId == t.id && t.subtasks.isNotEmpty)
              PlanTaskExpandedCard(task: t, tag: tagsById[t.tagId], onCollapse: () => onExpand(t))
            else
              _SwipeableTask(
                task: t,
                onLater: () => onLater(t),
                onDelete: () => onDelete(t),
                onOverflow: () => onOverflow(t),
                child: PlanTaskCard(
                  task: t,
                  tag: tagsById[t.tagId],
                  showBar: true,
                  onToggleDone: () => onToggleDone(t),
                  onTap: t.subtasks.isNotEmpty ? () => onExpand(t) : null,
                ),
              ),
          ],
      ],
    );
  }
}

/// Wraps a task row with swipe-to-reveal Later/Delete (FRAMES `task-swipe`) and
/// long-press → action sheet (FRAMES `task-overflow`).
class _SwipeableTask extends StatelessWidget {
  const _SwipeableTask({
    required this.task,
    required this.child,
    required this.onLater,
    required this.onDelete,
    required this.onOverflow,
  });

  final Task task;
  final Widget child;
  final VoidCallback onLater;
  final VoidCallback onDelete;
  final VoidCallback onOverflow;

  @override
  Widget build(BuildContext context) {
    return Slidable(
      key: ValueKey(task.id),
      endActionPane: ActionPane(
        motion: const DrawerMotion(),
        extentRatio: 0.46,
        children: [
          SlidableAction(
            onPressed: (_) => onLater(),
            backgroundColor: context.colors.warn,
            foregroundColor: Colors.white,
            icon: Icons.event,
            label: 'Later',
          ),
          SlidableAction(
            onPressed: (_) => onDelete(),
            backgroundColor: const Color(0xFFE85476),
            foregroundColor: Colors.white,
            icon: Icons.delete_outline,
            label: 'Delete',
          ),
        ],
      ),
      child: GestureDetector(onLongPress: onOverflow, child: child),
    );
  }
}

/// plan-list: tasks bucketed by time-of-day (via the shared [taskBucket] seam)
/// with tinted, collapsible group heads and a per-group add (PLAN-3 / PLAN-4).
class _PlanListGrouped extends ConsumerWidget {
  const _PlanListGrouped({
    required this.tasks,
    required this.tagsById,
    required this.onToggleDone,
    required this.onAddBucket,
  });

  final List<Task> tasks;
  final Map<String, Tag> tagsById;
  final ValueChanged<Task> onToggleDone;
  final ValueChanged<DayPart> onAddBucket;

  static const List<DayPart> _order = [DayPart.anytime, DayPart.morning, DayPart.afternoon, DayPart.evening];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final collapsed = ref.watch(collapsedGroupsProvider);
    final meta = <DayPart, (IconData, String, Color?)>{
      DayPart.anytime: (Icons.schedule, 'ANYTIME', null),
      DayPart.morning: (Icons.wb_twilight, 'MORNING', colors.warn),
      DayPart.afternoon: (Icons.wb_sunny, 'AFTERNOON', colors.accent),
      DayPart.evening: (Icons.nights_stay, 'EVENING', colors.success),
    };
    final groups = {for (final p in _order) p: <Task>[]};
    for (final t in tasks) {
      groups[taskBucket(t)]!.add(t);
    }

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        for (final part in _order)
          if (groups[part]!.isNotEmpty) ...[
            ListGroupHead(
              icon: meta[part]!.$1,
              label: meta[part]!.$2,
              count: groups[part]!.length,
              tint: meta[part]!.$3,
              onTap: () => ref.read(collapsedGroupsProvider.notifier).toggle(part),
              onAdd: () => onAddBucket(part),
            ),
            if (!collapsed.contains(part))
              for (final t in groups[part]!)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: PlanTaskCard(task: t, tag: tagsById[t.tagId], showBar: part != DayPart.anytime, onToggleDone: () => onToggleDone(t)),
                ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

/// plan-otherday: a day with empty buckets + an add affordance (Today pill is in
/// the header when not viewing today).
class _OtherDayEmpty extends StatelessWidget {
  const _OtherDayEmpty({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        const CollapseHead(label: 'ANYTIME', count: 0, open: true, icon: Icons.schedule),
        AddRow(onTap: onAdd),
        const SizedBox(height: 8),
        const CollapseHead(label: 'PLANNED', count: 0, open: true),
        AddRow(label: 'Add a planned task', onTap: onAdd),
      ],
    );
  }
}

class _PlanLoading extends StatelessWidget {
  const _PlanLoading();

  @override
  Widget build(BuildContext context) {
    return Center(child: CircularProgressIndicator(color: context.colors.accent, strokeWidth: 2.5));
  }
}

class _PlanError extends StatelessWidget {
  const _PlanError({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_rounded, size: 40, color: colors.textDim),
          const SizedBox(height: 12),
          Text("Couldn't load your day", style: AppText.sans(size: 14, weight: FontWeight.w800, color: colors.text)),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
