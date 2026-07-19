import 'package:dio/dio.dart';

import '../dtos/subject_dto.dart';
import '../fixtures/fixtures.dart';
import 'mock_latency.dart';

abstract interface class SubjectsSource {
  Future<List<SubjectDto>> all();
  Future<List<SemesterDto>> semesters();
  Future<SubjectDto> upsert(SubjectDto subject);
  Future<void> delete(String id);
  Future<SemesterDto> upsertSemester(
    SemesterDto semester, {
    DateTime? start,
    DateTime? end,
  });
  Future<void> deleteSemester(String id);

  /// Uploads a material for [subjectId] and returns the created file. Live impl
  /// runs the presign → PUT → commit handshake; mock impl fakes it locally.
  Future<SubjectFileDto> uploadFile({
    required String subjectId,
    required String name,
    required String kind,
    String? mimeType,
    required List<int> bytes,
  });

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
  Future<SemesterDto> upsertSemester(
    SemesterDto semester, {
    DateTime? start,
    DateTime? end,
  }) async {
    // The Semester model only carries id + name, so start/end aren't stored in
    // mock mode — they exist to drive the live API's date range.
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
  Future<SubjectFileDto> uploadFile({
    required String subjectId,
    required String name,
    required String kind,
    String? mimeType,
    required List<int> bytes,
  }) async {
    // No real storage in mock mode: fabricate a file and attach it to the
    // subject so the materials list updates end-to-end.
    final file = SubjectFileDto(
      id: 'file-${DateTime.now().microsecondsSinceEpoch}',
      name: name,
      kind: kind,
      sizeLabel: _sizeLabel(bytes.length),
    );
    final i = _subjects.indexWhere((s) => s.id == subjectId);
    if (i >= 0) {
      final subject = _subjects[i];
      _subjects[i] = subject.copyWith(
        files: [...subject.files, file],
        fileCount: subject.fileCount + 1,
      );
    }
    return mockDelay(file);
  }

  static String _sizeLabel(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
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
  Future<SemesterDto> upsertSemester(
    SemesterDto semester, {
    DateTime? start,
    DateTime? end,
  }) async {
    if (semester.id.isEmpty) {
      final now = DateTime.now();
      final startDate = start ?? DateTime(now.year, now.month, now.day);
      final endDate = end ?? DateTime(now.year, now.month + 6, now.day);
      final res = await _dio.post<Map<String, dynamic>>('/v1/semesters', data: {
        'name': semester.name,
        'start': _ymd(startDate),
        'end': _ymd(endDate),
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
  Future<SubjectFileDto> uploadFile({
    required String subjectId,
    required String name,
    required String kind,
    String? mimeType,
    required List<int> bytes,
  }) async {
    final contentType = mimeType ?? 'application/octet-stream';

    // Preferred path: presign → PUT bytes → commit. Only the legacy storage
    // backend exposes `/v1/uploads/*`; the current Supabase Edge port does not
    // (no storage/presign ported yet), so this 404s there and we fall back to
    // metadata registration below.
    try {
      final init =
          await _dio.post<Map<String, dynamic>>('/v1/uploads/init', data: {
        'subject_id': subjectId,
        'name': name,
        'kind': kind,
        'mime_type': contentType,
        'size_bytes': bytes.length,
      });
      final fileId = init.data!['file_id'] as String;
      final uploadUrl = init.data!['upload_url'] as String;

      // PUT straight to storage with a bare Dio so the signed URL isn't sent
      // the API client's base URL or Authorization header.
      await Dio().put<void>(
        uploadUrl,
        data: Stream<List<int>>.fromIterable([bytes]),
        options: Options(
          headers: <String, dynamic>{
            Headers.contentTypeHeader: contentType,
            Headers.contentLengthHeader: bytes.length,
          },
        ),
      );

      final commit =
          await _dio.post<Map<String, dynamic>>('/v1/uploads/$fileId/commit');
      return _fromFile(commit.data!, name: name, kind: kind);
    } on DioException catch (e) {
      // Endpoint absent on this backend — register file metadata instead.
      final status = e.response?.statusCode;
      if (status != 404 && status != 501) rethrow;
      final res = await _dio.post<Map<String, dynamic>>(
        '/v1/subjects/$subjectId/files',
        data: {'name': name, 'kind': kind},
      );
      return _fromFile(res.data!, name: name, kind: kind);
    }
  }

  SubjectFileDto _fromFile(
    Map<String, dynamic> j, {
    required String name,
    required String kind,
  }) =>
      SubjectFileDto(
        id: j['id'] as String,
        name: (j['name'] as String?) ?? name,
        kind: (j['kind'] as String?) ?? kind,
        important: (j['important'] as bool?) ?? false,
      );

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
