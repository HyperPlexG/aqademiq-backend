import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/onboarding_dots.dart';

/// Shared onboarding step layout: white page, step dots, a scrollable [body],
/// and a pinned [footer] (the CTA + any skip link).
class OnboardingScaffold extends StatelessWidget {
  const OnboardingScaffold({
    super.key,
    required this.activeStep,
    required this.body,
    required this.footer,
  });

  final int activeStep;
  final Widget body;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 4, 22, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OnboardingDots(active: activeStep),
              Expanded(child: SingleChildScrollView(child: body)),
              const SizedBox(height: 12),
              footer,
            ],
          ),
        ),
      ),
    );
  }
}
