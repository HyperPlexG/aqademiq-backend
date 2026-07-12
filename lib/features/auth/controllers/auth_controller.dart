import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/auth/auth_repository.dart';

/// Drives the auth actions (guest / sign-in / sign-up / verify). Screens watch
/// its `isLoading` for button spinners and navigate on a `true` result. Swaps to
/// Identity Platform in the §8 pass without touching the screens.
final authControllerProvider =
    AsyncNotifierProvider<AuthController, void>(AuthController.new);

class AuthController extends AsyncNotifier<void> {
  @override
  FutureOr<void> build() {}

  Future<bool> guest() =>
      _run(() => ref.read(authRepositoryProvider).signInAnonymously());

  Future<bool> signIn({required String email, required String password}) =>
      _run(() => ref.read(authRepositoryProvider).signInWithEmail(
            email: email,
            password: password,
          ));

  Future<bool> signUp({
    required String name,
    required String email,
    required String password,
  }) =>
      _run(() => ref.read(authRepositoryProvider).signUp(
            name: name,
            email: email,
            password: password,
          ));

  Future<bool> verify(String code) =>
      _run(() => ref.read(authRepositoryProvider).verifyOtp(code));

  Future<bool> _run(Future<void> Function() action) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(action);
    return !state.hasError;
  }
}
