import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// The light `hilite` section pill on the Plan timeline (prototype
/// `CollapseHead`): optional leading icon, "LABEL (count)", expand/collapse
/// chevron. Distinct from the ink `SectionPill`.
class CollapseHead extends StatelessWidget {
  const CollapseHead({
    super.key,
    required this.label,
    required this.count,
    required this.open,
    this.icon,
    this.onTap,
  });

  final String label;
  final int count;
  final bool open;
  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final padding = icon != null
        ? const EdgeInsets.fromLTRB(7, 6, 13, 6)
        : const EdgeInsets.symmetric(horizontal: 15, vertical: 7);

    return Center(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: colors.hilite,
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 15, color: colors.textMed),
                const SizedBox(width: 7),
              ],
              Text(
                '$label ($count)',
                style: AppText.sans(
                  size: 11.5,
                  weight: FontWeight.w800,
                  letterSpacing: AppText.em(0.05, 11.5),
                  color: colors.text,
                ),
              ),
              const SizedBox(width: 7),
              Icon(
                open ? Icons.expand_more : Icons.expand_less,
                size: 18,
                color: colors.text,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
