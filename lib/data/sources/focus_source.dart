import 'package:dio/dio.dart';

import '../dtos/focus_session_dto.dart';
import 'mock_latency.dart';

abstract interface class FocusSource {
  Future<FocusSessionDto> start(FocusSessionDto session);
  Future<FocusSessionDto> complete(String id, {int? mood});
}

class MockFocusSource implements FocusSource {
  @override
  Future<FocusSessionDto> start(FocusSessionDto session) => mockDelay(
        session.copyWith(
          id: 'focus-${DateTime.now().microsecondsSinceEpoch}',
          status: 'running',
          startedAt: DateTime.now(),
        ),
        ms: 250,
      );

  @override
  Future<FocusSessionDto> complete(String id, {int? mood}) => mockDelay(
        FocusSessionDto(
          id: id,
          durationMin: 0,
          status: 'completed',
          completedAt: DateTime.now(),
          endMood: mood,
        ),
        ms: 250,
      );
}

class ApiFocusSource implements FocusSource {
  ApiFocusSource(this._dio);
  // Retained for the §8 wiring pass; real requests use this Dio (Redis-backed,
  // with focus:tick events over Socket.IO).
  // ignore: unused_field
  final Dio _dio;

  Never _notWired() =>
      throw UnimplementedError('ApiFocusSource is wired in the §8 pass.');

  @override
  Future<FocusSessionDto> start(FocusSessionDto session) => _notWired();
  @override
  Future<FocusSessionDto> complete(String id, {int? mood}) => _notWired();
}
