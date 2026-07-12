import 'package:dio/dio.dart';

import '../dtos/tag_dto.dart';
import '../fixtures/fixtures.dart';
import 'mock_latency.dart';

abstract interface class TagsSource {
  Future<List<TagDto>> all();

  /// Create a tag and return the full, updated list.
  Future<List<TagDto>> create(TagDto tag);

  /// Delete a tag by id and return the full, updated list.
  Future<List<TagDto>> delete(String id);
}

class MockTagsSource implements TagsSource {
  /// Mutable in-memory store seeded from fixtures so create/delete persist for
  /// the session (README §7, seam 3).
  final List<TagDto> _tags = [
    ...Fixtures.tags,
    ...Fixtures.studyTagPalette,
  ];

  @override
  Future<List<TagDto>> all() => mockDelay(List.unmodifiable(_tags));

  @override
  Future<List<TagDto>> create(TagDto tag) {
    _tags.add(tag);
    return all();
  }

  @override
  Future<List<TagDto>> delete(String id) {
    _tags.removeWhere((t) => t.id == id);
    return all();
  }
}

class ApiTagsSource implements TagsSource {
  ApiTagsSource(this._dio);
  // Retained for the §8 wiring pass; real requests use this Dio.
  // ignore: unused_field
  final Dio _dio;

  @override
  Future<List<TagDto>> all() =>
      throw UnimplementedError('ApiTagsSource is wired in the §8 pass.');

  @override
  Future<List<TagDto>> create(TagDto tag) =>
      throw UnimplementedError('ApiTagsSource is wired in the §8 pass.');

  @override
  Future<List<TagDto>> delete(String id) =>
      throw UnimplementedError('ApiTagsSource is wired in the §8 pass.');
}
