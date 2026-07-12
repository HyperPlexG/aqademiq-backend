import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'focus_session.freezed.dart';

/// A focus session. Once wired (README §8) the elapsed time is server-
/// authoritative (Redis + Socket.IO ticks); locally we keep [elapsedSec] for
/// cold-start resume.
@freezed
abstract class FocusSession with _$FocusSession {
  const factory FocusSession({
    required String id,
    required int durationMin,
    String? taskId,
    String? prismMode,
    @Default(0) int elapsedSec,
    @Default(FocusStatus.idle) FocusStatus status,
    DateTime? startedAt,
    DateTime? completedAt,
    int? endMood,
  }) = _FocusSession;

  const FocusSession._();

  /// Progress 0..1 of elapsed against the planned duration.
  double get progress {
    final total = durationMin * 60;
    if (total <= 0) return 0;
    return (elapsedSec / total).clamp(0.0, 1.0);
  }
}
