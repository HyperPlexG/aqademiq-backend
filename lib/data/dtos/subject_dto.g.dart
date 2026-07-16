// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'subject_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SubjectTargetDto _$SubjectTargetDtoFromJson(Map<String, dynamic> json) =>
    _SubjectTargetDto(
      kind: json['kind'] as String,
      value: (json['value'] as num).toDouble(),
    );

Map<String, dynamic> _$SubjectTargetDtoToJson(_SubjectTargetDto instance) =>
    <String, dynamic>{'kind': instance.kind, 'value': instance.value};

_SubjectFileDto _$SubjectFileDtoFromJson(Map<String, dynamic> json) =>
    _SubjectFileDto(
      id: json['id'] as String,
      name: json['name'] as String,
      kind: json['kind'] as String?,
      sizeLabel: json['sizeLabel'] as String?,
      important: json['important'] as bool? ?? false,
    );

Map<String, dynamic> _$SubjectFileDtoToJson(_SubjectFileDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'kind': instance.kind,
      'sizeLabel': instance.sizeLabel,
      'important': instance.important,
    };

_SubjectDto _$SubjectDtoFromJson(Map<String, dynamic> json) => _SubjectDto(
  id: json['id'] as String,
  name: json['name'] as String,
  color: json['color'] as String,
  semesterId: json['semesterId'] as String,
  code: json['code'] as String?,
  target: json['target'] == null
      ? null
      : SubjectTargetDto.fromJson(json['target'] as Map<String, dynamic>),
  targetGrade: json['targetGrade'] as String?,
  professor: json['professor'] as String?,
  credits: (json['credits'] as num?)?.toInt(),
  mood: (json['mood'] as num?)?.toInt(),
  nextLabel: json['nextLabel'] as String?,
  focusHours: (json['focusHours'] as num?)?.toDouble(),
  fileCount: (json['fileCount'] as num?)?.toInt() ?? 0,
  files:
      (json['files'] as List<dynamic>?)
          ?.map((e) => SubjectFileDto.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <SubjectFileDto>[],
);

Map<String, dynamic> _$SubjectDtoToJson(_SubjectDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'color': instance.color,
      'semesterId': instance.semesterId,
      'code': instance.code,
      'target': instance.target,
      'targetGrade': instance.targetGrade,
      'professor': instance.professor,
      'credits': instance.credits,
      'mood': instance.mood,
      'nextLabel': instance.nextLabel,
      'focusHours': instance.focusHours,
      'fileCount': instance.fileCount,
      'files': instance.files,
    };

_SemesterDto _$SemesterDtoFromJson(Map<String, dynamic> json) =>
    _SemesterDto(id: json['id'] as String, name: json['name'] as String);

Map<String, dynamic> _$SemesterDtoToJson(_SemesterDto instance) =>
    <String, dynamic>{'id': instance.id, 'name': instance.name};
