import 'package:dio/dio.dart';

import '../../data/auth/token_store.dart';

/// Attaches the Bearer access token to every request and transparently refreshes
/// it once on a 401 (rotating refresh token), then retries the original request.
///
/// Uses [QueuedInterceptor] so concurrent requests that all 401 trigger a single
/// refresh rather than a stampede. [_refreshDio] is a bare Dio (no interceptor)
/// so the refresh call itself can't recurse. Matches the backend contract:
/// `POST /v1/auth/refresh {refresh_token}` → `{access_token, refresh_token}`.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(this._tokens, this._refreshDio);

  final TokenStore _tokens;
  final Dio _refreshDio;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final access = await _tokens.readAccess();
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
    final isUnauthorized = err.response?.statusCode == 401;
    final isRefreshCall = err.requestOptions.path.contains('/auth/refresh');
    if (!isUnauthorized || isRefreshCall) {
      return handler.next(err);
    }

    final refreshed = await _tryRefresh();
    if (!refreshed) {
      return handler.next(err);
    }

    // Replay the original request with the new access token.
    final access = await _tokens.readAccess();
    final req = err.requestOptions..headers['Authorization'] = 'Bearer $access';
    try {
      final response = await _refreshDio.fetch<dynamic>(req);
      return handler.resolve(response);
    } on Object catch (_) {
      return handler.next(err);
    }
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _tokens.readRefresh();
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final res = await _refreshDio.post<Map<String, dynamic>>(
        '/v1/auth/refresh',
        data: {'refresh_token': refresh},
      );
      final data = res.data;
      final access = data?['access_token'] as String?;
      if (access == null || access.isEmpty) return false;
      final newRefresh = data?['refresh_token'] as String? ?? refresh;
      await _tokens.save(access: access, refresh: newRefresh);
      return true;
    } on Object catch (_) {
      // Refresh reuse/expiry → drop the session; the app falls back to signed-out.
      await _tokens.clear();
      return false;
    }
  }
}
