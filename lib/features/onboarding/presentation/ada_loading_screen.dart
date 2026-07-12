import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../providers/onboarding_controller.dart';

/// Onboarding step 7 (prototype `adaload`): the automatic loading/transition
/// screen shown while Ada builds the first plan. It has no step Dots and no
/// CTA — after a short delay it finishes onboarding and enters the app.
class AdaLoadingScreen extends ConsumerStatefulWidget {
  const AdaLoadingScreen({super.key});

  @override
  ConsumerState<AdaLoadingScreen> createState() => _AdaLoadingScreenState();
}

class _AdaLoadingScreenState extends ConsumerState<AdaLoadingScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 2200), () async {
      await ref.read(onboardingProvider.notifier).finish();
      if (mounted) context.go(Routes.plan);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    const checklist = <(bool, String)>[
      (true, 'Reading your materials'),
      (true, 'Mapping your deadlines'),
      (false, 'Building your week'),
    ];

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const AdaMascot(size: 76, expr: AdaExpr.focused),
                const SizedBox(height: 18),
                Text(
                  "Ada's getting ready",
                  textAlign: TextAlign.center,
                  style: AppText.sans(size: 20, weight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  'Building your first plan...',
                  textAlign: TextAlign.center,
                  style: AppText.sans(size: 12, color: colors.textMed),
                ),
                const SizedBox(height: 30),
                SizedBox(
                  width: 200,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final (done, label) in checklist) ...[
                        _ChecklistRow(done: done, label: label),
                        if (label != checklist.last.$2)
                          const SizedBox(height: 14),
                      ],
                    ],
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

/// One checklist row: a 22px status circle (filled accent + white check when
/// done, else an outlined circle holding a tiny spinner) and its label.
class _ChecklistRow extends StatelessWidget {
  const _ChecklistRow({required this.done, required this.label});

  final bool done;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Row(
      children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done ? colors.accent : Colors.transparent,
            border: done
                ? null
                : Border.all(color: colors.textDim, width: 1.5),
          ),
          child: done
              ? const Icon(Icons.check, size: 10, color: Colors.white)
              : SizedBox(
                  width: 10,
                  height: 10,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(colors.accent),
                  ),
                ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: AppText.sans(
              size: 12,
              weight: done ? FontWeight.w400 : FontWeight.w700,
              color: done ? colors.textDim : colors.text,
            ).copyWith(
              decoration: done ? TextDecoration.lineThrough : null,
            ),
          ),
        ),
      ],
    );
  }
}
