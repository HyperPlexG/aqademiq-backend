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

/// Live impl against `/v1/focus-sessions`. Backend status is UPPERCASE on the
/// wire (RUNNING/PAUSED/COMPLETE) — lowercased here to match `FocusStatus`.
class ApiFocusSource implements FocusSource {
  ApiFocusSource(this._dio);
  final Dio _dio;

  @override
  Future<FocusSessionDto> start(FocusSessionDto session) async {
    final planned = session.durationMin <= 0 ? 25 : session.durationMin.clamp(5, 120);
    final res = await _dio.post<Map<String, dynamic>>(
      '/v1/focus-sessions',
      data: {
        'planned_min': planned,
        if (session.prismMode != null) 'prism_mode': session.prismMode,
        if (session.taskId != null) 'task_id': session.taskId,
      },
    );
    return _fromJson(res.data!, fallbackStatus: 'running');
  }

  @override
  Future<FocusSessionDto> complete(String id, {int? mood}) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/v1/focus-sessions/$id/complete',
      data: {'mood_index': ?mood},
    );
    final dto = _fromJson(res.data!, fallbackStatus: 'completed');
    return dto.copyWith(completedAt: DateTime.now(), endMood: mood ?? dto.endMood);
  }

  FocusSessionDto _fromJson(Map<String, dynamic> j, {required String fallbackStatus}) {
    final createdAt = j['created_at'];
    return FocusSessionDto(
      id: j['id'] as String,
      durationMin: (j['planned_min'] as num?)?.toInt() ?? 0,
      taskId: j['task_id'] as String?,
      prismMode: j['prism_mode'] as String?,
      elapsedSec: (j['elapsed_sec'] as num?)?.toInt() ?? 0,
      status: (j['status'] as String?)?.toLowerCase() ?? fallbackStatus,
      startedAt: createdAt is String ? DateTime.tryParse(createdAt) : null,
      endMood: (j['mood_index'] as num?)?.toInt(),
    );
  }
}
