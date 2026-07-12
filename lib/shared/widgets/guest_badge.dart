import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_text.dart';

/// The "GUEST" badge pill shown in headers while in guest mode (prototype
/// guest-home / guest-subjects).
class GuestBadge extends StatelessWidget {
  const GuestBadge({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        boxShadow: colors.cardShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.person_outline, size: 11, color: colors.warn),
          const SizedBox(width: 4),
          Text(
            'GUEST',
            style: AppText.sans(
              size: 9.5,
              weight: FontWeight.w800,
              letterSpacing: AppText.em(0.05, 9.5),
              color: colors.textMed,
            ),
          ),
        ],
      ),
    );
  }
}
