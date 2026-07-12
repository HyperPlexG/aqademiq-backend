import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../auth/presentation/widgets/otp_field.dart';
import 'widgets/onboarding_scaffold.dart';

/// Onboarding step 0 (prototype `ob-referral`): optional referral code entry.
/// Both the CTA and the "I don't have one" link advance to the name step.
class ObReferralScreen extends ConsumerWidget {
  const ObReferralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;

    return OnboardingScaffold(
      activeStep: 0,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Got a referral\ncode?',
            style: AppText.sans(size: 26, weight: FontWeight.w800, height: 1.2),
          ),
          const SizedBox(height: 20),
          const FieldLabel('Referral code'),
          const OtpField(length: 5, initial: 'ADA'),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: colors.accentSoft,
              borderRadius: BorderRadius.circular(AppRadius.card),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdaMascot(size: 28),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'A friend invited you? Pop in their code and you both '
                    'earn Aqademiq Pro perks.',
                    style: AppText.sans(
                      size: 11,
                      height: 1.6,
                      color: colors.text,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      footer: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PrimaryButton(
            label: 'Continue →',
            onPressed: () => unawaited(context.push(Routes.obName)),
          ),
          const SizedBox(height: 12),
          Center(
            child: GestureDetector(
              onTap: () => unawaited(context.push(Routes.obName)),
              child: Text(
                "I don't have one",
                style: AppText.sans(
                  size: 11.5,
                  color: colors.textMed,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
