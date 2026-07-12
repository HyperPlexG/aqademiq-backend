import 'package:dio/dio.dart';

import '../dtos/task_dto.dart';
import '../fixtures/fixtures.dart';
import 'mock_latency.dart';

/// Data source for tasks (raw DTOs). Repositories choose the impl via
/// `Env.useMocks`; widgets never see this layer.
abstract interface class TasksSource {
  Future<List<TaskDto>> tasksForDay(DateTime date);
  Future<TaskDto> create(TaskDto input);
  Future<TaskDto> update(TaskDto task);
  Future<TaskDto> move(String id, DateTime newDate);
  Future<void> delete(String id);

  /// Count of completed tasks in the Mon–Sun week containing [around].
  Future<int> completedThisWeek(DateTime around);
}

class MockTasksSource implements TasksSource {
  final Map<String, List<TaskDto>> _byDay = {
    _key(Fixtures.today): Fixtures.tasksForToday(),
  };

  static String _key(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static DateTime _dayOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  Future<List<TaskDto>> tasksForDay(DateTime date) {
    final base = List<TaskDto>.from(_byDay[_key(date)] ?? const []);
    // Expand recurring tasks stored on other days that recur onto this date.
    final recurring = <TaskDto>[];
    for (final list in _byDay.values) {
      for (final t in list) {
        if (_occursOn(t, date)) {
          recurring.add(t.copyWith(id: '${t.id}@${_key(date)}', date: _dayOnly(date), done: false));
        }
      }
    }
    return mockDelay(List<TaskDto>.unmodifiable([...base, ...recurring]));
  }

  /// Whether a recurring [base] task lands on [day] (excluding its own start
  /// day, which is already returned directly). Forward-only from the start.
  static bool _occursOn(TaskDto base, DateTime day) {
    final r = base.repeat;
    if (r == null || r.frequency == 'none') return false;
    final start = _dayOnly(base.date);
    final d = _dayOnly(day);
    if (!d.isAfter(start)) return false;
    final interval = r.interval <= 0 ? 1 : r.interval;
    switch (r.frequency) {
      case 'daily':
        return d.difference(start).inDays % interval == 0;
      case 'weekly':
        final days = r.weekdays.isEmpty ? [start.weekday] : r.weekdays;
        if (!days.contains(d.weekday)) return false;
        final weeks = d.difference(start).inDays ~/ 7;
        return weeks % interval == 0;
      case 'monthly':
        if (d.day != start.day) return false;
        final months = (d.year - start.year) * 12 + (d.month - start.month);
        return months % interval == 0;
      default:
        return false;
    }
  }

  @override
  Future<TaskDto> create(TaskDto input) async {
    final created = input.id.isEmpty
        ? input.copyWith(id: 'task-${DateTime.now().microsecondsSinceEpoch}')
        : input;
    final key = _key(created.date);
    _byDay.update(
      key,
      (list) => [...list, created],
      ifAbsent: () => [created],
    );
    return mockDelay(created);
  }

  @override
  Future<TaskDto> update(TaskDto task) async {
    final key = _key(task.date);
    final list = _byDay[key];
    if (list != null) {
      final i = list.indexWhere((t) => t.id == task.id);
      if (i >= 0) list[i] = task;
    }
    return mockDelay(task);
  }

  @override
  Future<TaskDto> move(String id, DateTime newDate) async {
    TaskDto? found;
    for (final entry in _byDay.entries) {
      final i = entry.value.indexWhere((t) => t.id == id);
      if (i >= 0) {
        found = entry.value.removeAt(i);
        break;
      }
    }
    final moved = (found ?? TaskDto(id: id, title: '', tagId: '', date: newDate))
        .copyWith(date: _dayOnly(newDate));
    _byDay.update(_key(newDate), (list) => [...list, moved], ifAbsent: () => [moved]);
    return mockDelay(moved);
  }

  @override
  Future<void> delete(String id) async {
    for (final entry in _byDay.entries) {
      entry.value.removeWhere((t) => t.id == id);
    }
    return mockDelayVoid();
  }

  @override
  Future<int> completedThisWeek(DateTime around) async {
    final monday = _dayOnly(around).subtract(Duration(days: _dayOnly(around).weekday - 1));
    var count = 0;
    for (var i = 0; i < 7; i++) {
      final list = _byDay[_key(monday.add(Duration(days: i)))];
      if (list != null) count += list.where((t) => t.done).length;
    }
    return mockDelay(count);
  }
}

/// Real impl — wired in the §8 pass against the NestJS REST API.
class ApiTasksSource implements TasksSource {
  ApiTasksSource(this._dio);
  // Retained for the §8 wiring pass; real requests use this Dio.
  // ignore: unused_field
  final Dio _dio;

  Never _notWired() =>
      throw UnimplementedError('ApiTasksSource is wired in the §8 pass.');

  @override
  Future<List<TaskDto>> tasksForDay(DateTime date) => _notWired();
  @override
  Future<TaskDto> create(TaskDto input) => _notWired();
  @override
  Future<TaskDto> update(TaskDto task) => _notWired();
  @override
  Future<TaskDto> move(String id, DateTime newDate) => _notWired();
  @override
  Future<void> delete(String id) => _notWired();
  @override
  Future<int> completedThisWeek(DateTime around) => _notWired();
}
