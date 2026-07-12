import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/primary_button.dart';
import '../providers/onboarding_controller.dart';
import 'widgets/onboarding_scaffold.dart';

/// Onboarding step 1 (prototype `ob1`): the user's first name. Writes to the
/// draft on every keystroke; the CTA persists the name and advances to the
/// "what you study" step.
class ObNameScreen extends ConsumerStatefulWidget {
  const ObNameScreen({super.key});

  @override
  ConsumerState<ObNameScreen> createState() => _ObNameScreenState();
}

class _ObNameScreenState extends ConsumerState<ObNameScreen> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    final existing = ref.read(onboardingProvider).name;
    _controller = TextEditingController(text: existing.isEmpty ? 'Ridhwan' : existing);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return OnboardingScaffold(
      activeStep: 1,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'What should we\ncall you?',
            style: AppText.sans(size: 26, weight: FontWeight.w800, height: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            'First name is fine',
            style: AppText.sans(size: 12, color: colors.textMed),
          ),
          const SizedBox(height: 20),
          // Filled name field (prototype `ob1`): large text, accent focus border.
          TextField(
            controller: _controller,
            autofocus: true,
            cursorColor: colors.accent,
            style: AppText.sans(size: 18, weight: FontWeight.w700, color: colors.text),
            onChanged: ref.read(onboardingProvider.notifier).setName,
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: colors.bg,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.rowInput),
                borderSide: BorderSide(color: colors.accent, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.rowInput),
                borderSide: BorderSide(color: colors.accent, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Ada uses this in sessions and check-ins',
            style: AppText.sans(size: 11, color: colors.textDim),
          ),
          const SizedBox(height: 20),
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
                    "Hi, I'm Ada — your focus companion. I'll learn how you "
                    'work and help you build your week accordingly.',
                    style: AppText.sans(size: 11, height: 1.6, color: colors.text),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      footer: PrimaryButton(
        label: 'Continue →',
        onPressed: () {
          ref.read(onboardingProvider.notifier).setName(_controller.text);
          unawaited(context.push(Routes.obStudy));
        },
      ),
    );
  }
}
