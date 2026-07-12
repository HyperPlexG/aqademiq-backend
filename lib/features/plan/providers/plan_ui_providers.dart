import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/enums.dart';
import '../../../data/models/task.dart';

/// How the Plan timeline is grouped (prototype plan-timeline vs plan-list).
enum PlanViewMode { timeline, list }

/// A pending task draft handed from Quick-add to the full Add-task form so the
/// typed title / time-of-day / repeat survive the "More" hop (PLAN-8).
class TaskDraft {
  const TaskDraft({this.title = '', this.dayPart, this.repeat});

  final String title;
  final DayPart? dayPart;
  final RepeatRule? repeat;
}

final taskDraftProvider =
    NotifierProvider<TaskDraftController, TaskDraft?>(TaskDraftController.new);

class TaskDraftController extends Notifier<TaskDraft?> {
  @override
  TaskDraft? build() => null;

  void set(TaskDraft draft) => state = draft;

  /// Read once and clear — the Add-task form consumes it on open.
  TaskDraft? take() {
    final draft = state;
    state = null;
    return draft;
  }
}

/// Which list-view buckets are collapsed (by [DayPart]). Tapping a group head
/// toggles membership (PLAN-3, list view).
final collapsedGroupsProvider =
    NotifierProvider<CollapsedGroupsController, Set<DayPart>>(CollapsedGroupsController.new);

class CollapsedGroupsController extends Notifier<Set<DayPart>> {
  @override
  Set<DayPart> build() => <DayPart>{};

  void toggle(DayPart part) {
    final next = {...state};
    if (!next.add(part)) next.remove(part);
    state = next;
  }
}

final planViewModeProvider =
    NotifierProvider<PlanViewModeController, PlanViewMode>(PlanViewModeController.new);

class PlanViewModeController extends Notifier<PlanViewMode> {
  @override
  PlanViewMode build() => PlanViewMode.timeline;

  void set(PlanViewMode mode) => state = mode;
}

/// The id of the planned task currently expanded into its microtasks
/// (prototype plan-breakdown). Null = none expanded.
final expandedTaskProvider =
    NotifierProvider<ExpandedTaskController, String?>(ExpandedTaskController.new);

class ExpandedTaskController extends Notifier<String?> {
  @override
  String? build() => null;

  void toggle(String id) => state = state == id ? null : id;
}
