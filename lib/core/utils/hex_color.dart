import 'package:flutter/painting.dart';

/// Parse a CSS hex string (`#rgb`, `#rrggbb`, `#aarrggbb`) into a [Color].
/// Subjects/tags carry their color as a hex string from the API.
Color hexColor(String hex, {Color fallback = const Color(0xFF6B5CF0)}) {
  var value = hex.trim().replaceFirst('#', '');
  if (value.length == 3) {
    value = value.split('').map((c) => '$c$c').join();
  }
  if (value.length == 6) value = 'FF$value';
  if (value.length != 8) return fallback;
  final parsed = int.tryParse(value, radix: 16);
  return parsed == null ? fallback : Color(parsed);
}

/// Serialize a [Color] back to a `#rrggbb` hex string (tags persist as hex).
String hexFromColor(Color color) =>
    '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
