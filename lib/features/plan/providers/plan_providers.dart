import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/date_format.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/task.dart';
import '../../../data/repositories/tasks_repository.dart';

/// The day currently shown on the Plan timeline (defaults to the demo "today").
final selectedDateProvider =
    NotifierProvider<SelectedDateController, DateTime>(SelectedDateController.new);

class SelectedDateController extends Notifier<DateTime> {
  @override
  DateTime build() => AppDate.today();

  void select(DateTime date) => state = DateTime(date.year, date.month, date.day);

  void goToToday() => state = AppDate.today();
}

/// Coarse bucket a task belongs to — derived from its [Task.startTime] when set,
/// otherwise its [Task.dayPart]. Single source of truth for grouping so the
/// timeline and list views never disagree (PLAN-1).
DayPart taskBucket(Task t) {
  final start = t.startTime;
  if (start != null) {
    if (start.hour < 12) return DayPart.morning;
    if (start.hour < 17) return DayPart.afternoon;
    return DayPart.evening;
  }
  return t.dayPart ?? DayPart.anytime;
}

/// Tasks for the selected day, as `AsyncValue<List<Task>>` (loading/error/data
/// for free). Re-runs whenever [selectedDateProvider] changes.
final dayTasksProvider =
    AsyncNotifierProvider<DayTasksController, List<Task>>(DayTasksController.new);

class DayTasksController extends AsyncNotifier<List<Task>> {
  @override
  Future<List<Task>> build() {
    final date = ref.watch(selectedDateProvider);
    return ref.watch(tasksRepositoryProvider).tasksForDay(date);
  }

  /// Optimistically flip a task's done state, rolling back on failure
  /// (README §7: "optimistic updates for toggles").
  Future<void> toggleDone(Task task) async {
    final previous = state.value ?? const <Task>[];
    final next = task.copyWith(done: !task.done);
    state = AsyncData([
      for (final t in previous) if (t.id == task.id) next else t,
    ]);
    try {
      await ref.read(tasksRepositoryProvider).update(next);
      ref.invalidate(weeklyCompletedProvider);
    } on Object catch (_) {
      state = AsyncData(previous);
    }
  }

  /// Move a task to another day — it leaves the current day's list.
  Future<void> move(Task task, DateTime newDate) async {
    final previous = state.value ?? const <Task>[];
    state = AsyncData([for (final t in previous) if (t.id != task.id) t]);
    try {
      await ref.read(tasksRepositoryProvider).move(task, newDate);
      ref.invalidate(weeklyCompletedProvider);
    } on Object catch (_) {
      state = AsyncData(previous);
    }
  }

  /// Optimistically remove a task (swipe-to-delete / overflow Delete).
  Future<void> delete(Task task) async {
    final previous = state.value ?? const [];
    state = AsyncData([for (final t in previous) if (t.id != task.id) t]);
    try {
      await ref.read(tasksRepositoryProvider).delete(task.id);
      ref.invalidate(weeklyCompletedProvider);
    } on Object catch (_) {
      state = AsyncData(previous);
    }
  }
}

/// Completed-task count for the selected week — drives the Stats "COMPLETED"
/// tile so ticking a task updates it (STA-4). Recomputed on week change and
/// invalidated by the task mutations above.
final weeklyCompletedProvider = FutureProvider<int>((ref) {
  final date = ref.watch(selectedDateProvider);
  return ref.watch(tasksRepositoryProvider).completedThisWeek(date);
});
