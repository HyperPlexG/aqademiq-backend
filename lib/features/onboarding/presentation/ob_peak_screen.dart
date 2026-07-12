import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/primary_button.dart';
import '../providers/onboarding_controller.dart';
import 'widgets/onboarding_scaffold.dart';

/// Onboarding step 5 (prototype `ob4`): pick the peak time of day and a daily
/// focus goal so Ada can schedule the hardest tasks at the user's best hours.
class ObPeakScreen extends ConsumerWidget {
  const ObPeakScreen({super.key});

  static const _peakTimes = [
    'Early bird',
    'Afternoon',
    'Evening',
    'Night owl',
    'Flexible',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final draft = ref.watch(onboardingProvider);
    final hrs = draft.focusGoalHrs;

    return OnboardingScaffold(
      activeStep: 5,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'When do you\nwork best?',
            style: AppText.sans(size: 26, weight: FontWeight.w800, height: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            'Ada schedules your hardest tasks at your peak',
            style: AppText.sans(size: 12, color: colors.textMed),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final time in _peakTimes)
                _Chip(
                  label: time,
                  active: draft.peakTimes.contains(time),
                  onTap: () =>
                      ref.read(onboardingProvider.notifier).togglePeakTime(time),
                ),
            ],
          ),
          const SizedBox(height: 20),
          const FieldLabel('Daily focus goal'),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(AppRadius.card),
              boxShadow: colors.cardShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Target per day',
                      style: AppText.sans(size: 12, color: colors.textMed),
                    ),
                    Text(
                      '${hrs.round()} hrs',
                      style: AppText.sans(
                        size: 16,
                        weight: FontWeight.w800,
                        color: colors.accent,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Slider(
                  min: 1,
                  max: 8,
                  value: hrs,
                  activeColor: colors.accent,
                  onChanged:
                      ref.read(onboardingProvider.notifier).setFocusGoal,
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '1 hr',
                      style: AppText.sans(size: 9, color: colors.textDim),
                    ),
                    Text(
                      '8 hrs',
                      style: AppText.sans(size: 9, color: colors.textDim),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      footer: PrimaryButton(
        label: 'Continue →',
        onPressed: () => unawaited(context.push(Routes.obPrism)),
      ),
    );
  }
}

/// A pill chip per spec: active = accent border + accentSoft bg + accent text;
/// inactive = hairline border + surface bg + medium text.
class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: active ? colors.accentSoft : colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(
            color: active ? colors.accent : colors.border,
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: AppText.sans(
            size: 11,
            color: active ? colors.accent : colors.textMed,
          ),
        ),
      ),
    );
  }
}
