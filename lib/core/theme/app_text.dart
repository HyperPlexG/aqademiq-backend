import 'package:flutter/widgets.dart';
import 'package:google_fonts/google_fonts.dart';

/// Typography tokens (README §3). Three families:
/// - [sans] `Plus Jakarta Sans` — all UI/body/headings.
/// - [numeral] `Playfair Display` — big display numbers ONLY (timer, stats).
/// - [mono] `JetBrains Mono` — rare.
///
/// Styles are returned without a baked-in color; widgets apply `context.colors`.
/// `letterSpacing` is in logical pixels (use [em] to convert prototype `em`
/// values, e.g. `letterSpacing: AppText.em(0.1, 10)`).
abstract final class AppText {
  static TextStyle sans({
    required double size,
    FontWeight weight = FontWeight.w600,
    double? letterSpacing,
    double? height,
    Color? color,
  }) =>
      GoogleFonts.plusJakartaSans(
        fontSize: size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        height: height,
        color: color,
      );

  static TextStyle numeral({
    required double size,
    FontWeight weight = FontWeight.w800,
    double? letterSpacing,
    double height = 1,
    Color? color,
  }) =>
      GoogleFonts.playfairDisplay(
        fontSize: size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        height: height,
        color: color,
      );

  static TextStyle mono({
    required double size,
    FontWeight weight = FontWeight.w500,
    double? letterSpacing,
    Color? color,
  }) =>
      GoogleFonts.jetBrainsMono(
        fontSize: size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        color: color,
      );

  /// Convert a CSS `em` letter-spacing to logical pixels at [fontSize].
  static double em(double emValue, double fontSize) => emValue * fontSize;
}
