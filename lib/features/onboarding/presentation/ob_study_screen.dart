import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../data/models/subject.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../subjects/presentation/widgets/subject_form_sheet.dart';
import '../providers/onboarding_controller.dart';
import 'widgets/onboarding_scaffold.dart';

/// ob2 — Step 2: what the student studies (level + subjects).
///
/// Level is single-select (`setLevel`); subjects toggle in/out of the draft
/// (`toggleSubject`). The dashed "+ More" chip opens the shared subject form
/// sheet so a custom subject can be added before continuing to ob-mood.
class ObStudyScreen extends ConsumerWidget {
  const ObStudyScreen({super.key});

  static const _levels = ['Undergraduate', 'Postgraduate', 'School', 'Self-taught'];
  static const _subjects = ['Engineering', 'CS', 'Medicine', 'Business', 'Law'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final draft = ref.watch(onboardingProvider);
    final controller = ref.read(onboardingProvider.notifier);

    return OnboardingScaffold(
      activeStep: 2,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'What are you\nstudying?',
            style: AppText.sans(size: 26, weight: FontWeight.w800, height: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            'Ada shapes your plan around your workload',
            style: AppText.sans(size: 12, color: colors.textMed),
          ),
          const SizedBox(height: 16),
          const FieldLabel('Level'),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final level in _levels)
                _Chip(
                  label: level,
                  active: draft.level == level,
                  onTap: () => controller.setLevel(level),
                ),
            ],
          ),
          const SizedBox(height: 14),
          const FieldLabel('Subjects'),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final subject in _subjects)
                _Chip(
                  label: subject,
                  active: draft.subjects.contains(subject),
                  onTap: () => controller.toggleSubject(subject),
                ),
              _Chip(
                label: '+ More',
                dashed: true,
                onTap: () => _openAddSubject(context, controller),
              ),
            ],
          ),
          const SizedBox(height: 24),
        ],
      ),
      footer: PrimaryButton(
        label: 'Continue →',
        onPressed: () => unawaited(context.push(Routes.obMood)),
      ),
    );
  }

  Future<void> _openAddSubject(
    BuildContext context,
    OnboardingController controller,
  ) async {
    final subject = await showModalBottomSheet<Subject>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SubjectFormSheet(),
    );
    final name = subject?.name.trim();
    if (name != null && name.isNotEmpty) {
      controller.toggleSubject(name);
    }
  }
}

/// Onboarding pill chip (prototype `Chip`). Active = accent border + accent-soft
/// fill + accent text; inactive = hairline border + surface + muted text. The
/// [dashed] variant is the accent-tinted "+ More" affordance.
class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.onTap,
    this.active = false,
    this.dashed = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool active;
  final bool dashed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderColor = (active || dashed)
        ? (dashed ? colors.accent.alpha8(0x88) : colors.accent)
        : colors.border;
    final fill = active ? colors.accentSoft : colors.surface;
    final textColor = (active || dashed) ? colors.accent : colors.textMed;

    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: dashed
          ? null
          : BoxDecoration(
              color: fill,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: borderColor, width: 1.5),
            ),
      child: Text(
        label,
        style: AppText.sans(size: 11, color: textColor),
      ),
    );

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: dashed
          ? CustomPaint(
              painter: _DashedPillBorder(color: borderColor),
              child: chip,
            )
          : chip,
    );
  }
}

/// Paints a 1.5px dashed pill outline for the "+ More" chip.
class _DashedPillBorder extends CustomPainter {
  const _DashedPillBorder({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(AppRadius.pill),
    );
    final path = Path()..addRRect(rrect);

    const dash = 4.0;
    const gap = 3.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(
          metric.extractPath(distance, distance + dash),
          paint,
        );
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedPillBorder oldDelegate) => oldDelegate.color != color;
}
