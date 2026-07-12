import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../env/env.dart';

/// The shared Dio instance for the NestJS REST API on Cloud Run.
///
/// Phase A ships only the base configuration; the §8 wiring pass adds the
/// Identity-Platform ID-token interceptor (Bearer + refresh on 401), retry, and
/// Cloud Trace headers (README §8.2).
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      // Supplied via --dart-define at build time (empty in mock mode).
      // ignore: avoid_redundant_argument_values
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      contentType: Headers.jsonContentType,
    ),
  );
  // TODO(aqademiq): §8 — dio.interceptors.add(AuthTokenInterceptor(...));
  // TODO(aqademiq): §8 — dio.interceptors.add(RetryInterceptor(...));
  // TODO(aqademiq): §8 — dio.interceptors.add(CloudTraceInterceptor());
  return dio;
});
