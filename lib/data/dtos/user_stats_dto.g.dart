// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_stats_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_UserStatsDto _$UserStatsDtoFromJson(Map<String, dynamic> json) =>
    _UserStatsDto(
      streakDays: (json['streakDays'] as num?)?.toInt() ?? 0,
      focusMinutesThisWeek:
          (json['focusMinutesThisWeek'] as num?)?.toInt() ?? 0,
      tasksCompletedThisWeek:
          (json['tasksCompletedThisWeek'] as num?)?.toInt() ?? 0,
      weekMoods:
          (json['weekMoods'] as List<dynamic>?)
              ?.map((e) => MoodLogDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <MoodLogDto>[],
    );

Map<String, dynamic> _$UserStatsDtoToJson(_UserStatsDto instance) =>
    <String, dynamic>{
      'streakDays': instance.streakDays,
      'focusMinutesThisWeek': instance.focusMinutesThisWeek,
      'tasksCompletedThisWeek': instance.tasksCompletedThisWeek,
      'weekMoods': instance.weekMoods,
    };
