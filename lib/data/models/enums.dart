// Shared enums used across UI models. Kept free of freezed/codegen so they can
// be imported anywhere (models, adapters, widgets) without a part file.

/// Coarse time-of-day bucket for a task (the prototype's "Anytime / Morning /
/// Afternoon / Evening" grouping).
enum DayPart { morning, afternoon, evening, anytime }

/// How a task repeats. [none] means a one-off task.
enum RepeatFrequency { none, daily, weekly, monthly, custom }

/// Whether a subject's grade target is expressed as a GPA or a percentage.
enum SubjectTargetKind { gpa, percent }

/// Lifecycle of a focus session (server-authoritative once wired to Redis).
enum FocusStatus { idle, running, paused, completed }

/// When a mood was logged.
enum MoodPhase { morning, evening, adhoc }

/// Author of an Ada chat message.
enum AdaRole { user, ada }

extension DayPartX on DayPart {
  /// Wire/string form used by the API and fixtures.
  String get wire => name;

  static DayPart fromWire(String? value) => switch (value) {
        'morning' => DayPart.morning,
        'afternoon' => DayPart.afternoon,
        'evening' => DayPart.evening,
        _ => DayPart.anytime,
      };
}
