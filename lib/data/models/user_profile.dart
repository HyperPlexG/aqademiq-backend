import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_profile.freezed.dart';

/// The editable user profile (Settings → Profile). Distinct from the auth
/// `AppUser` identity: this holds the demographic / study data the user
/// maintains. Seeded with demo values today; hydrated from the API in the §8
/// pass.
@freezed
abstract class UserProfile with _$UserProfile {
  const factory UserProfile({
    required String name,
    required String email,
    String? gender,
    DateTime? dateOfBirth,
    String? health,
    String? university,
    String? program,
  }) = _UserProfile;
}
