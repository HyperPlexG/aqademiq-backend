import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env/env.dart';
import '../../core/network/dio_client.dart';
import '../adapters/adapters.dart';
import '../dtos/mood_log_dto.dart';
import '../fixtures/fixtures.dart';
import '../models/enums.dart';
import '../models/mood_log.dart';
import '../sources/mood_source.dart';

class MoodRepository {
  MoodRepository(this._source);

  final MoodSource _source;

  Future<List<MoodLog>> week() async {
    final dtos = await _source.week();
    return dtos.map((d) => d.toModel()).toList(growable: false);
  }

  Future<MoodLog> log({
    required DateTime date,
    required MoodPhase phase,
    required int mood,
    String? note,
  }) async {
    final dto = await _source.log(
      MoodLogDto(id: '', date: date, phase: phase.name, mood: mood, note: note),
    );
    return dto.toModel();
  }
}

final moodRepositoryProvider = Provider<MoodRepository>((ref) {
  final source =
      Env.useMocks ? MockMoodSource() : ApiMoodSource(ref.watch(dioProvider));
  return MoodRepository(source);
});

final moodWeekProvider = FutureProvider<List<MoodLog>>(
  (ref) => ref.watch(moodRepositoryProvider).week(),
);

/// Day streak derived client-side: consecutive days ending "today" that have a
/// mood log (STA-6). Grows as the user logs — no backend needed.
final streakProvider = FutureProvider<int>((ref) async {
  final logs = await ref.watch(moodWeekProvider.future);
  String key(DateTime d) => '${d.year}-${d.month}-${d.day}';
  final logged = {for (final l in logs) key(l.date)};
  var streak = 0;
  var day = Fixtures.today;
  while (logged.contains(key(day))) {
    streak++;
    day = day.subtract(const Duration(days: 1));
  }
  return streak;
});
