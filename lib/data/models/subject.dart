import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'subject.freezed.dart';

/// A subject's grade target, expressed as a GPA or a percentage.
@freezed
abstract class SubjectTarget with _$SubjectTarget {
  const factory SubjectTarget({
    required SubjectTargetKind kind,
    required double value,
  }) = _SubjectTarget;
}

/// A material attached to a subject (syllabus, slides, notes, …).
@freezed
abstract class SubjectFile with _$SubjectFile {
  const factory SubjectFile({
    required String id,
    required String name,
    String? kind, // syllabus | slides | notes | paper | …
    String? sizeLabel, // e.g. "8.2 MB"
    @Default(false) bool important,
  }) = _SubjectFile;
}

/// A study subject (course).
@freezed
abstract class Subject with _$Subject {
  const factory Subject({
    required String id,
    required String name,
    required String color, // hex string, e.g. "#6b5cf0"
    required String semesterId,
    String? code, // e.g. "CC 401"
    SubjectTarget? target,
    String? targetGrade, // e.g. "A"
    String? professor,
    int? credits,
    int? mood, // 0..4
    String? nextLabel, // e.g. "Viva · 3 days"
    double? focusHours, // this week
    @Default(0) int fileCount,
    @Default(<SubjectFile>[]) List<SubjectFile> files,
  }) = _Subject;
}

/// A semester / term grouping subjects.
@freezed
abstract class Semester with _$Semester {
  const factory Semester({
    required String id,
    required String name,
  }) = _Semester;
}
