import '../dtos/app_user_dto.dart';
import '../dtos/focus_session_dto.dart';
import '../dtos/mood_log_dto.dart';
import '../dtos/subject_dto.dart';
import '../dtos/tag_dto.dart';
import '../dtos/task_dto.dart';
import '../dtos/user_stats_dto.dart';

/// Seed data for the mock sources. The PLAN_TIMELINE values mirror the v5
/// artboard exactly (Wednesday, JUN 2026; the four demo tasks) so the default
/// home screen is pixel-faithful out of the box.
abstract final class Fixtures {
  /// The demo "today" used by the default Plan view (artboard shows Wed, week 1–7).
  static final DateTime today = DateTime(2026, 6, 3);

  /// Course-code tags shown on the timeline (CC 401 violet, NLP 302 lecture-blue).
  static const List<TagDto> tags = [
    TagDto(id: 'cc401', label: 'CC 401', color: '#6b5cf0'),
    TagDto(id: 'nlp302', label: 'NLP 302', color: '#5cbbff'),
  ];

  /// Default study-tag palette (Settings CRUD seed) — README §3.
  static const List<TagDto> studyTagPalette = [
    TagDto(id: 'lecture', label: 'Lecture', color: '#5cbbff'),
    TagDto(id: 'class', label: 'Class', color: '#6b5cf0'),
    TagDto(id: 'exam', label: 'Exam', color: '#e85476'),
    TagDto(id: 'assignment', label: 'Assignment', color: '#2a9d6b'),
    TagDto(id: 'report', label: 'Report', color: '#e8a430'),
    TagDto(id: 'presentation', label: 'Presentation', color: '#c0497b'),
    TagDto(id: 'reading', label: 'Reading', color: '#7a8699'),
  ];

  static List<TaskDto> tasksForToday() => [
        // Anytime
        TaskDto(
          id: 't1',
          title: 'Read chapter 4',
          tagId: 'cc401',
          date: today,
          timeOfDay: 'anytime',
          durationMin: 10,
        ),
        TaskDto(
          id: 't2',
          title: 'Review lecture slides',
          tagId: 'nlp302',
          date: today,
          timeOfDay: 'anytime',
          durationMin: 5,
        ),
        // Planned
        TaskDto(
          id: 't3',
          title: 'LL(1) parsing notes',
          tagId: 'cc401',
          date: today,
          startTime: DateTime(2026, 6, 3, 11, 30),
          durationMin: 30,
          subtasks: const [
            SubtaskDto(id: 't3s1', title: 'Re-read grammar', done: true),
            SubtaskDto(id: 't3s2', title: 'Build parse table'),
            SubtaskDto(id: 't3s3', title: 'Trace an example'),
          ],
        ),
        TaskDto(
          id: 't4',
          title: 'Assignment 3 draft',
          tagId: 'nlp302',
          date: today,
          startTime: DateTime(2026, 6, 3, 12),
          durationMin: 30,
        ),
      ];

  static const List<SubjectDto> subjects = [
    SubjectDto(
      id: 'cc401',
      name: 'Compiler Construction',
      color: '#6b5cf0',
      semesterId: 'sem1',
      code: 'CC 401',
      targetGrade: 'A',
      professor: 'Prof. S. Rao',
      credits: 4,
      mood: 1,
      nextLabel: 'Viva · 3 days',
      focusHours: 4.5,
      fileCount: 3,
    ),
    SubjectDto(
      id: 'nlp302',
      name: 'Natural Language Processing',
      color: '#5cbbff',
      semesterId: 'sem1',
      code: 'NLP 302',
      targetGrade: 'A−',
      professor: 'Dr. A. Mehta',
      credits: 3,
      mood: 3,
      nextLabel: 'Assignment · Fri',
      focusHours: 2,
      fileCount: 2,
    ),
    SubjectDto(
      id: 'net305',
      name: 'Computer Networks',
      color: '#2a9d6b',
      semesterId: 'sem1',
      code: 'NET 305',
      targetGrade: 'B+',
      professor: 'Prof. K. Iyer',
      credits: 4,
      mood: 2,
      nextLabel: 'Lab · tomorrow',
      focusHours: 3,
      fileCount: 4,
    ),
    SubjectDto(
      id: 'dbs310',
      name: 'Database Systems',
      color: '#e8a430',
      semesterId: 'sem1',
      code: 'DBS 310',
      targetGrade: 'A',
      professor: 'Dr. N. Khan',
      mood: 3,
      focusHours: 1.5,
      fileCount: 1,
    ),
  ];

  static const List<SemesterDto> semesters = [
    SemesterDto(id: 'sem1', name: "Spring '26"),
  ];

  static const AppUserDto guestUser = AppUserDto(
    id: 'guest-local',
    name: 'Guest',
  );

  static final List<MoodLogDto> weekMoods = [
    MoodLogDto(id: 'm1', date: today.subtract(const Duration(days: 2)), phase: 'evening', mood: 3),
    MoodLogDto(id: 'm2', date: today.subtract(const Duration(days: 1)), phase: 'evening', mood: 2),
    MoodLogDto(id: 'm3', date: today, phase: 'morning', mood: 4),
  ];

  static UserStatsDto stats() => UserStatsDto(
        streakDays: 5,
        focusMinutesThisWeek: 220,
        tasksCompletedThisWeek: 12,
        weekMoods: weekMoods,
      );

  static const List<FocusSessionDto> recentSessions = [];
}
