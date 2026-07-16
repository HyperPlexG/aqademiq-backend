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

  /// A short-TTL signed URL to view/download a material, or null if the file
  /// isn't backed by real storage (mock mode).
  Future<String?> fileDownloadUrl(String fileId);
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

  @override
  Future<String?> fileDownloadUrl(String fileId) => mockDelay<String?>(null);
}

/// Live impl against `/v1/subjects` + `/v1/semesters`. Backend uses
/// `color_hex`/`prof`/`semester_id`/`target_grade`/`files_count`; this maps
/// them onto the app's [SubjectDto].
class ApiSubjectsSource implements SubjectsSource {
  ApiSubjectsSource(this._dio);
  final Dio _dio;

  static String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Future<List<SubjectDto>> all() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/subjects');
    final list = (res.data?['subjects'] as List?) ?? const [];
    return list
        .map((j) => _fromSubject((j as Map).cast<String, dynamic>()))
        .toList(growable: false);
  }

  @override
  Future<List<SemesterDto>> semesters() async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/semesters');
    final list = (res.data?['semesters'] as List?) ?? const [];
    return list
        .map((j) => SemesterDto(
              id: (j as Map)['id'] as String,
              name: (j['name'] as String?) ?? '',
            ))
        .toList(growable: false);
  }

  @override
  Future<SubjectDto> upsert(SubjectDto subject) async {
    final body = <String, dynamic>{
      'name': subject.name,
      'color_hex': subject.color,
      if (subject.semesterId.isNotEmpty) 'semester_id': subject.semesterId,
      if (subject.code != null) 'code': subject.code,
      if (subject.credits != null) 'credits': subject.credits,
      if (subject.professor != null) 'prof': subject.professor,
      if (subject.targetGrade != null) 'target_grade': subject.targetGrade,
      if (subject.mood != null) 'mood': subject.mood,
    };
    final res = subject.id.isEmpty
        ? await _dio.post<Map<String, dynamic>>('/v1/subjects', data: body)
        : await _dio.patch<Map<String, dynamic>>('/v1/subjects/${subject.id}', data: body);
    return _fromSubject(res.data!);
  }

  @override
  Future<void> delete(String id) async {
    await _dio.delete<dynamic>('/v1/subjects/$id');
  }

  @override
  Future<SemesterDto> upsertSemester(SemesterDto semester) async {
    if (semester.id.isEmpty) {
      final now = DateTime.now();
      final res = await _dio.post<Map<String, dynamic>>('/v1/semesters', data: {
        'name': semester.name,
        'start': _ymd(DateTime(now.year, now.month, now.day)),
        'end': _ymd(DateTime(now.year, now.month + 6, now.day)),
      });
      return SemesterDto(id: res.data!['id'] as String, name: res.data!['name'] as String);
    }
    final res = await _dio.patch<Map<String, dynamic>>(
      '/v1/semesters/${semester.id}',
      data: {'name': semester.name},
    );
    return SemesterDto(id: res.data!['id'] as String, name: res.data!['name'] as String);
  }

  @override
  Future<void> deleteSemester(String id) async {
    await _dio.delete<dynamic>('/v1/semesters/$id');
  }

  @override
  Future<String?> fileDownloadUrl(String fileId) async {
    final res = await _dio.get<Map<String, dynamic>>('/v1/files/$fileId/download');
    return res.data?['url'] as String?;
  }

  SubjectDto _fromSubject(Map<String, dynamic> j) => SubjectDto(
        id: j['id'] as String,
        name: (j['name'] as String?) ?? '',
        color: (j['color_hex'] as String?) ?? '#8E8E93',
        semesterId: (j['semester_id'] as String?) ?? '',
        code: j['code'] as String?,
        targetGrade: j['target_grade'] as String?,
        professor: j['prof'] as String?,
        credits: (j['credits'] as num?)?.toInt(),
        mood: (j['mood'] as num?)?.toInt(),
        nextLabel: j['next_label'] as String?,
        fileCount: (j['files_count'] as num?)?.toInt() ?? 0,
        files: ((j['files'] as List?) ?? const [])
            .map((f) => SubjectFileDto(
                  id: (f as Map)['id'] as String,
                  name: (f['name'] as String?) ?? '',
                  kind: f['kind'] as String?,
                  sizeLabel: f['size_label'] as String?,
                  important: (f['important'] as bool?) ?? false,
                ))
            .toList(),
      );
}
