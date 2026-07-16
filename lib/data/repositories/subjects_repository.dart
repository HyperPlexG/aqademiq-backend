import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env/env.dart';
import '../../core/network/dio_client.dart';
import '../adapters/adapters.dart';
import '../auth/auth_repository.dart';
import '../models/subject.dart';
import '../sources/subjects_source.dart';

class SubjectsRepository {
  SubjectsRepository(this._source);

  final SubjectsSource _source;

  Future<List<Subject>> all() async {
    final dtos = await _source.all();
    return dtos.map((d) => d.toModel()).toList(growable: false);
  }

  Future<List<Semester>> semesters() async {
    final dtos = await _source.semesters();
    return dtos.map((d) => d.toModel()).toList(growable: false);
  }

  Future<Subject> upsert(Subject subject) async {
    final dto = await _source.upsert(subject.toDto());
    return dto.toModel();
  }

  Future<void> delete(String id) => _source.delete(id);

  Future<Semester> upsertSemester(Semester semester) async {
    final dto = await _source.upsertSemester(semester.toDto());
    return dto.toModel();
  }

  Future<void> deleteSemester(String id) => _source.deleteSemester(id);

  Future<String?> fileDownloadUrl(String fileId) =>
      _source.fileDownloadUrl(fileId);
}

final subjectsRepositoryProvider = Provider<SubjectsRepository>((ref) {
  final source = Env.useMocks
      ? MockSubjectsSource()
      : ApiSubjectsSource(ref.watch(dioProvider));
  return SubjectsRepository(source);
});

/// Subjects as a CRUD-aware notifier — save/remove mutate the store and refresh
/// every consumer (list, detail, onboarding).
class SubjectsController extends AsyncNotifier<List<Subject>> {
  @override
  Future<List<Subject>> build() {
    // A fresh guest has no subjects yet — they're created during onboarding.
    if (ref.watch(isGuestProvider)) return Future.value(const <Subject>[]);
    return ref.watch(subjectsRepositoryProvider).all();
  }

  Future<Subject> save(Subject subject) async {
    final saved = await ref.read(subjectsRepositoryProvider).upsert(subject);
    ref.invalidateSelf();
    return saved;
  }

  Future<void> remove(String id) async {
    await ref.read(subjectsRepositoryProvider).delete(id);
    ref.invalidateSelf();
  }
}

final subjectsProvider =
    AsyncNotifierProvider<SubjectsController, List<Subject>>(
  SubjectsController.new,
);

/// Semesters as a CRUD-aware notifier — save/remove mutate the store and refresh
/// the Subjects header and the semester sheets.
class SemestersController extends AsyncNotifier<List<Semester>> {
  @override
  Future<List<Semester>> build() =>
      ref.watch(subjectsRepositoryProvider).semesters();

  Future<Semester> save(Semester semester) async {
    final saved =
        await ref.read(subjectsRepositoryProvider).upsertSemester(semester);
    ref.invalidateSelf();
    return saved;
  }

  Future<void> remove(String id) async {
    await ref.read(subjectsRepositoryProvider).deleteSemester(id);
    ref.invalidateSelf();
  }
}

final semestersProvider =
    AsyncNotifierProvider<SemestersController, List<Semester>>(
  SemestersController.new,
);

final subjectsByIdProvider = FutureProvider<Map<String, Subject>>((ref) async {
  final subjects = await ref.watch(subjectsProvider.future);
  return {for (final s in subjects) s.id: s};
});

/// The currently selected semester id (header label + "switch" persistence).
/// `null` means "follow the first available semester" (resolved by consumers).
final selectedSemesterProvider =
    NotifierProvider<SelectedSemesterController, String?>(
  SelectedSemesterController.new,
);

class SelectedSemesterController extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String id) => state = id;
}
