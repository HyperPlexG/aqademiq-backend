import 'package:dio/dio.dart';

import '../dtos/mood_log_dto.dart';
import '../fixtures/fixtures.dart';
import 'mock_latency.dart';

abstract interface class MoodSource {
  Future<List<MoodLogDto>> week();
  Future<MoodLogDto> log(MoodLogDto entry);
}

class MockMoodSource implements MoodSource {
  final List<MoodLogDto> _logs = [...Fixtures.weekMoods];

  @override
  Future<List<MoodLogDto>> week() =>
      mockDelay(List<MoodLogDto>.unmodifiable(_logs));

  @override
  Future<MoodLogDto> log(MoodLogDto entry) async {
    final created = entry.id.isEmpty
        ? entry.copyWith(id: 'mood-${DateTime.now().microsecondsSinceEpoch}')
        : entry;
    _logs.add(created);
    return mockDelay(created);
  }
}

/// Live impl against `/v1/mood-entries`. Wire `mood_index` is 0–4 (backend
/// stores 1–5 internally). Morning logs carry an `intention`; evening a
/// `reflection`.
class ApiMoodSource implements MoodSource {
  ApiMoodSource(this._dio);
  final Dio _dio;

  static String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Future<List<MoodLogDto>> week() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/mood-entries/week');
    final days = (res.data?['days'] as List?) ?? const [];
    final out = <MoodLogDto>[];
    for (final raw in days) {
      final d = (raw as Map).cast<String, dynamic>();
      final mi = d['mood_index'];
      final date = DateTime.parse(d['date'] as String);
      if (mi is num) {
        out.add(MoodLogDto(
          id: 'mood-${d['date']}-morning',
          date: date,
          phase: 'morning',
          mood: mi.toInt(),
          note: d['intention'] as String?,
        ));
      }
      // Evening reflection — surfaced so the Stats "daily reflections" list can
      // render it. Without this the reflection text never reaches the app.
      final reflection = d['reflection'];
      if (reflection is String && reflection.trim().isNotEmpty) {
        out.add(MoodLogDto(
          id: 'mood-${d['date']}-evening',
          date: date,
          phase: 'evening',
          mood: mi is num ? mi.toInt() : 3,
          note: reflection,
        ));
      }
    }
    return out;
  }

  @override
  Future<MoodLogDto> log(MoodLogDto entry) async {
    final dateStr = _ymd(entry.date);
    Map<String, dynamic> data;
    if (entry.phase == 'evening') {
      final res = await _dio.post<Map<String, dynamic>>(
        '/v1/mood-entries/$dateStr/reflection',
        data: {'reflection': entry.note ?? ''},
      );
      data = res.data ?? const {};
    } else {
      final res = await _dio.post<Map<String, dynamic>>(
        '/v1/mood-entries',
        data: {
          'date': dateStr,
          'mood_index': entry.mood,
          if (entry.note != null) 'intention': entry.note,
        },
      );
      data = res.data ?? const {};
    }
    return MoodLogDto(
      id: entry.id.isEmpty ? 'mood-$dateStr-${entry.phase}' : entry.id,
      date: DateTime.tryParse('${data['date'] ?? dateStr}') ?? entry.date,
      phase: entry.phase,
      mood: (data['mood_index'] as num?)?.toInt() ?? entry.mood,
      note: (data['intention'] ?? data['reflection'] ?? entry.note) as String?,
    );
  }
}
