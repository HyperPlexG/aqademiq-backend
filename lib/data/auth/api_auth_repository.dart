import 'dart:async';

import 'package:dio/dio.dart';

import '../models/app_user.dart';
import 'auth_repository.dart';
import 'token_store.dart';

/// Live [AuthRepository] backed by the NestJS custom-JWT auth (`/v1/auth/*`).
///
/// The backend signup/link flows are two-step (pending → verify-otp), so this
/// repo remembers the pending email between `signUp`/`linkGuestToAccount` and
/// `verifyOtp` — keeping the [AuthRepository] interface (and every screen)
/// unchanged. Any call that returns a token pair persists it via [TokenStore];
/// the Dio `AuthInterceptor` then attaches/refreshes it automatically.
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._dio, this._tokens) {
    _controller = StreamController<AppUser?>.broadcast(
      onListen: () => _controller.add(_user),
    );
    unawaited(_restore());
  }

  final Dio _dio;
  final TokenStore _tokens;
  late final StreamController<AppUser?> _controller;

  AppUser? _user;
  String? _pendingEmail;

  @override
  AppUser? get currentUser => _user;

  @override
  Stream<AppUser?> authState() => _controller.stream;

  void _emit(AppUser? user) {
    _user = user;
    _controller.add(user);
  }

  /// On launch, if we hold a refresh token, hydrate the current user from
  /// `/profile` (the interceptor refreshes the access token if needed).
  Future<void> _restore() async {
    if (!await _tokens.hasSession) return;
    try {
      final user = await _fetchProfileUser(idFallback: '', isGuestFallback: false);
      if (user != null) _emit(user);
    } on Object catch (_) {
      await _tokens.clear();
    }
  }

  @override
  Future<AppUser> signInAnonymously() async {
    final res = await _dio.post<Map<String, dynamic>>('/v1/auth/guest');
    final user = await _consumeSession(res.data!);
    _emit(user);
    return user;
  }

  @override
  Future<AppUser> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/v1/auth/signin',
      data: {'email': email, 'password': password},
    );
    final user = await _consumeSession(res.data!);
    _emit(user);
    return user;
  }

  @override
  Future<AppUser> signUp({
    required String name,
    required String email,
    required String password,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/v1/auth/signup',
      data: {'email': email, 'password': password, 'name': name},
    );
    // Not signed in until OTP is verified — stash the email for verifyOtp.
    _pendingEmail = email;
    return AppUser(id: '', name: name, email: email, isGuest: false);
  }

  @override
  Future<void> verifyOtp(String code) async {
    final email = _pendingEmail;
    if (email == null) {
      throw StateError('No pending verification — call signUp/link first');
    }
    final res = await _dio.post<Map<String, dynamic>>(
      '/v1/auth/verify-otp',
      data: {'email': email, 'code': code},
    );
    _pendingEmail = null;
    final user = await _consumeSession(res.data!);
    _emit(user);
  }

  @override
  Future<AppUser> linkGuestToAccount({
    required String email,
    required String password,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/v1/auth/link-guest',
      data: {'email': email, 'password': password},
    );
    _pendingEmail = email;
    // Same user id (guest promoted); verifyOtp finalizes + signs in.
    return (_user ?? AppUser(id: '', name: email.split('@').first)).copyWith(
      email: email,
      isGuest: false,
    );
  }

  @override
  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/v1/auth/change-password',
      data: {'old_password': oldPassword, 'new_password': newPassword},
    );
    // Backend revokes other sessions but keeps this one; nothing else to do.
  }

  @override
  Future<void> forgotPassword(String email) async {
    await _dio.post<Map<String, dynamic>>(
      '/v1/auth/forgot-password',
      data: {'email': email},
    );
  }

  @override
  Future<void> forgotVerify({required String email, required String code}) async {
    await _dio.post<Map<String, dynamic>>(
      '/v1/auth/forgot-password/verify',
      data: {'email': email, 'code': code},
    );
  }

  @override
  Future<void> forgotReset({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    await _dio.post<Map<String, dynamic>>(
      '/v1/auth/forgot-password/reset',
      data: {'email': email, 'code': code, 'new_password': newPassword},
    );
  }

  @override
  Future<void> signOut() async {
    try {
      await _dio.post<Map<String, dynamic>>('/v1/auth/signout');
    } on Object catch (_) {
      // Best-effort; clear locally regardless.
    }
    await _tokens.clear();
    _emit(null);
  }

  @override
  void dispose() => _controller.close();

  // ---- internals ---------------------------------------------------------

  /// Persist the token pair from an auth response, then build the full user.
  Future<AppUser> _consumeSession(Map<String, dynamic> data) async {
    final access = data['access_token'] as String?;
    final refresh = data['refresh_token'] as String?;
    if (access != null && refresh != null) {
      await _tokens.save(access: access, refresh: refresh);
    }
    final u = (data['user'] as Map?)?.cast<String, dynamic>() ?? const {};
    final id = (u['id'] as String?) ?? '';
    final isGuest = (u['is_guest'] as bool?) ?? false;
    final profileUser = await _fetchProfileUser(idFallback: id, isGuestFallback: isGuest);
    return profileUser ??
        AppUser(
          id: id,
          name: (u['email'] as String?)?.split('@').first ?? 'You',
          email: u['email'] as String?,
          isGuest: isGuest,
        );
  }

  /// GET /profile → AppUser. Note: `/profile` has no `id`, so it's supplied by
  /// the caller (from the auth response or a prior session).
  Future<AppUser?> _fetchProfileUser({
    required String idFallback,
    required bool isGuestFallback,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/profile');
    final p = res.data;
    if (p == null) return null;
    final email = p['email'] as String?;
    final name = (p['name'] as String?) ??
        (email != null ? email.split('@').first : 'You');
    return AppUser(
      id: idFallback,
      name: name,
      email: email,
      isGuest: (p['is_guest'] as bool?) ?? isGuestFallback,
      university: p['university'] as String?,
      program: p['program'] as String?,
      gender: p['gender'] as String?,
      avatarUrl: p['avatar_index'] != null ? '${p['avatar_index']}' : null,
    );
  }
}
