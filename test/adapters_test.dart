import 'package:aqademiq/data/adapters/adapters.dart';
import 'package:aqademiq/data/dtos/task_dto.dart';
import 'package:aqademiq/data/models/enums.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TaskDto <-> Task adapter (seam 2)', () {
    test('maps timeOfDay to DayPart and round-trips to DTO', () {
      final dto = TaskDto(
        id: '1',
        title: 'Read chapter 4',
        tagId: 'cc401',
        date: DateTime(2026, 6, 3),
        timeOfDay: 'morning',
        durationMin: 30,
      );

      final model = dto.toModel();
      expect(model.dayPart, DayPart.morning);
      expect(model.durationMin, 30);
      expect(model.tagId, 'cc401');

      // Reverse mapping preserves the wire value.
      expect(model.toDto().timeOfDay, 'morning');
    });

    test('unknown timeOfDay falls back to anytime', () {
      final dto = TaskDto(
        id: '2',
        title: 'X',
        tagId: 't',
        date: DateTime(2026, 6, 3),
        timeOfDay: 'not-a-real-value',
      );
      expect(dto.toModel().dayPart, DayPart.anytime);
    });

    test('subtasks are mapped through', () {
      const sub = SubtaskDto(id: 's1', title: 'step', done: true);
      final dto = TaskDto(
        id: '3',
        title: 'X',
        tagId: 't',
        date: DateTime(2026, 6, 3),
        subtasks: const [sub],
      );
      final model = dto.toModel();
      expect(model.subtasks.single.title, 'step');
      expect(model.subtasks.single.done, true);
    });
  });
}
