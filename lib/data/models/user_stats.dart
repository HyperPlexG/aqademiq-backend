import 'package:freezed_annotation/freezed_annotation.dart';

import 'mood_log.dart';

part 'user_stats.freezed.dart';

/// Profile/Stats summary (README §6) — streak, weekly focus, weekly moods.
@freezed
abstract class UserStats with _$UserStats {
  const factory UserStats({
    @Default(0) int streakDays,
    @Default(0) int focusMinutesThisWeek,
    @Default(0) int tasksCompletedThisWeek,
    @Default(<MoodLog>[]) List<MoodLog> weekMoods,
  }) = _UserStats;
}
