import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_text.dart';

/// Full-width pill button (prototype `PBtn`). Filled = ink fill / white text;
/// ghost = surface + hairline border / text color.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.ghost = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool ghost;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bg = ghost ? colors.surface : colors.ink;
    final fg = ghost ? colors.text : Colors.white;
    final borderRadius = BorderRadius.circular(AppRadius.pill);

    return Material(
      color: bg,
      borderRadius: borderRadius,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onPressed,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
          decoration: BoxDecoration(
            borderRadius: borderRadius,
            border: ghost
                ? Border.all(color: colors.border, width: 1.5)
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: fg),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: AppText.sans(
                  size: 14,
                  weight: FontWeight.w800,
                  letterSpacing: AppText.em(0.01, 14),
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
