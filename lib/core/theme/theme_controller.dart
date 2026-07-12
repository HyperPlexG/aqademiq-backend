import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_colors.dart';

/// App appearance: Light / Dark / System (README §3, the Appearance picker).
///
/// In-memory for now; the §8 wiring pass persists it via `shared_preferences`.
final themeModeProvider =
    NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => ThemeMode.system;

  void set(ThemeMode mode) => state = mode;
}

/// The active brand accent (violet / pink / green).
final accentProvider =
    NotifierProvider<AccentController, AppAccent>(AccentController.new);

class AccentController extends Notifier<AppAccent> {
  @override
  AppAccent build() => AppAccent.violet;

  void set(AppAccent accent) => state = accent;
}
