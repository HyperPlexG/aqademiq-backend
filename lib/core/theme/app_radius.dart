/// Corner-radius tokens (README §3, corrected to prototype values — see
/// PROTOTYPE_SPECS.md). All in logical pixels.
abstract final class AppRadius {
  /// Cards / task rows (prototype uses 16, not the README's 18).
  static const double card = 16;

  /// `SetGroup` settings cards (the one container that is genuinely 18).
  static const double group = 18;

  /// Bottom-sheet top corners.
  static const double sheetTop = 24;

  /// Rows / text inputs.
  static const double rowInput = 14;

  /// Small grid cells (OTP, etc.).
  static const double cellSmall = 12;

  /// Color swatches / small tiles.
  static const double tile = 10;

  /// Pills / chips / toggles / buttons (effectively full).
  static const double pill = 100;

  /// Floating bottom-nav bar.
  static const double nav = 20;

  /// Device frame.
  static const double phone = 34;

  /// Progress bars.
  static const double progress = 3;
}
