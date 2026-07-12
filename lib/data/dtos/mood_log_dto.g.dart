// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mood_log_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_MoodLogDto _$MoodLogDtoFromJson(Map<String, dynamic> json) => _MoodLogDto(
  id: json['id'] as String,
  date: DateTime.parse(json['date'] as String),
  phase: json['phase'] as String,
  mood: (json['mood'] as num).toInt(),
  note: json['note'] as String?,
);

Map<String, dynamic> _$MoodLogDtoToJson(_MoodLogDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'date': instance.date.toIso8601String(),
      'phase': instance.phase,
      'mood': instance.mood,
      'note': instance.note,
    };
