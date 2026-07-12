import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/primary_button.dart';
import '../controllers/auth_controller.dart';

/// FRAMES `welcome` — Jump in / Sign up / Sign in fork.
class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: Column(
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Image.asset('assets/images/logo.png', width: 124, height: 124, fit: BoxFit.contain),
                    const SizedBox(height: 18),
                    Text(
                      'Welcome to\nAqademiq',
                      textAlign: TextAlign.center,
                      style: AppText.sans(size: 27, weight: FontWeight.w800, letterSpacing: -0.5, height: 1.2, color: colors.text),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 18),
                child: Column(
                  children: [
                    PrimaryButton(
                      label: 'Sign in / Sign up',
                      onPressed: () => context.push(Routes.signin),
                    ),
                    const SizedBox(height: 9),
                    PrimaryButton(
                      label: 'Jump right in!',
                      ghost: true,
                      onPressed: () async {
                        await ref.read(authControllerProvider.notifier).guest();
                        if (context.mounted) context.go(Routes.plan);
                      },
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Jumping in as a guest? Your progress saves the moment you create an account.',
                      textAlign: TextAlign.center,
                      style: AppText.sans(size: 10.5, height: 1.5, color: colors.textMed),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
