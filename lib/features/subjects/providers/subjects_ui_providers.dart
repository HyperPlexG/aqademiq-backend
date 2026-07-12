import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Subjects list layout (prototype `subjectsLayout` tweak — List default, Grid
/// via the Appearance tweak in Settings).
enum SubjectsLayout { list, grid }

final subjectsLayoutProvider =
    NotifierProvider<SubjectsLayoutController, SubjectsLayout>(SubjectsLayoutController.new);

class SubjectsLayoutController extends Notifier<SubjectsLayout> {
  @override
  SubjectsLayout build() => SubjectsLayout.list;

  void set(SubjectsLayout layout) => state = layout;

  void toggle() => state = state == SubjectsLayout.list ? SubjectsLayout.grid : SubjectsLayout.list;
}
