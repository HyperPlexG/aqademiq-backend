import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/env/env.dart';
import '../models/app_user.dart';
import 'auth_repository.dart';

/// Live [AuthRepository] backed by **Supabase Auth** (the backend switched off the
/// custom `/v1/auth/*` RS256 flow on 2026-07-18). Identity — guest, email/OTP,
/// link-guest, password reset, refresh — is handled by the `supabase_flutter` SDK,
/// which persists the session itself (so the secure token store is no longer used here).
/// Profile detail (name/university/…) is still hydrated over the REST API via Dio;
/// the Dio `AuthInterceptor` attaches the SDK's access token automatically.
///
/// The signup/link flows are two-step (submit → verify-OTP), so this repo stashes
/// the pending email + OTP type between the first call and [verifyOtp], keeping the
/// [AuthRepository] interface (and every screen) unchanged.
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._dio) {
    _controller = StreamController<AppUser?>.broadcast();
    // Mirror the SDK's auth state into AppUser. `initialSession` fires on launch
    // with the persisted session (or null), so a returning user stays signed in.
    _sub = _auth.onAuthStateChange.listen((state) async {
      final session = state.session;
      if (session == null) {
        _emit(null);
        return;
      }
      // Re-hydrate profile detail on meaningful transitions only (not every
      // silent token refresh).
      final hydrate = state.event != AuthChangeEvent.tokenRefreshed;
      _emit(await _mapSession(session, hydrate: hydrate));
    });
  }

  final Dio _dio;
  late final StreamController<AppUser?> _controller;
  late final StreamSubscription<AuthState> _sub;

  GoTrueClient get _auth => Supabase.instance.client.auth;

  AppUser? _user;
  String? _pendingEmail;
  OtpType _pendingOtpType = OtpType.signup;
  bool _googleInitialized = false;

  @override
  AppUser? get currentUser => _user;

  @override
  Stream<AppUser?> authState() => _controller.stream;

  void _emit(AppUser? user) {
    _user = user;
    _controller.add(user);
  }

  @override
  Future<AppUser> signInAnonymously() async {
    final res = await _auth.signInAnonymously();
    return _requireUser(res.session, hydrate: false);
  }

  @override
  Future<AppUser> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final res = await _auth.signInWithPassword(email: email, password: password);
    return _requireUser(res.session);
  }

  @override
  Future<AppUser> signUp({
    required String name,
    required String email,
    required String password,
  }) async {
    final res = await _auth.signUp(
      email: email,
      password: password,
      data: {'name': name},
    );
    // If email confirmation is on, there's no session yet — verify via OTP.
    if (res.session == null) {
      _pendingEmail = email;
      _pendingOtpType = OtpType.signup;
      return AppUser(id: '', name: name, email: email, isGuest: false);
    }
    return _requireUser(res.session);
  }

  @override
  Future<AppUser> signInWithGoogle() async {
    final gsi = GoogleSignIn.instance;
    if (!_googleInitialized) {
      await gsi.initialize(
        serverClientId: Env.googleServerClientId.isNotEmpty ? Env.googleServerClientId : null,
        clientId: (Platform.isIOS && Env.googleIosClientId.isNotEmpty) ? Env.googleIosClientId : null,
      );
      _googleInitialized = true;
    }
    final account = await gsi.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) throw const AuthException('Google did not return an ID token');
    final res = await _auth.signInWithIdToken(provider: OAuthProvider.google, idToken: idToken);
    return _requireUser(res.session);
  }

  @override
  Future<AppUser> signInWithApple() async {
    // Apple requires a nonce: send its SHA-256 to Apple, the raw value to Supabase.
    final rawNonce = _randomNonce();
    final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();
    final cred = await SignInWithApple.getAppleIDCredential(
      scopes: const [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      nonce: hashedNonce,
    );
    final idToken = cred.identityToken;
    if (idToken == null) throw const AuthException('Apple did not return an ID token');
    final res = await _auth.signInWithIdToken(
      provider: OAuthProvider.apple,
      idToken: idToken,
      nonce: rawNonce,
    );
    return _requireUser(res.session);
  }

  @override
  Future<void> verifyOtp(String code) async {
    final email = _pendingEmail;
    if (email == null) {
      throw StateError('No pending verification — call signUp/link first');
    }
    final res = await _auth.verifyOTP(
      email: email,
      token: code,
      type: _pendingOtpType,
    );
    _pendingEmail = null;
    if (res.session != null) _emit(await _mapSession(res.session!));
  }

  @override
  Future<AppUser> linkGuestToAccount({
    required String email,
    required String password,
  }) async {
    // Promote the anonymous user in place — the user id (and all their data) is
    // preserved. Setting a password is immediate; the new email needs OTP confirm.
    await _auth.updateUser(UserAttributes(email: email, password: password));
    _pendingEmail = email;
    _pendingOtpType = OtpType.email;
    final base = _user ?? AppUser(id: _auth.currentUser?.id ?? '', name: email.split('@').first);
    return base.copyWith(email: email, isGuest: false);
  }

  @override
  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    // Supabase has no server-side "verify old password" on update, so re-auth
    // with the current credentials first (this throws on a wrong old password),
    // then set the new one.
    final email = _auth.currentUser?.email;
    if (email != null) {
      await _auth.signInWithPassword(email: email, password: oldPassword);
    }
    await _auth.updateUser(UserAttributes(password: newPassword));
  }

  @override
  Future<void> forgotPassword(String email) async {
    await _auth.resetPasswordForEmail(email);
  }

  @override
  Future<void> forgotVerify({required String email, required String code}) async {
    // Consumes the recovery OTP and establishes a short-lived recovery session,
    // which [forgotReset] then uses to set the new password.
    await _auth.verifyOTP(email: email, token: code, type: OtpType.recovery);
  }

  @override
  Future<void> forgotReset({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    // The recovery session from [forgotVerify] is active; the code is single-use
    // and already consumed, so just apply the new password.
    await _auth.updateUser(UserAttributes(password: newPassword));
  }

  @override
  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } on Object catch (_) {
      // Best-effort; the state stream emits null on SIGNED_OUT regardless.
    }
    _emit(null);
  }

  @override
  void dispose() {
    unawaited(_sub.cancel());
    unawaited(_controller.close());
  }

  // ---- internals ---------------------------------------------------------

  String _randomNonce([int length = 32]) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
    final rand = Random.secure();
    return List.generate(length, (_) => chars[rand.nextInt(chars.length)]).join();
  }

  Future<AppUser> _requireUser(Session? session, {bool hydrate = true}) async {
    if (session == null) {
      throw const AuthException('No session returned');
    }
    final user = await _mapSession(session, hydrate: hydrate);
    _emit(user);
    return user;
  }

  /// Build an [AppUser] from the SDK session, optionally enriching it with
  /// profile detail from `GET /v1/profile`.
  Future<AppUser> _mapSession(Session session, {bool hydrate = true}) async {
    final u = session.user;
    final base = AppUser(
      id: u.id,
      name: (u.userMetadata?['name'] as String?) ??
          (u.email != null ? u.email!.split('@').first : 'You'),
      email: u.email,
      isGuest: u.isAnonymous,
    );
    if (!hydrate) return base;
    try {
      final res = await _dio.get<Map<String, dynamic>>('/v1/profile');
      final p = res.data;
      if (p == null) return base;
      final email = (p['email'] as String?) ?? base.email;
      return base.copyWith(
        name: (p['name'] as String?) ?? base.name,
        email: email,
        isGuest: (p['is_guest'] as bool?) ?? base.isGuest,
        university: p['university'] as String?,
        program: p['program'] as String?,
        gender: p['gender'] as String?,
        avatarUrl: p['avatar_index'] != null ? '${p['avatar_index']}' : null,
      );
    } on Object catch (_) {
      return base;
    }
  }
}
