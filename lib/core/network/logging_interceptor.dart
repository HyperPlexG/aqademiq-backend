import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Prints every REST request and its response (and errors) to the terminal.
///
/// Active in debug/profile only (`kReleaseMode` stays silent). Long JSON bodies
/// are pretty-printed and chunked so nothing gets truncated by `debugPrint`.
/// The `Authorization` bearer is masked to a short fingerprint so access tokens
/// never land in a shared log.
class LoggingInterceptor extends Interceptor {
  static const _tag = 'API';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!kReleaseMode) {
      options.extra['__start__'] = DateTime.now().millisecondsSinceEpoch;
      final url = '${options.baseUrl}${options.path}';
      _log('┌── → ${options.method} $url');
      if (options.queryParameters.isNotEmpty) {
        _log('│ query: ${_encode(options.queryParameters)}');
      }
      _log('│ headers: ${_encode(_maskHeaders(options.headers))}');
      if (options.data != null) {
        _log('│ body: ${_encode(options.data)}');
      }
      _log('└──');
    }
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    if (!kReleaseMode) {
      final o = response.requestOptions;
      final url = '${o.baseUrl}${o.path}';
      _log('┌── ← ${response.statusCode} ${o.method} $url${_elapsed(o)}');
      if (response.data != null) {
        _log('│ response: ${_encode(response.data)}');
      }
      _log('└──');
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (!kReleaseMode) {
      final o = err.requestOptions;
      final url = '${o.baseUrl}${o.path}';
      final status = err.response?.statusCode;
      _log('┌── ✖ ${status ?? err.type.name} ${o.method} $url${_elapsed(o)}');
      if (err.response?.data != null) {
        _log('│ error body: ${_encode(err.response!.data)}');
      } else {
        _log('│ error: ${err.message}');
      }
      _log('└──');
    }
    handler.next(err);
  }

  String _elapsed(RequestOptions o) {
    final start = o.extra['__start__'];
    if (start is! int) return '';
    return ' (${DateTime.now().millisecondsSinceEpoch - start}ms)';
  }

  Map<String, dynamic> _maskHeaders(Map<String, dynamic> headers) {
    final masked = Map<String, dynamic>.from(headers);
    final auth = masked['Authorization'];
    if (auth is String && auth.length > 20) {
      masked['Authorization'] =
          '${auth.substring(0, 14)}…${auth.substring(auth.length - 6)}';
    }
    return masked;
  }

  String _encode(Object? data) {
    try {
      return const JsonEncoder.withIndent('  ').convert(data);
    } on Object {
      return data.toString();
    }
  }

  /// `debugPrint` truncates ~1KB lines, so emit long payloads in chunks.
  void _log(String message) {
    const chunk = 900;
    if (message.length <= chunk) {
      debugPrint('[$_tag] $message');
      return;
    }
    for (var i = 0; i < message.length; i += chunk) {
      final end = (i + chunk < message.length) ? i + chunk : message.length;
      debugPrint('[$_tag] ${message.substring(i, end)}');
    }
  }
}
