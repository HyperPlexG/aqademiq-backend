import 'package:freezed_annotation/freezed_annotation.dart';

import 'mood_log_dto.dart';

part 'user_stats_dto.freezed.dart';
part 'user_stats_dto.g.dart';

@freezed
abstract class UserStatsDto with _$UserStatsDto {
  const factory UserStatsDto({
    @Default(0) int streakDays,
    @Default(0) int focusMinutesThisWeek,
    @Default(0) int tasksCompletedThisWeek,
    @Default(<MoodLogDto>[]) List<MoodLogDto> weekMoods,
  }) = _UserStatsDto;

  factory UserStatsDto.fromJson(Map<String, dynamic> json) =>
      _$UserStatsDtoFromJson(json);
}
