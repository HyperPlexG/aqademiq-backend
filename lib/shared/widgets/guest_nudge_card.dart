import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_text.dart';
import '../mascot/ada_mascot.dart';

/// The "exploring as a guest" nudge card (prototype guest-home / guest-subjects):
/// `accentSoft` fill, faint accent border, Ada + copy, optional ink CTA bar.
class GuestNudgeCard extends StatelessWidget {
  const GuestNudgeCard({
    super.key,
    required this.body,
    this.mascotExpr = AdaExpr.happy,
    this.mascotSize = 26,
    this.ctaLabel,
    this.onCta,
  });

  final String body;
  final AdaExpr mascotExpr;
  final double mascotSize;
  final String? ctaLabel;
  final VoidCallback? onCta;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: colors.accent.alpha8(0x22)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              AdaMascot(size: mascotSize, expr: mascotExpr),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "You're exploring as a guest",
                      style: AppText.sans(size: 11.5, weight: FontWeight.w700, color: colors.text),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      body,
                      style: AppText.sans(size: 10, height: 1.45, color: colors.textMed),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (ctaLabel != null) ...[
            const SizedBox(height: 8),
            GestureDetector(
              onTap: onCta,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 7),
                decoration: BoxDecoration(
                  color: colors.ink,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  ctaLabel!,
                  textAlign: TextAlign.center,
                  style: AppText.sans(size: 11, weight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
