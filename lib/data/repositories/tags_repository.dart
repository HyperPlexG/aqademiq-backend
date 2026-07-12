import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env/env.dart';
import '../../core/network/dio_client.dart';
import '../adapters/adapters.dart';
import '../dtos/tag_dto.dart';
import '../models/tag.dart';
import '../sources/tags_source.dart';

class TagsRepository {
  TagsRepository(this._source);

  final TagsSource _source;

  Future<List<Tag>> all() async {
    final dtos = await _source.all();
    return dtos.map((d) => d.toModel()).toList(growable: false);
  }

  Future<List<Tag>> create({required String label, required String colorHex}) async {
    final dtos = await _source.create(TagDto(id: _idFor(label), label: label, color: colorHex));
    return dtos.map((d) => d.toModel()).toList(growable: false);
  }

  Future<List<Tag>> delete(String id) async {
    final dtos = await _source.delete(id);
    return dtos.map((d) => d.toModel()).toList(growable: false);
  }

  /// Stable slug id from a label, with a deterministic uniqueness suffix.
  String _idFor(String label) {
    final slug = label.toLowerCase().trim().replaceAll(RegExp('[^a-z0-9]+'), '-');
    final base = slug.isEmpty ? 'tag' : slug;
    return '$base-${label.hashCode.toUnsigned(16)}';
  }
}

final tagsRepositoryProvider = Provider<TagsRepository>((ref) {
  final source =
      Env.useMocks ? MockTagsSource() : ApiTagsSource(ref.watch(dioProvider));
  return TagsRepository(source);
});

/// Tags as a CRUD-aware notifier — create/delete mutate the store and refresh
/// every consumer (Settings card, Plan tag list, add-task chips).
class TagsController extends AsyncNotifier<List<Tag>> {
  @override
  Future<List<Tag>> build() => ref.watch(tagsRepositoryProvider).all();

  Future<void> add({required String label, required String colorHex}) async {
    final tags = await ref.read(tagsRepositoryProvider).create(label: label, colorHex: colorHex);
    state = AsyncData(tags);
  }

  Future<void> remove(String id) async {
    final tags = await ref.read(tagsRepositoryProvider).delete(id);
    state = AsyncData(tags);
  }
}

final tagsProvider = AsyncNotifierProvider<TagsController, List<Tag>>(TagsController.new);

final tagsByIdProvider = FutureProvider<Map<String, Tag>>((ref) async {
  final tags = await ref.watch(tagsProvider.future);
  return {for (final t in tags) t.id: t};
});
