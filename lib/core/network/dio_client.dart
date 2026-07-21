import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../env/env.dart';
import 'auth_interceptor.dart';
import 'logging_interceptor.dart';

/// The shared Dio instance for the NestJS REST API on Cloud Run.
///
/// Base URL is supplied at build time via `--dart-define=API_BASE_URL=...`
/// (empty in mock mode, where this client is never exercised). Requests carry
/// the Bearer access token and refresh once on 401 via [AuthInterceptor].
/// Feature data sources call `/v1/...` paths against this client.
final dioProvider = Provider<Dio>((ref) {
  final options = BaseOptions(
    // Empty in mock builds; supplied via --dart-define for live builds.
    // Never ends in `/v1` — Env normalizes it; paths supply their own `/v1`.
    baseUrl: Env.apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 20),
    contentType: Headers.jsonContentType,
  );

  final dio = Dio(options);
  // Bare client (no auth interceptor) dedicated to replaying a request after a
  // token refresh, so the retry can never recurse into itself.
  final replayDio = Dio(options);

  dio.interceptors.add(AuthInterceptor(replayDio));
  // Added last so request logs show the final auth header, and response logs
  // run first on the way back. Silent in release builds.
  dio.interceptors.add(LoggingInterceptor());
  return dio;
});
