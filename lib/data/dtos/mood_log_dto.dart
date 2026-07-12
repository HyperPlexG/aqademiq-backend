import 'package:freezed_annotation/freezed_annotation.dart';

part 'mood_log_dto.freezed.dart';
part 'mood_log_dto.g.dart';

@freezed
abstract class MoodLogDto with _$MoodLogDto {
  const factory MoodLogDto({
    required String id,
    required DateTime date,
    required String phase, // morning|evening|adhoc
    required int mood, // 0..4
    String? note,
  }) = _MoodLogDto;

  factory MoodLogDto.fromJson(Map<String, dynamic> json) =>
      _$MoodLogDtoFromJson(json);
}
