import '../dtos/ada_message_dto.dart';
import '../dtos/app_user_dto.dart';
import '../dtos/focus_session_dto.dart';
import '../dtos/mood_log_dto.dart';
import '../dtos/subject_dto.dart';
import '../dtos/tag_dto.dart';
import '../dtos/task_dto.dart';
import '../dtos/user_stats_dto.dart';
import '../models/ada_message.dart';
import '../models/app_user.dart';
import '../models/enums.dart';
import '../models/focus_session.dart';
import '../models/mood_log.dart';
import '../models/subject.dart';
import '../models/tag.dart';
import '../models/task.dart';
import '../models/user_stats.dart';

/// The single seam (README §7, seam 2) that maps raw API DTOs onto the immutable
/// UI models widgets consume. When the NestJS schema drifts, this file changes —
/// not the 88 screens.

T _enumByName<T extends Enum>(List<T> values, String? name, T fallback) {
  for (final v in values) {
    if (v.name == name) return v;
  }
  return fallback;
}

extension TaskDtoX on TaskDto {
  Task toModel() => Task(
        id: id,
        title: title,
        tagId: tagId,
        date: date,
        dayPart: DayPartX.fromWire(timeOfDay),
        startTime: startTime,
        durationMin: durationMin,
        repeat: repeat?.toModel(),
        subtasks: subtasks.map((s) => s.toModel()).toList(),
        done: done,
      );
}

extension SubtaskDtoX on SubtaskDto {
  Subtask toModel() => Subtask(id: id, title: title, done: done);
}

/// Reverse mappers (UI model -> DTO) for writes (create / update).
extension TaskX on Task {
  TaskDto toDto() => TaskDto(
        id: id,
        title: title,
        tagId: tagId,
        date: date,
        timeOfDay: dayPart?.wire,
        startTime: startTime,
        durationMin: durationMin,
        repeat: repeat?.toDto(),
        subtasks: subtasks.map((s) => s.toDto()).toList(),
        done: done,
      );
}

extension SubtaskX on Subtask {
  SubtaskDto toDto() => SubtaskDto(id: id, title: title, done: done);
}

extension RepeatRuleX on RepeatRule {
  RepeatRuleDto toDto() => RepeatRuleDto(
        frequency: frequency.name,
        interval: interval,
        weekdays: weekdays,
      );
}

extension RepeatRuleDtoX on RepeatRuleDto {
  RepeatRule toModel() => RepeatRule(
        frequency:
            _enumByName(RepeatFrequency.values, frequency, RepeatFrequency.none),
        interval: interval,
        weekdays: weekdays,
      );
}

extension SubjectDtoX on SubjectDto {
  Subject toModel() => Subject(
        id: id,
        name: name,
        color: color,
        semesterId: semesterId,
        code: code,
        target: target?.toModel(),
        targetGrade: targetGrade,
        professor: professor,
        credits: credits,
        mood: mood,
        nextLabel: nextLabel,
        focusHours: focusHours,
        fileCount: fileCount,
        files: files.map((f) => f.toModel()).toList(),
      );
}

extension SubjectFileDtoX on SubjectFileDto {
  SubjectFile toModel() => SubjectFile(
        id: id,
        name: name,
        kind: kind,
        sizeLabel: sizeLabel,
        important: important,
      );
}

extension SubjectFileX on SubjectFile {
  SubjectFileDto toDto() => SubjectFileDto(
        id: id,
        name: name,
        kind: kind,
        sizeLabel: sizeLabel,
        important: important,
      );
}

extension SubjectTargetDtoX on SubjectTargetDto {
  SubjectTarget toModel() => SubjectTarget(
        kind: _enumByName(
          SubjectTargetKind.values,
          kind,
          SubjectTargetKind.gpa,
        ),
        value: value,
      );
}

extension SubjectX on Subject {
  SubjectDto toDto() => SubjectDto(
        id: id,
        name: name,
        color: color,
        semesterId: semesterId,
        code: code,
        target: target?.toDto(),
        targetGrade: targetGrade,
        professor: professor,
        credits: credits,
        mood: mood,
        nextLabel: nextLabel,
        focusHours: focusHours,
        fileCount: fileCount,
        files: files.map((f) => f.toDto()).toList(),
      );
}

extension SubjectTargetX on SubjectTarget {
  SubjectTargetDto toDto() => SubjectTargetDto(kind: kind.name, value: value);
}

extension SemesterDtoX on SemesterDto {
  Semester toModel() => Semester(id: id, name: name);
}

extension SemesterX on Semester {
  SemesterDto toDto() => SemesterDto(id: id, name: name);
}

extension TagDtoX on TagDto {
  Tag toModel() => Tag(id: id, label: label, color: color);
}

extension FocusSessionDtoX on FocusSessionDto {
  FocusSession toModel() => FocusSession(
        id: id,
        durationMin: durationMin,
        taskId: taskId,
        prismMode: prismMode,
        elapsedSec: elapsedSec,
        status: _enumByName(FocusStatus.values, status, FocusStatus.idle),
        startedAt: startedAt,
        completedAt: completedAt,
        endMood: endMood,
      );
}

extension MoodLogDtoX on MoodLogDto {
  MoodLog toModel() => MoodLog(
        id: id,
        date: date,
        phase: _enumByName(MoodPhase.values, phase, MoodPhase.adhoc),
        mood: mood,
        note: note,
      );
}

extension AdaMessageDtoX on AdaMessageDto {
  AdaMessage toModel() => AdaMessage(
        id: id,
        role: _enumByName(AdaRole.values, role, AdaRole.ada),
        text: text,
        createdAt: createdAt,
      );
}

extension AppUserDtoX on AppUserDto {
  AppUser toModel() => AppUser(
        id: id,
        name: name,
        email: email,
        university: university,
        program: program,
        gender: gender,
        avatarUrl: avatarUrl,
        isGuest: isGuest,
      );
}

extension UserStatsDtoX on UserStatsDto {
  UserStats toModel() => UserStats(
        streakDays: streakDays,
        focusMinutesThisWeek: focusMinutesThisWeek,
        tasksCompletedThisWeek: tasksCompletedThisWeek,
        weekMoods: weekMoods.map((m) => m.toModel()).toList(),
      );
}
