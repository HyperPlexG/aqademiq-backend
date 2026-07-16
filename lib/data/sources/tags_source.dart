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

/// Live impl against `/v1/study-tags`. The backend keys tags by **label** for
/// delete, so `delete(id)` resolves the id → label via the current list first.
/// Create/delete return the full refreshed list (the interface contract).
class ApiTagsSource implements TagsSource {
  ApiTagsSource(this._dio);
  final Dio _dio;

  @override
  Future<List<TagDto>> all() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/study-tags');
    final list = (res.data?['tags'] as List?) ?? const [];
    return list.map((j) => _fromTag((j as Map).cast<String, dynamic>())).toList(growable: false);
  }

  @override
  Future<List<TagDto>> create(TagDto tag) async {
    await _dio.post<Map<String, dynamic>>(
      '/v1/study-tags',
      data: {'label': tag.label, 'color': tag.color},
    );
    return all();
  }

  @override
  Future<List<TagDto>> delete(String id) async {
    final current = await all();
    final match = current.where((t) => t.id == id).toList();
    if (match.isNotEmpty) {
      await _dio.delete<dynamic>('/v1/study-tags/${Uri.encodeComponent(match.first.label)}');
    }
    return all();
  }

  TagDto _fromTag(Map<String, dynamic> j) => TagDto(
        id: j['id'] as String,
        label: (j['label'] as String?) ?? '',
        color: (j['color'] as String?) ?? '#8E8E93',
      );
}
