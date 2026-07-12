import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/primary_button.dart';

/// FRAME `guest-ada` — gated-feature prompt shown when a guest taps the locked
/// Ada tab. Full white screen, centered, with a setup nudge into onboarding.
class GuestAdaPrompt extends StatelessWidget {
  const GuestAdaPrompt({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(26, 0, 26, 38),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const _AdaWithLock(),
                const SizedBox(height: 18),
                Text(
                  'Meet Ada',
                  textAlign: TextAlign.center,
                  style: AppText.sans(
                    size: 22,
                    weight: FontWeight.w800,
                    height: 1.25,
                    color: colors.text,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Ada builds your week from your real workload. To plan for '
                  "you, it needs to know what you're studying.",
                  textAlign: TextAlign.center,
                  style: AppText.sans(
                    size: 12.5,
                    height: 1.6,
                    color: colors.textMed,
                  ),
                ),
                const SizedBox(height: 18),
                const _BenefitsCard(),
                const SizedBox(height: 22),
                PrimaryButton(
                  label: 'Set up Ada · 2 min →',
                  onPressed: () => context.go(Routes.obReferral),
                ),
                const SizedBox(height: 9),
                GestureDetector(
                  onTap: () => context.pop(),
                  child: Text(
                    'Maybe later',
                    style: AppText.sans(size: 11.5, color: colors.textMed),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// AdaMascot (size 88, happy) with a WARN lock badge at its bottom-right.
class _AdaWithLock extends StatelessWidget {
  const _AdaWithLock();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        const AdaMascot(size: 88),
        Positioned(
          bottom: 2,
          right: -2,
          child: Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.warn,
              shape: BoxShape.circle,
              border: Border.all(color: colors.surface, width: 3),
            ),
            child: const Icon(Icons.lock, size: 13, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

/// Benefits card — bg = page bg, no shadow, left-aligned, three check rows with
/// hairline dividers between (not after the last).
class _BenefitsCard extends StatelessWidget {
  const _BenefitsCard();

  static const _labels = [
    'What & where you study',
    'Your deadlines & syllabus',
    'When you focus best',
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < _labels.length; i++)
            Container(
              decoration: BoxDecoration(
                border: i == _labels.length - 1
                    ? null
                    : Border(bottom: BorderSide(color: colors.border)),
              ),
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Icon(Icons.check_circle, size: 15, color: colors.accent),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      _labels[i],
                      style: AppText.sans(size: 11.5, color: colors.text),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
