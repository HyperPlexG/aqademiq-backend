import 'package:flutter/material.dart';

/// The three shipped brand accents (README §3). Each carries its accent color
/// plus the *looked-up* "accent soft" tint for light and dark (the prototype
/// uses a lookup table, not a computed alpha).
enum AppAccent {
  violet(Color(0xFF6B5CF0), Color(0xFFEDEAFD), Color(0xFF2A2340)),
  pink(Color(0xFFE85476), Color(0xFFFDE8ED), Color(0xFF3A1422)),
  green(Color(0xFF2A9D6B), Color(0xFFE8FDF3), Color(0xFF0D2B1D));

  const AppAccent(this.color, this.softLight, this.softDark);

  /// The accent color itself.
  final Color color;

  /// `accentSoft` in light mode.
  final Color softLight;

  /// `accentSoft` in dark mode.
  final Color softDark;
}

/// All theme-dependent colors + elevations, exposed as a [ThemeExtension] so the
/// whole design system reads tokens through `context.colors` and they animate /
/// switch correctly across light, dark, and accent changes.
///
/// Values are lifted verbatim from the v5 prototype (see PROTOTYPE_SPECS.md).
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.bg,
    required this.surface,
    required this.text,
    required this.textMed,
    required this.textDim,
    required this.border,
    required this.hilite,
    required this.ink,
    required this.accent,
    required this.accentSoft,
    required this.success,
    required this.warn,
    required this.danger,
    required this.frameBg,
    required this.cardShadow,
    required this.navShadow,
    required this.sheetShadow,
  });

  /// Warm-paper app background.
  factory AppColors.light(AppAccent accent) => AppColors(
        bg: const Color(0xFFF4F3F0),
        surface: const Color(0xFFFFFFFF),
        text: const Color(0xFF111111),
        textMed: const Color(0xFF777777),
        textDim: const Color(0xFFC0C0C0),
        border: const Color(0x12000000),
        hilite: const Color(0xFFECEAE7),
        ink: const Color(0xFF111111),
        accent: accent.color,
        accentSoft: accent.softLight,
        success: const Color(0xFF2A9D6B),
        warn: const Color(0xFFE8A430),
        danger: const Color(0xFFE85476),
        frameBg: const Color(0xFFDBD9D5),
        cardShadow: const [
          BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, 2)),
        ],
        navShadow: const [
          BoxShadow(color: Color(0x21000000), blurRadius: 28, offset: Offset(0, 4)),
        ],
        sheetShadow: const [
          BoxShadow(color: Color(0x47140F1C), blurRadius: 48, offset: Offset(0, -12)),
        ],
      );

  factory AppColors.dark(AppAccent accent) => AppColors(
        bg: const Color(0xFF0E0E0E),
        surface: const Color(0xFF1B1B1B),
        text: const Color(0xFFEFEFEF),
        textMed: const Color(0xFF888888),
        textDim: const Color(0xFF505050),
        border: const Color(0x12FFFFFF),
        hilite: const Color(0xFF33333A),
        // Dark mode: ink becomes the accent (README §3).
        ink: accent.color,
        accent: accent.color,
        accentSoft: accent.softDark,
        success: const Color(0xFF2A9D6B),
        warn: const Color(0xFFE8A430),
        danger: const Color(0xFFE85476),
        frameBg: const Color(0xFF161616),
        cardShadow: const [
          BoxShadow(color: Color(0x8C000000), blurRadius: 20, offset: Offset(0, 2)),
        ],
        // Prototype uses the same nav shadow in both modes (rgba(0,0,0,0.13)).
        navShadow: const [
          BoxShadow(color: Color(0x21000000), blurRadius: 28, offset: Offset(0, 4)),
        ],
        sheetShadow: const [
          BoxShadow(color: Color(0x8C000000), blurRadius: 48, offset: Offset(0, -12)),
        ],
      );

  final Color bg;
  final Color surface;
  final Color text;
  final Color textMed;
  final Color textDim;
  final Color border;
  final Color hilite;
  final Color ink;
  final Color accent;
  final Color accentSoft;
  final Color success;
  final Color warn;
  final Color danger;
  final Color frameBg;
  final List<BoxShadow> cardShadow;
  final List<BoxShadow> navShadow;
  final List<BoxShadow> sheetShadow;

  @override
  AppColors copyWith({
    Color? bg,
    Color? surface,
    Color? text,
    Color? textMed,
    Color? textDim,
    Color? border,
    Color? hilite,
    Color? ink,
    Color? accent,
    Color? accentSoft,
    Color? success,
    Color? warn,
    Color? danger,
    Color? frameBg,
    List<BoxShadow>? cardShadow,
    List<BoxShadow>? navShadow,
    List<BoxShadow>? sheetShadow,
  }) {
    return AppColors(
      bg: bg ?? this.bg,
      surface: surface ?? this.surface,
      text: text ?? this.text,
      textMed: textMed ?? this.textMed,
      textDim: textDim ?? this.textDim,
      border: border ?? this.border,
      hilite: hilite ?? this.hilite,
      ink: ink ?? this.ink,
      accent: accent ?? this.accent,
      accentSoft: accentSoft ?? this.accentSoft,
      success: success ?? this.success,
      warn: warn ?? this.warn,
      danger: danger ?? this.danger,
      frameBg: frameBg ?? this.frameBg,
      cardShadow: cardShadow ?? this.cardShadow,
      navShadow: navShadow ?? this.navShadow,
      sheetShadow: sheetShadow ?? this.sheetShadow,
    );
  }

  @override
  AppColors lerp(covariant AppColors? other, double t) {
    if (other == null) return this;
    return AppColors(
      bg: Color.lerp(bg, other.bg, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      text: Color.lerp(text, other.text, t)!,
      textMed: Color.lerp(textMed, other.textMed, t)!,
      textDim: Color.lerp(textDim, other.textDim, t)!,
      border: Color.lerp(border, other.border, t)!,
      hilite: Color.lerp(hilite, other.hilite, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      success: Color.lerp(success, other.success, t)!,
      warn: Color.lerp(warn, other.warn, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      frameBg: Color.lerp(frameBg, other.frameBg, t)!,
      cardShadow: BoxShadow.lerpList(cardShadow, other.cardShadow, t)!,
      navShadow: BoxShadow.lerpList(navShadow, other.navShadow, t)!,
      sheetShadow: BoxShadow.lerpList(sheetShadow, other.sheetShadow, t)!,
    );
  }
}

/// Ergonomic access: `context.colors.accent`.
extension AppColorsContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}

/// Apply a prototype hex-alpha suffix (e.g. `accent + '18'`) to a color.
extension HexAlpha on Color {
  /// `hexAlpha` is the 0x00..0xFF alpha byte the prototype appends as a string,
  /// e.g. `tagColor.alpha8(0x18)` for an active chip background.
  Color alpha8(int hexAlpha) => withAlpha(hexAlpha);
}
