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

/// Live impl against `/v1/tasks`. The backend returns occurrence DTOs
/// (`{id,title,subject_id,duration_seconds,scheduled_at,status,category,repeat,steps}`)
/// which this maps onto the app's mock-shaped [TaskDto]. Occurrence responses
/// carry no date, so the queried/known date is threaded through by the source.
class ApiTasksSource implements TasksSource {
  ApiTasksSource(this._dio);
  final Dio _dio;

  static String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  static DateTime _dayOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  @override
  Future<List<TaskDto>> tasksForDay(DateTime date) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/v1/tasks',
      queryParameters: {'date': _ymd(date)},
    );
    final list = (res.data?['tasks'] as List?) ?? const [];
    return list
        .map((j) => _fromOccurrence((j as Map).cast<String, dynamic>(), date))
        .toList(growable: false);
  }

  @override
  Future<TaskDto> create(TaskDto input) async {
    final body = <String, dynamic>{
      'title': input.title,
      'date': _ymd(input.date),
      if (input.durationMin != null) 'duration_seconds': input.durationMin! * 60,
      if (input.startTime != null) 'scheduled_at': input.startTime!.toIso8601String(),
      if (input.tagId.isNotEmpty) 'category': input.tagId,
      if (input.repeat != null && input.repeat!.frequency != 'none')
        'repeat': {
          'kind': _freqToKind(input.repeat!.frequency),
          'interval': input.repeat!.interval,
        },
    };
    final res = await _dio.post<Map<String, dynamic>>('/v1/tasks', data: body);
    return _fromOccurrence(res.data!, input.date);
  }

  @override
  Future<TaskDto> update(TaskDto task) async {
    final body = <String, dynamic>{
      'status': task.done ? 'COMPLETE' : 'PENDING',
      if (task.startTime != null) 'scheduled_at': task.startTime!.toIso8601String(),
    };
    final res = await _dio.patch<Map<String, dynamic>>(
      '/v1/tasks/${Uri.encodeComponent(task.id)}',
      data: body,
    );
    return _fromOccurrence(res.data!, task.date);
  }

  @override
  Future<TaskDto> move(String id, DateTime newDate) async {
    final from = id.contains('@') ? id.split('@').last : _ymd(newDate);
    await _dio.post<Map<String, dynamic>>(
      '/v1/tasks/move',
      data: {'from': from, 'to': _ymd(newDate), 'ids': [id]},
    );
    // The moved occurrence gets a new (date-suffixed) id — refetch the day.
    final base = id.contains('@') ? id.split('@').first : id;
    final dayTasks = await tasksForDay(newDate);
    for (final t in dayTasks) {
      if (t.id == id || t.id.startsWith(base)) return t;
    }
    return TaskDto(id: id, title: '', tagId: '', date: _dayOnly(newDate));
  }

  @override
  Future<void> delete(String id) async {
    await _dio.delete<dynamic>('/v1/tasks/${Uri.encodeComponent(id)}');
  }

  @override
  Future<int> completedThisWeek(DateTime around) async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/tasks/history/completions');
    final counts = res.data ?? const {};
    final day = _dayOnly(around);
    final monday = day.subtract(Duration(days: day.weekday - 1));
    var total = 0;
    for (var i = 0; i < 7; i++) {
      final v = counts[_ymd(monday.add(Duration(days: i)))];
      if (v is num) total += v.toInt();
    }
    return total;
  }

  // ---- mapping ------------------------------------------------------------

  TaskDto _fromOccurrence(Map<String, dynamic> j, DateTime date) {
    final repeat = (j['repeat'] as Map?)?.cast<String, dynamic>();
    final steps = (j['steps'] as List?) ?? const [];
    final scheduledAt = j['scheduled_at'] as String?; // "HH:mm" wall-clock
    final durationSec = (j['duration_seconds'] as num?)?.toInt() ?? 0;
    return TaskDto(
      id: j['id'] as String,
      title: (j['title'] as String?) ?? '',
      tagId: (j['category'] as String?) ?? '',
      date: _dayOnly(date),
      timeOfDay: _timeOfDay(scheduledAt),
      startTime: _startTime(date, scheduledAt),
      durationMin: durationSec > 0 ? (durationSec / 60).round() : null,
      repeat: repeat == null
          ? null
          : RepeatRuleDto(
              frequency: _kindToFreq(repeat['kind'] as String?),
              interval: (repeat['interval'] as num?)?.toInt() ?? 1,
            ),
      subtasks: steps
          .map((s) => SubtaskDto(
                id: (s as Map)['id'] as String,
                title: (s['title'] as String?) ?? '',
                done: (s['status'] as String?) == 'COMPLETE',
              ))
          .toList(),
      done: (j['status'] as String?) == 'COMPLETE',
    );
  }

  String? _timeOfDay(String? hhmm) {
    if (hhmm == null || !hhmm.contains(':')) return null;
    final h = int.tryParse(hhmm.split(':').first) ?? 0;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  DateTime? _startTime(DateTime date, String? hhmm) {
    if (hhmm == null || !hhmm.contains(':')) return null;
    final parts = hhmm.split(':');
    final h = int.tryParse(parts[0]) ?? 0;
    final m = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    return DateTime(date.year, date.month, date.day, h, m);
  }

  String _kindToFreq(String? kind) {
    switch (kind) {
      case 'daily':
      case 'everyNDays':
        return 'daily';
      case 'weekly':
      case 'weekdays':
      case 'everyNWeeks':
        return 'weekly';
      case 'monthly':
      case 'everyNMonths':
        return 'monthly';
      default:
        return 'none';
    }
  }

  String _freqToKind(String freq) {
    switch (freq) {
      case 'daily':
        return 'daily';
      case 'weekly':
        return 'weekly';
      case 'monthly':
        return 'monthly';
      default:
        return 'none';
    }
  }
}
