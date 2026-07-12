import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The selectable Prism focus modes (matches the fc-prism picker order).
const prismModes = <String>['Deep Work', 'Flow', 'Review', 'Wind-down', 'No sound'];

/// The user's default Prism mode (Settings → Prism). Shown in the Settings hub
/// and as the Focus session default. Persists in memory; the §8 pass stores it.
final prismDefaultModeProvider =
    NotifierProvider<PrismDefaultModeController, String>(PrismDefaultModeController.new);

class PrismDefaultModeController extends Notifier<String> {
  @override
  String build() => 'Deep Work';

  void set(String mode) => state = mode;
}
