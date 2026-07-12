import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env/env.dart';
import '../models/app_user.dart';

/// Auth behind an interface (README §7, seam 4). A [MockAuthRepository] backs the
/// app today; the §8 pass adds an Identity Platform (`firebase_auth`) impl with
/// the SAME surface — guest (`signInAnonymously`), OTP, and link-on-save
/// (`linkWithCredential`) — so no consumer changes.
abstract interface class AuthRepository {
  /// Emits the current user (or `null` when signed out). Mirrors
  /// `FirebaseAuth.authStateChanges()`.
  Stream<AppUser?> authState();

  AppUser? get currentUser;

  /// Guest session — `signInAnonymously` in Identity Platform.
  Future<AppUser> signInAnonymously();

  Future<AppUser> signInWithEmail({
    required String email,
    required String password,
  });

  Future<AppUser> signUp({
    required String name,
    required String email,
    required String password,
  });

  /// The email-code / verification step (FRAMES `auth-otp`).
  Future<void> verifyOtp(String code);

  /// "Save progress": link the anonymous guest to a real credential
  /// (`linkWithCredential`).
  Future<AppUser> linkGuestToAccount({
    required String email,
    required String password,
  });

  Future<void> signOut();

  void dispose();
}

/// In-memory mock. Starts as a guest so Guest Mode (and its nav lock dots) is
/// the default experience (README §1: "V1 ships with Guest Mode").
class MockAuthRepository implements AuthRepository {
  MockAuthRepository() {
    _controller = StreamController<AppUser?>.broadcast(
      onListen: () => _controller.add(_user),
    );
  }

  static const _guest = AppUser(id: 'guest-local', name: 'Guest');

  late final StreamController<AppUser?> _controller;
  AppUser? _user = _guest;

  @override
  AppUser? get currentUser => _user;

  @override
  Stream<AppUser?> authState() => _controller.stream;

  void _emit(AppUser? user) {
    _user = user;
    _controller.add(user);
  }

  Future<T> _delayed<T>(T value) =>
      Future<T>.delayed(const Duration(milliseconds: 350), () => value);

  @override
  Future<AppUser> signInAnonymously() async {
    final user = await _delayed(_guest);
    _emit(user);
    return user;
  }

  @override
  Future<AppUser> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final user = await _delayed(
      AppUser(id: 'user-${email.hashCode}', name: email.split('@').first, email: email, isGuest: false),
    );
    _emit(user);
    return user;
  }

  @override
  Future<AppUser> signUp({
    required String name,
    required String email,
    required String password,
  }) async {
    final user = await _delayed(
      AppUser(id: 'user-${email.hashCode}', name: name, email: email, isGuest: false),
    );
    _emit(user);
    return user;
  }

  @override
  Future<void> verifyOtp(String code) => _delayed(null);

  @override
  Future<AppUser> linkGuestToAccount({
    required String email,
    required String password,
  }) async {
    final current = _user ?? _guest;
    final linked = await _delayed(
      current.copyWith(email: email, isGuest: false),
    );
    _emit(linked);
    return linked;
  }

  @override
  Future<void> signOut() async {
    await _delayed(null);
    _emit(null);
  }

  @override
  void dispose() => _controller.close();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  if (Env.useMocks) {
    final repo = MockAuthRepository();
    ref.onDispose(repo.dispose);
    return repo;
  }
  // TODO(aqademiq): §8 — return IdentityPlatformAuthRepository(firebaseAuth).
  throw UnimplementedError('Live auth is wired during the §8 integration pass.');
});

/// Current user as an `AsyncValue` (loading / data / error for free).
final authStateProvider = StreamProvider<AppUser?>(
  (ref) => ref.watch(authRepositoryProvider).authState(),
);

/// Whether the active session is a guest — gates Ada / Stats / Save-progress.
final isGuestProvider = Provider<bool>((ref) {
  final user = ref.watch(authStateProvider).value;
  return user?.isGuest ?? true;
});
