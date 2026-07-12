import 'package:freezed_annotation/freezed_annotation.dart';

part 'ada_message_dto.freezed.dart';
part 'ada_message_dto.g.dart';

@freezed
abstract class AdaMessageDto with _$AdaMessageDto {
  const factory AdaMessageDto({
    required String id,
    required String role, // user|ada
    required String text,
    DateTime? createdAt,
  }) = _AdaMessageDto;

  factory AdaMessageDto.fromJson(Map<String, dynamic> json) =>
      _$AdaMessageDtoFromJson(json);
}
