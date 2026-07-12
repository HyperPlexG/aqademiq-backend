import 'package:freezed_annotation/freezed_annotation.dart';

part 'focus_session_dto.freezed.dart';
part 'focus_session_dto.g.dart';

@freezed
abstract class FocusSessionDto with _$FocusSessionDto {
  const factory FocusSessionDto({
    required String id,
    required int durationMin,
    String? taskId,
    String? prismMode,
    @Default(0) int elapsedSec,
    @Default('idle') String status, // idle|running|paused|completed
    DateTime? startedAt,
    DateTime? completedAt,
    int? endMood,
  }) = _FocusSessionDto;

  factory FocusSessionDto.fromJson(Map<String, dynamic> json) =>
      _$FocusSessionDtoFromJson(json);
}
