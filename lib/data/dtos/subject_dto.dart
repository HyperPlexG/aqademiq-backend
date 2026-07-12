import 'package:freezed_annotation/freezed_annotation.dart';

part 'subject_dto.freezed.dart';
part 'subject_dto.g.dart';

@freezed
abstract class SubjectTargetDto with _$SubjectTargetDto {
  const factory SubjectTargetDto({
    required String kind, // gpa|percent
    required double value,
  }) = _SubjectTargetDto;

  factory SubjectTargetDto.fromJson(Map<String, dynamic> json) =>
      _$SubjectTargetDtoFromJson(json);
}

@freezed
abstract class SubjectDto with _$SubjectDto {
  const factory SubjectDto({
    required String id,
    required String name,
    required String color,
    required String semesterId,
    String? code,
    SubjectTargetDto? target,
    String? targetGrade,
    String? professor,
    int? credits,
    int? mood,
    String? nextLabel,
    double? focusHours,
    @Default(0) int fileCount,
  }) = _SubjectDto;

  factory SubjectDto.fromJson(Map<String, dynamic> json) =>
      _$SubjectDtoFromJson(json);
}

@freezed
abstract class SemesterDto with _$SemesterDto {
  const factory SemesterDto({
    required String id,
    required String name,
  }) = _SemesterDto;

  factory SemesterDto.fromJson(Map<String, dynamic> json) =>
      _$SemesterDtoFromJson(json);
}
