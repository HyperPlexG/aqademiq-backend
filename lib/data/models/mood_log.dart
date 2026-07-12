import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'mood_log.freezed.dart';

/// A logged mood. [mood] is the 0..4 index into the MOODS scale
/// (0 Rough … 4 Great) matching the prototype's MoodBlob.
@freezed
abstract class MoodLog with _$MoodLog {
  const factory MoodLog({
    required String id,
    required DateTime date,
    required MoodPhase phase,
    required int mood,
    String? note,
  }) = _MoodLog;
}
