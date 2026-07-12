import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/primary_button.dart';
import 'widgets/onboarding_scaffold.dart';

/// FRAME `ob3` — Step 4 (activeStep 4): upload syllabus / notes / reading list.
/// A dashed dropzone + an explainer card. Both the CTA and the skip link advance
/// to [Routes.obPeak].
class ObSyllabusScreen extends ConsumerWidget {
  const ObSyllabusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;

    Future<void> goNext() async {
      await context.push(Routes.obPeak);
    }

    return OnboardingScaffold(
      activeStep: 4,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Let Ada plan\nyour week',
            style: AppText.sans(
              size: 26,
              weight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Upload your syllabus, notes, or reading list',
            style: AppText.sans(size: 12, color: colors.textMed),
          ),
          const SizedBox(height: 14),
          // Dropzone.
          // NOTE: prototype border is dashed (1.5px ACC@0x66); approximated here
          // with a solid accent@0x66 1.5px border.
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.accentSoft,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: colors.accent.alpha8(0x66),
                width: 1.5,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 16),
              child: Column(
                children: [
                  Icon(
                    Icons.arrow_upward,
                    size: 26,
                    color: colors.accent,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tap to upload',
                    style: AppText.sans(
                      size: 13,
                      weight: FontWeight.w700,
                      color: colors.accent,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'PDF, photo, or paste a link',
                    style: AppText.sans(size: 11, color: colors.textMed),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          // "What Ada does with it" card (no shadow, bg = page bg).
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.bg,
              borderRadius: BorderRadius.circular(AppRadius.card),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'What Ada does with it',
                    style: AppText.sans(size: 11, weight: FontWeight.w700),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    'Reads your deadlines → breaks work into sessions → maps '
                    'them across your week. You just show up.',
                    style: AppText.sans(
                      size: 11,
                      color: colors.textMed,
                      height: 1.65,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      footer: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PrimaryButton(
            label: 'Upload materials',
            onPressed: () => unawaited(goNext()),
          ),
          const SizedBox(height: 9),
          GestureDetector(
            onTap: () => unawaited(goNext()),
            child: Text(
              "Skip — I'll add tasks manually →",
              textAlign: TextAlign.center,
              style: AppText.sans(size: 11, color: colors.textMed),
            ),
          ),
        ],
      ),
    );
  }
}
