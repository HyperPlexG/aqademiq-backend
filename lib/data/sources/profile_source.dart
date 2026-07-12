import 'package:dio/dio.dart';

import '../dtos/user_stats_dto.dart';
import '../fixtures/fixtures.dart';
import 'mock_latency.dart';

abstract interface class ProfileSource {
  Future<UserStatsDto> stats();
}

class MockProfileSource implements ProfileSource {
  @override
  Future<UserStatsDto> stats() => mockDelay(Fixtures.stats());
}

class ApiProfileSource implements ProfileSource {
  ApiProfileSource(this._dio);
  // Retained for the §8 wiring pass; real requests use this Dio.
  // ignore: unused_field
  final Dio _dio;

  @override
  Future<UserStatsDto> stats() =>
      throw UnimplementedError('ApiProfileSource is wired in the §8 pass.');
}
