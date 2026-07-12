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

class ApiMoodSource implements MoodSource {
  ApiMoodSource(this._dio);
  // Retained for the §8 wiring pass; real requests use this Dio.
  // ignore: unused_field
  final Dio _dio;

  Never _notWired() =>
      throw UnimplementedError('ApiMoodSource is wired in the §8 pass.');

  @override
  Future<List<MoodLogDto>> week() => _notWired();
  @override
  Future<MoodLogDto> log(MoodLogDto entry) => _notWired();
}
