import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';
import 'app_radius.dart';

/// Builds the [ThemeData] for a given [brightness] + [accent]. Custom design
/// tokens travel as an [AppColors] theme extension; widgets read them through
/// `context.colors`. Base text uses Plus Jakarta Sans (README §3).
ThemeData buildAppTheme({
  required Brightness brightness,
  required AppAccent accent,
}) {
  final isLight = brightness == Brightness.light;
  final colors = isLight ? AppColors.light(accent) : AppColors.dark(accent);
  final base = ThemeData(brightness: brightness, useMaterial3: true);

  final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
    bodyColor: colors.text,
    displayColor: colors.text,
  );

  final scheme = ColorScheme.fromSeed(
    seedColor: colors.accent,
    brightness: brightness,
  ).copyWith(
    primary: colors.accent,
    surface: colors.surface,
    onSurface: colors.text,
    error: colors.danger,
  );

  return base.copyWith(
    scaffoldBackgroundColor: colors.bg,
    canvasColor: colors.bg,
    colorScheme: scheme,
    textTheme: textTheme,
    extensions: <ThemeExtension<dynamic>>[colors],
    splashFactory: InkSparkle.splashFactory,
    dividerTheme: DividerThemeData(color: colors.border, thickness: 1, space: 1),
    cardTheme: CardThemeData(
      color: colors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.sheetTop)),
      ),
    ),
    visualDensity: VisualDensity.standard,
  );
}
