import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/auth/token_store.dart';
import '../env/env.dart';
import 'auth_interceptor.dart';

/// The shared Dio instance for the NestJS REST API on Cloud Run.
///
/// Base URL is supplied at build time via `--dart-define=API_BASE_URL=...`
/// (empty in mock mode, where this client is never exercised). Requests carry
/// the Bearer access token and refresh once on 401 via [AuthInterceptor].
/// Feature data sources call `/v1/...` paths against this client.
final dioProvider = Provider<Dio>((ref) {
  final options = BaseOptions(
    // Empty in mock builds; supplied via --dart-define for live builds.
    // ignore: avoid_redundant_argument_values
    baseUrl: Env.apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 20),
    contentType: Headers.jsonContentType,
  );

  final dio = Dio(options);
  // Bare client (no auth interceptor) dedicated to the refresh call + replays,
  // so token refresh can never recurse into itself.
  final refreshDio = Dio(options);

  dio.interceptors.add(AuthInterceptor(ref.watch(tokenStoreProvider), refreshDio));
  return dio;
});
