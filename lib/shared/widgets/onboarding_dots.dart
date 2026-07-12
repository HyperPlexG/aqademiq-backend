import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Step indicator for onboarding (prototype `Dots`): active segment is a wide
/// accent bar, inactive segments are short grey bars.
class OnboardingDots extends StatelessWidget {
  const OnboardingDots({super.key, required this.active, this.total = 7});

  final int active;
  final int total;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        children: [
          for (var i = 0; i < total; i++)
            Padding(
              padding: EdgeInsets.only(right: i == total - 1 ? 0 : 5),
              child: Container(
                width: i == active ? 22 : 6,
                height: 4,
                decoration: BoxDecoration(
                  color: i == active ? colors.accent : const Color(0xFFE0E0E0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
