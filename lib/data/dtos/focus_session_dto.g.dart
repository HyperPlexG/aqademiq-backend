// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'focus_session_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_FocusSessionDto _$FocusSessionDtoFromJson(Map<String, dynamic> json) =>
    _FocusSessionDto(
      id: json['id'] as String,
      durationMin: (json['durationMin'] as num).toInt(),
      taskId: json['taskId'] as String?,
      prismMode: json['prismMode'] as String?,
      elapsedSec: (json['elapsedSec'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'idle',
      startedAt: json['startedAt'] == null
          ? null
          : DateTime.parse(json['startedAt'] as String),
      completedAt: json['completedAt'] == null
          ? null
          : DateTime.parse(json['completedAt'] as String),
      endMood: (json['endMood'] as num?)?.toInt(),
    );

Map<String, dynamic> _$FocusSessionDtoToJson(_FocusSessionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'durationMin': instance.durationMin,
      'taskId': instance.taskId,
      'prismMode': instance.prismMode,
      'elapsedSec': instance.elapsedSec,
      'status': instance.status,
      'startedAt': instance.startedAt?.toIso8601String(),
      'completedAt': instance.completedAt?.toIso8601String(),
      'endMood': instance.endMood,
    };
