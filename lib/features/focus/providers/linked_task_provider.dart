import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/task.dart';

/// The Plan task linked to the current focus session — drives the fc-set chip
/// and lets the session mark the task done when it completes (FOC-3). Null is an
/// ad-hoc (unlinked) session.
final linkedTaskProvider =
    NotifierProvider<LinkedTaskController, Task?>(LinkedTaskController.new);

class LinkedTaskController extends Notifier<Task?> {
  @override
  Task? build() => null;

  void set(Task? task) => state = task;
  void clear() => state = null;
}
