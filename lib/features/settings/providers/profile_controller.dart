import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/user_profile.dart';

/// Single source of truth for the editable profile — Settings → Profile, the
/// Settings hub header, and the Stats header all read this, so an edit reflects
/// everywhere. Seeded with the demo profile and persisted in memory for the
/// session; the §8 pass swaps the seed for a repository load + write-through.
class ProfileController extends Notifier<UserProfile> {
  @override
  UserProfile build() => const UserProfile(
        name: 'Ridhwan Ahamed',
        email: 'f20230375@dubai.bits-pilani.ac.in',
        gender: 'Prefer not to say',
        university: 'BITS Dubai',
        program: 'CS · Undergrad',
      );

  void updateName(String value) => state = state.copyWith(name: value);
  void updateEmail(String value) => state = state.copyWith(email: value);
  void updateGender(String value) => state = state.copyWith(gender: value);
  void updateDateOfBirth(DateTime value) => state = state.copyWith(dateOfBirth: value);
  void updateHealth(String value) => state = state.copyWith(health: value);
  void updateUniversity(String value) => state = state.copyWith(university: value);
  void updateProgram(String value) => state = state.copyWith(program: value);
}

final profileControllerProvider =
    NotifierProvider<ProfileController, UserProfile>(ProfileController.new);
