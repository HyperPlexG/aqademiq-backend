import 'package:freezed_annotation/freezed_annotation.dart';

part 'app_user.freezed.dart';

/// The signed-in (or guest) user. [isGuest] gates Ada / Stats / Save-progress
/// (README §5, Guest Mode).
@freezed
abstract class AppUser with _$AppUser {
  const factory AppUser({
    required String id,
    required String name,
    String? email,
    String? university,
    String? program,
    String? gender,
    String? avatarUrl,
    @Default(true) bool isGuest,
  }) = _AppUser;
}
