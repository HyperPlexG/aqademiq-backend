import 'package:flutter/material.dart';

import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

enum SsoProvider { apple, google }

/// Apple / Google SSO pill (prototype `SSOButtons`). The Google "G" is a simple
/// brand-blue mark (the multicolor logo asset can be dropped in later).
class SsoButton extends StatelessWidget {
  const SsoButton({
    super.key,
    required this.provider,
    required this.label,
    this.onTap,
  });

  final SsoProvider provider;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isApple = provider == SsoProvider.apple;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: isApple ? Colors.black : Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: isApple ? null : Border.all(color: const Color(0xFF747775), width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isApple)
              const Icon(Icons.apple, size: 18, color: Colors.white)
            else
              Text('G', style: AppText.sans(size: 18, weight: FontWeight.w800, color: const Color(0xFF4285F4))),
            SizedBox(width: isApple ? 8 : 10),
            Text(
              label,
              style: AppText.sans(
                size: isApple ? 15 : 14,
                weight: isApple ? FontWeight.w600 : FontWeight.w500,
                color: isApple ? Colors.white : const Color(0xFF1F1F1F),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
