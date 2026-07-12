import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'task.freezed.dart';

/// A single microtask ("Ada step") inside a [Task].
@freezed
abstract class Subtask with _$Subtask {
  const factory Subtask({
    required String id,
    required String title,
    @Default(false) bool done,
  }) = _Subtask;
}

/// How a task repeats.
@freezed
abstract class RepeatRule with _$RepeatRule {
  const factory RepeatRule({
    required RepeatFrequency frequency,
    @Default(1) int interval,
    @Default(<int>[]) List<int> weekdays, // 1=Mon … 7=Sun
  }) = _RepeatRule;
}

/// A planner task. The UI model widgets consume (mock-stable); DTO drift is
/// absorbed by `data/adapters` (README §7 seam 2).
@freezed
abstract class Task with _$Task {
  const factory Task({
    required String id,
    required String title,
    required String tagId,
    required DateTime date,
    DayPart? dayPart,
    DateTime? startTime,
    int? durationMin,
    RepeatRule? repeat,
    @Default(<Subtask>[]) List<Subtask> subtasks,
    @Default(false) bool done,
  }) = _Task;
}
