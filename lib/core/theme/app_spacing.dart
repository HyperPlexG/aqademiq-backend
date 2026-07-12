/// Spacing tokens (README §3). Base grid is 4px. Use these instead of raw
/// numbers so layout stays consistent and tunable.
abstract final class AppSpacing {
  static const double base = 4;
  static const double x2 = 8;
  static const double x3 = 12;
  static const double x4 = 16;
  static const double x5 = 20;
  static const double x6 = 24;

  /// Standard screen side padding.
  static const double screenSide = 16;

  /// Standard hairline / border stroke width (prototype uses 1.5, not 1).
  static const double border = 1.5;
}
