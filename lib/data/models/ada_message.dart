import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'ada_message.freezed.dart';

/// A single message in an Ada conversation.
@freezed
abstract class AdaMessage with _$AdaMessage {
  const factory AdaMessage({
    required String id,
    required AdaRole role,
    required String text,
    DateTime? createdAt,
  }) = _AdaMessage;
}
