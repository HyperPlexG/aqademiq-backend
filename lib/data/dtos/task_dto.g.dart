// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'task_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SubtaskDto _$SubtaskDtoFromJson(Map<String, dynamic> json) => _SubtaskDto(
  id: json['id'] as String,
  title: json['title'] as String,
  done: json['done'] as bool? ?? false,
);

Map<String, dynamic> _$SubtaskDtoToJson(_SubtaskDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'done': instance.done,
    };

_RepeatRuleDto _$RepeatRuleDtoFromJson(Map<String, dynamic> json) =>
    _RepeatRuleDto(
      frequency: json['frequency'] as String,
      interval: (json['interval'] as num?)?.toInt() ?? 1,
      weekdays:
          (json['weekdays'] as List<dynamic>?)
              ?.map((e) => (e as num).toInt())
              .toList() ??
          const <int>[],
    );

Map<String, dynamic> _$RepeatRuleDtoToJson(_RepeatRuleDto instance) =>
    <String, dynamic>{
      'frequency': instance.frequency,
      'interval': instance.interval,
      'weekdays': instance.weekdays,
    };

_TaskDto _$TaskDtoFromJson(Map<String, dynamic> json) => _TaskDto(
  id: json['id'] as String,
  title: json['title'] as String,
  tagId: json['tagId'] as String,
  date: DateTime.parse(json['date'] as String),
  timeOfDay: json['timeOfDay'] as String?,
  startTime: json['startTime'] == null
      ? null
      : DateTime.parse(json['startTime'] as String),
  durationMin: (json['durationMin'] as num?)?.toInt(),
  repeat: json['repeat'] == null
      ? null
      : RepeatRuleDto.fromJson(json['repeat'] as Map<String, dynamic>),
  subtasks:
      (json['subtasks'] as List<dynamic>?)
          ?.map((e) => SubtaskDto.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <SubtaskDto>[],
  done: json['done'] as bool? ?? false,
);

Map<String, dynamic> _$TaskDtoToJson(_TaskDto instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'tagId': instance.tagId,
  'date': instance.date.toIso8601String(),
  'timeOfDay': instance.timeOfDay,
  'startTime': instance.startTime?.toIso8601String(),
  'durationMin': instance.durationMin,
  'repeat': instance.repeat,
  'subtasks': instance.subtasks,
  'done': instance.done,
};
