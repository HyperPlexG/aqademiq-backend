import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// 32×32 circular back button on a `bg`-filled circle (prototype auth/onboarding
/// back affordance).
class CircleBackButton extends StatelessWidget {
  const CircleBackButton({super.key, this.onTap, this.icon = Icons.arrow_back});

  final VoidCallback? onTap;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap ?? () => Navigator.of(context).maybePop(),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
        child: Icon(icon, size: 18, color: colors.text),
      ),
    );
  }
}
