import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/primary_button.dart';
import '../providers/onboarding_controller.dart';
import 'widgets/onboarding_scaffold.dart';

/// Onboarding step 6 (prototype `ob5`): introduces Prism focus audio and lets
/// the user pick a default mode. The CTA advances to the building/loading step.
class ObPrismScreen extends ConsumerWidget {
  const ObPrismScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;

    final modes = <_PrismMode>[
      _PrismMode(
        color: colors.accent,
        name: 'Deep Work',
        desc: 'Low-freq focus carrier. Hard cognitive tasks.',
      ),
      _PrismMode(
        color: colors.success,
        name: 'Flow',
        desc: 'Smooth ambient. Sustained concentration.',
      ),
      _PrismMode(
        color: colors.warn,
        name: 'Review',
        desc: 'Steady midtempo. Reading, flashcards, revision.',
      ),
      _PrismMode(
        color: colors.textMed,
        name: 'Wind-down',
        desc: 'Slow, calming. End-of-session decompression.',
      ),
    ];

    return OnboardingScaffold(
      activeStep: 6,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Meet Prism',
            style: AppText.sans(size: 26, weight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Psychoacoustic audio that deepens focus. '
            'Auto-plays in sessions.',
            style: AppText.sans(size: 12, color: colors.textMed),
          ),
          const SizedBox(height: 22),
          const FieldLabel('Prism modes'),
          for (final mode in modes) ...[
            AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
              onTap: () =>
                  ref.read(onboardingProvider.notifier).setPrismMode(mode.name),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: mode.color.alpha8(0x18),
                      borderRadius: BorderRadius.circular(AppRadius.tile),
                      border: Border.all(
                        color: mode.color.alpha8(0x44),
                        width: 1.5,
                      ),
                    ),
                    child: CustomPaint(
                      size: const Size(22, 22),
                      painter: _PrismGlyph(mode.color),
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          mode.name,
                          style: AppText.sans(size: 12, weight: FontWeight.w700),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          mode.desc,
                          style: AppText.sans(size: 10, color: colors.textMed),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 9),
          ],
        ],
      ),
      footer: PrimaryButton(
        label: "Let's go →",
        onPressed: () => unawaited(context.push(Routes.obLoading)),
      ),
    );
  }
}

/// One Prism audio mode row (icon color + copy).
class _PrismMode {
  const _PrismMode({
    required this.color,
    required this.name,
    required this.desc,
  });

  final Color color;
  final String name;
  final String desc;
}

/// The mode icon: an equalizer of 5 vertical bars inside a ring (prototype
/// `PrismGlyph`, viewBox 0 0 24 24, scaled to the painter size).
class _PrismGlyph extends CustomPainter {
  const _PrismGlyph(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas
      ..save()
      ..scale(size.width / 24, size.height / 24);

    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(const Offset(12, 12), 9, stroke);

    const xs = [6.0, 9.0, 12.0, 15.0, 18.0];
    const heights = [4.0, 7.0, 10.0, 7.0, 4.0];
    for (var i = 0; i < xs.length; i++) {
      final half = heights[i] / 2;
      canvas.drawLine(
        Offset(xs[i], 12 - half),
        Offset(xs[i], 12 + half),
        stroke,
      );
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(_PrismGlyph oldDelegate) => oldDelegate.color != color;
}
