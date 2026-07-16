import 'package:dio/dio.dart';

import '../dtos/mood_log_dto.dart';
import '../dtos/user_stats_dto.dart';
import '../fixtures/fixtures.dart';
import 'mock_latency.dart';

abstract interface class ProfileSource {
  Future<UserStatsDto> stats();
}

class MockProfileSource implements ProfileSource {
  @override
  Future<UserStatsDto> stats() => mockDelay(Fixtures.stats());
}

/// Live impl against `/v1/me/stats` (+ `/v1/mood-entries/week` for the mood
/// strip). Note: the backend's `focus_minutes`/`completed_tasks` are lifetime
/// totals, surfaced here in the "this week" fields as a reasonable first-pass.
class ApiProfileSource implements ProfileSource {
  ApiProfileSource(this._dio);
  final Dio _dio;

  @override
  Future<UserStatsDto> stats() async {
    final responses = await Future.wait([
      _dio.get<Map<String, dynamic>>('/v1/me/stats'),
      _dio.get<Map<String, dynamic>>('/v1/mood-entries/week'),
    ]);
    final s = responses[0].data ?? const {};
    final days = (responses[1].data?['days'] as List?) ?? const [];

    final weekMoods = <MoodLogDto>[];
    for (final raw in days) {
      final d = (raw as Map).cast<String, dynamic>();
      final mi = d['mood_index'];
      if (mi is num) {
        weekMoods.add(MoodLogDto(
          id: 'mood-${d['date']}-morning',
          date: DateTime.parse(d['date'] as String),
          phase: 'morning',
          mood: mi.toInt(),
          note: d['intention'] as String?,
        ));
      }
    }

    return UserStatsDto(
      streakDays: (s['current_streak'] as num?)?.toInt() ?? 0,
      focusMinutesThisWeek: (s['focus_minutes'] as num?)?.toInt() ?? 0,
      tasksCompletedThisWeek: (s['completed_tasks'] as num?)?.toInt() ?? 0,
      weekMoods: weekMoods,
    );
  }
}
