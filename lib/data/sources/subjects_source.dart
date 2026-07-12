import 'package:dio/dio.dart';

import '../dtos/subject_dto.dart';
import '../fixtures/fixtures.dart';
import 'mock_latency.dart';

abstract interface class SubjectsSource {
  Future<List<SubjectDto>> all();
  Future<List<SemesterDto>> semesters();
  Future<SubjectDto> upsert(SubjectDto subject);
  Future<void> delete(String id);
  Future<SemesterDto> upsertSemester(SemesterDto semester);
  Future<void> deleteSemester(String id);
}

class MockSubjectsSource implements SubjectsSource {
  final List<SubjectDto> _subjects = [...Fixtures.subjects];
  final List<SemesterDto> _semesters = [...Fixtures.semesters];

  @override
  Future<List<SubjectDto>> all() =>
      mockDelay(List<SubjectDto>.unmodifiable(_subjects));

  @override
  Future<List<SemesterDto>> semesters() =>
      mockDelay(List<SemesterDto>.unmodifiable(_semesters));

  @override
  Future<SubjectDto> upsert(SubjectDto subject) async {
    final created = subject.id.isEmpty
        ? subject.copyWith(id: 'subj-${DateTime.now().microsecondsSinceEpoch}')
        : subject;
    final i = _subjects.indexWhere((s) => s.id == created.id);
    if (i >= 0) {
      _subjects[i] = created;
    } else {
      _subjects.add(created);
    }
    return mockDelay(created);
  }

  @override
  Future<void> delete(String id) async {
    _subjects.removeWhere((s) => s.id == id);
    return mockDelayVoid();
  }

  @override
  Future<SemesterDto> upsertSemester(SemesterDto semester) async {
    final created = semester.id.isEmpty
        ? semester.copyWith(id: 'sem-${DateTime.now().microsecondsSinceEpoch}')
        : semester;
    final i = _semesters.indexWhere((s) => s.id == created.id);
    if (i >= 0) {
      _semesters[i] = created;
    } else {
      _semesters.add(created);
    }
    return mockDelay(created);
  }

  @override
  Future<void> deleteSemester(String id) async {
    _semesters.removeWhere((s) => s.id == id);
    return mockDelayVoid();
  }
}

class ApiSubjectsSource implements SubjectsSource {
  ApiSubjectsSource(this._dio);
  // Retained for the §8 wiring pass; real requests use this Dio.
  // ignore: unused_field
  final Dio _dio;

  Never _notWired() =>
      throw UnimplementedError('ApiSubjectsSource is wired in the §8 pass.');

  @override
  Future<List<SubjectDto>> all() => _notWired();
  @override
  Future<List<SemesterDto>> semesters() => _notWired();
  @override
  Future<SubjectDto> upsert(SubjectDto subject) => _notWired();
  @override
  Future<void> delete(String id) => _notWired();
  @override
  Future<SemesterDto> upsertSemester(SemesterDto semester) => _notWired();
  @override
  Future<void> deleteSemester(String id) => _notWired();
}
