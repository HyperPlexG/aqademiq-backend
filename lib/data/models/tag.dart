import 'package:freezed_annotation/freezed_annotation.dart';

part 'tag.freezed.dart';

/// A study tag (CRUD in Settings). [color] is a hex string.
@freezed
abstract class Tag with _$Tag {
  const factory Tag({
    required String id,
    required String label,
    required String color,
  }) = _Tag;
}
