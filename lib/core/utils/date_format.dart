import '../../data/fixtures/fixtures.dart';
import '../env/env.dart';

/// Tiny date/time formatting helpers (no `intl` dependency for Phase A).
abstract final class AppDate {
  /// Current calendar day (date-normalized). Uses the demo fixture date in mock
  /// mode (so fixtures line up), and the real device date when running live —
  /// otherwise date-anchored features (Plan timeline, mood, streaks) would all
  /// sit on the hardcoded fixture date and show nothing on the live backend.
  static DateTime today() {
    if (Env.useMocks) return Fixtures.today;
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  static const _weekdaysFull = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ];
  static const _weekdayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  static const _monthsAbbrev = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];

  /// "Wednesday".
  static String weekdayFull(DateTime d) => _weekdaysFull[d.weekday - 1];

  /// Single-letter weekday for the strip ("W"). [weekdayIndex] is 1=Mon..7=Sun.
  static String weekdayLetter(int weekdayIndex) =>
      _weekdayLetters[weekdayIndex - 1];

  /// "JUN 2026".
  static String monthYearUpper(DateTime d) =>
      '${_monthsAbbrev[d.month - 1]} ${d.year}';

  /// Monday of the week containing [d] (the strip starts on Monday).
  static DateTime mondayOf(DateTime d) {
    final date = DateTime(d.year, d.month, d.day);
    return date.subtract(Duration(days: date.weekday - 1));
  }

  /// "11:30 AM".
  static String time12h(DateTime d) {
    final isPm = d.hour >= 12;
    var h = d.hour % 12;
    if (h == 0) h = 12;
    final mm = d.minute.toString().padLeft(2, '0');
    return '$h:$mm ${isPm ? 'PM' : 'AM'}';
  }

  /// Whether two dates are the same calendar day.
  static bool sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}
