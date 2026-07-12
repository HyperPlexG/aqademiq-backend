import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text.dart';
import '../mascot/ada_mascot.dart';
import 'app_scaffold.dart';

/// Placeholder body for tabs built out in Phase B. Keeps the shell complete and
/// on-brand while only Plan/Timeline is fully built in Phase A.
class ComingSoon extends StatelessWidget {
  const ComingSoon({super.key, required this.title, this.subtitle, this.expr = AdaExpr.smile});

  final String title;
  final String? subtitle;
  final AdaExpr expr;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return AppScaffold(
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AdaMascot(size: 84, expr: expr),
            const SizedBox(height: 16),
            Text(
              title,
              style: AppText.sans(size: 22, weight: FontWeight.w800, color: colors.text),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle ?? 'Built out in Phase B.',
              textAlign: TextAlign.center,
              style: AppText.sans(size: 13, color: colors.textMed),
            ),
          ],
        ),
      ),
    );
  }
}
