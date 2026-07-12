import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// Pill control on the Focus setup (prototype `FocusPill`): a `bg` pill (closed)
/// or `accentSoft` pill (open), with an optional leading glyph or icon.
class FocusPill extends StatelessWidget {
  const FocusPill({super.key, this.glyph, this.icon, required this.label, this.open = false, this.onTap});

  final String? glyph;
  final IconData? icon;
  final String label;
  final bool open;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final fg = open ? colors.accent : colors.text;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: open ? colors.accentSoft : colors.bg,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: open ? colors.accent.alpha8(0x55) : Colors.transparent),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (glyph != null)
              Text(glyph!, style: TextStyle(fontSize: 12, color: colors.accent, height: 1))
            else if (icon != null)
              Icon(icon, size: 13, color: fg),
            const SizedBox(width: 5),
            Text(label, style: AppText.sans(size: 11, weight: FontWeight.w700, color: fg)),
          ],
        ),
      ),
    );
  }
}
