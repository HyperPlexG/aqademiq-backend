import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/circle_back_button.dart';
import '../../../shared/widgets/primary_button.dart';
import '../controllers/auth_controller.dart';

/// FRAMES `auth-signup` — Create an account.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _email = TextEditingController(text: 'ridhwan@bits.ac.in');
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure1 = true;
  bool _obscure2 = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final ok = await ref.read(authControllerProvider.notifier).signUp(
          name: _email.text.split('@').first,
          email: _email.text,
          password: _password.text,
        );
    if (ok && mounted) unawaited(context.push(Routes.verify));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final busy = ref.watch(authControllerProvider).isLoading;

    Widget eye({required bool obscure, required VoidCallback onToggle}) => IconButton(
          icon: Icon(obscure ? Icons.visibility_off : Icons.visibility, size: 17, color: colors.textMed),
          onPressed: onToggle,
        );

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 10, 22, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(alignment: Alignment.centerLeft, child: CircleBackButton(onTap: () => context.pop())),
              const SizedBox(height: 16),
              Text('Create account', style: AppText.sans(size: 28, weight: FontWeight.w800, color: colors.text)),
              const SizedBox(height: 4),
              Text('Save your streak, grades & plan', style: AppText.sans(size: 12, color: colors.textMed)),
              const SizedBox(height: 22),
              const FieldLabel('Email'),
              AppTextField(controller: _email, keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 14),
              const FieldLabel('Password'),
              AppTextField(
                controller: _password,
                obscureText: _obscure1,
                suffix: eye(obscure: _obscure1, onToggle: () => setState(() => _obscure1 = !_obscure1)),
              ),
              const SizedBox(height: 14),
              const FieldLabel('Confirm password'),
              AppTextField(
                controller: _confirm,
                obscureText: _obscure2,
                suffix: eye(obscure: _obscure2, onToggle: () => setState(() => _obscure2 = !_obscure2)),
              ),
              const SizedBox(height: 22),
              PrimaryButton(label: busy ? 'Creating…' : 'Create account →', onPressed: busy ? null : _create),
              const SizedBox(height: 14),
              Center(
                child: GestureDetector(
                  onTap: () => context.go(Routes.signin),
                  child: Text.rich(
                    TextSpan(
                      text: 'Already have an account? ',
                      style: AppText.sans(size: 11.5, color: colors.textMed),
                      children: [
                        TextSpan(
                          text: 'Sign in',
                          style: AppText.sans(size: 11.5, weight: FontWeight.w700, color: colors.text),
                        ),
                      ],
                    ),
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
