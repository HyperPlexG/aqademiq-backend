import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/circle_back_button.dart';
import '../../../shared/widgets/primary_button.dart';
import '../controllers/auth_controller.dart';
import 'widgets/otp_field.dart';

/// FRAMES `auth-otp` — OTP verification → onboarding.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  String _code = '419';

  Future<void> _verify() async {
    final ok = await ref.read(authControllerProvider.notifier).verify(_code);
    if (ok && mounted) context.go(Routes.obReferral);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final busy = ref.watch(authControllerProvider).isLoading;

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 10, 22, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(alignment: Alignment.centerLeft, child: CircleBackButton(onTap: () => context.pop())),
              const SizedBox(height: 20),
              Text("Verify it's you", style: AppText.sans(size: 28, weight: FontWeight.w800, color: colors.text)),
              const SizedBox(height: 6),
              Text.rich(
                TextSpan(
                  text: 'We sent a 6-digit code to\n',
                  style: AppText.sans(size: 12.5, height: 1.6, color: colors.textMed),
                  children: [
                    TextSpan(
                      text: 'ridhwan@bits.ac.in',
                      style: AppText.sans(size: 12.5, weight: FontWeight.w700, color: colors.text),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              OtpField(initial: _code, onCompleted: (v) => setState(() => _code = v)),
              const SizedBox(height: 24),
              PrimaryButton(label: busy ? 'Verifying…' : 'Verify →', onPressed: busy ? null : _verify),
              const SizedBox(height: 16),
              Center(
                child: Text.rich(
                  TextSpan(
                    text: "Didn't get a code? ",
                    style: AppText.sans(size: 11.5, height: 1.7, color: colors.textMed),
                    children: [
                      TextSpan(
                        text: 'Resend in 0:24',
                        style: AppText.sans(size: 11.5, weight: FontWeight.w700, color: colors.accent),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
