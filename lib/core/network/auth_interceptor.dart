import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Attaches the Supabase access token to every request and transparently refreshes
/// it once on a 401, then retries the original request.
///
/// The `supabase_flutter` SDK owns the token lifecycle (persistence + rotation),
/// so this interceptor just reads `currentSession` and calls `refreshSession()`.
/// Uses [QueuedInterceptor] so concurrent 401s trigger a single refresh rather
/// than a stampede. [_replayDio] is a bare Dio (no interceptor) so the replay
/// can't recurse.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(this._replayDio);

  final Dio _replayDio;

  GoTrueClient get _auth => Supabase.instance.client.auth;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final access = _auth.currentSession?.accessToken;
    if (access != null && access.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    String? access;
    try {
      final res = await _auth.refreshSession();
      access = res.session?.accessToken;
    } on Object catch (_) {
      // Refresh failed (expired/revoked) → drop the session; app falls back to
      // signed-out via onAuthStateChange.
      await _auth.signOut();
      return handler.next(err);
    }
    if (access == null || access.isEmpty) {
      return handler.next(err);
    }

    // Replay the original request with the new access token.
    final req = err.requestOptions..headers['Authorization'] = 'Bearer $access';
    try {
      final response = await _replayDio.fetch<dynamic>(req);
      return handler.resolve(response);
    } on Object catch (_) {
      return handler.next(err);
    }
  }
}
