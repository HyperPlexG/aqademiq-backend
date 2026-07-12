import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env/env.dart';
import '../../core/network/dio_client.dart';
import '../adapters/adapters.dart';
import '../models/task.dart';
import '../sources/tasks_source.dart';

/// Repository for tasks. Picks the source via [Env.useMocks] (seam 3) and
/// exposes UI [Task] models via adapters (seam 2). Widgets read this through a
/// provider only (seam 1).
class TasksRepository {
  TasksRepository(this._source);

  final TasksSource _source;

  Future<List<Task>> tasksForDay(DateTime date) async {
    final dtos = await _source.tasksForDay(date);
    return dtos.map((d) => d.toModel()).toList(growable: false);
  }

  Future<Task> create(Task draft) async {
    final dto = await _source.create(draft.toDto());
    return dto.toModel();
  }

  Future<Task> update(Task task) async {
    final dto = await _source.update(task.toDto());
    return dto.toModel();
  }

  /// Move a task to another day (the source re-keys it by date).
  Future<Task> move(Task task, DateTime newDate) async {
    final dto = await _source.move(task.id, newDate);
    return dto.toModel();
  }

  Future<void> delete(String id) => _source.delete(id);

  Future<int> completedThisWeek(DateTime around) =>
      _source.completedThisWeek(around);
}

final tasksRepositoryProvider = Provider<TasksRepository>((ref) {
  final source = Env.useMocks
      ? MockTasksSource()
      : ApiTasksSource(ref.watch(dioProvider));
  return TasksRepository(source);
});
