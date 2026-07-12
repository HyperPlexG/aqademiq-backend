import 'package:freezed_annotation/freezed_annotation.dart';

part 'task_dto.freezed.dart';
part 'task_dto.g.dart';

/// Raw API shape for a microtask. Generated from the NestJS OpenAPI spec during
/// the §8 wiring pass; hand-authored now to define the seam.
@freezed
abstract class SubtaskDto with _$SubtaskDto {
  const factory SubtaskDto({
    required String id,
    required String title,
    @Default(false) bool done,
  }) = _SubtaskDto;

  factory SubtaskDto.fromJson(Map<String, dynamic> json) =>
      _$SubtaskDtoFromJson(json);
}

@freezed
abstract class RepeatRuleDto with _$RepeatRuleDto {
  const factory RepeatRuleDto({
    required String frequency, // none|daily|weekly|monthly|custom
    @Default(1) int interval,
    @Default(<int>[]) List<int> weekdays,
  }) = _RepeatRuleDto;

  factory RepeatRuleDto.fromJson(Map<String, dynamic> json) =>
      _$RepeatRuleDtoFromJson(json);
}

@freezed
abstract class TaskDto with _$TaskDto {
  const factory TaskDto({
    required String id,
    required String title,
    required String tagId,
    required DateTime date,
    String? timeOfDay, // morning|afternoon|evening|anytime
    DateTime? startTime,
    int? durationMin,
    RepeatRuleDto? repeat,
    @Default(<SubtaskDto>[]) List<SubtaskDto> subtasks,
    @Default(false) bool done,
  }) = _TaskDto;

  factory TaskDto.fromJson(Map<String, dynamic> json) =>
      _$TaskDtoFromJson(json);
}
