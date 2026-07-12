import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/primary_button.dart';
import '../controllers/auth_controller.dart';
import 'widgets/sso_buttons.dart';

/// FRAMES `auth` — Sign in (email + password, with SSO).
class SigninScreen extends ConsumerStatefulWidget {
  const SigninScreen({super.key});

  @override
  ConsumerState<SigninScreen> createState() => _SigninScreenState();
}

class _SigninScreenState extends ConsumerState<SigninScreen> {
  final _email = TextEditingController(text: 'ridhwan@bits.ac.in');
  final _password = TextEditingController(text: 'password');
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    final ok = await ref
        .read(authControllerProvider.notifier)
        .signIn(email: _email.text, password: _password.text);
    if (ok && mounted) context.go(Routes.plan);
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
              Text('Welcome.', style: AppText.sans(size: 30, weight: FontWeight.w800, color: colors.text)),
              const SizedBox(height: 4),
              Text('Sign in to continue', style: AppText.sans(size: 12, color: colors.textMed)),
              const SizedBox(height: 22),
              SsoButton(
                provider: SsoProvider.apple,
                label: 'Sign in with Apple',
                onTap: busy ? null : _signIn,
              ),
              const SizedBox(height: 10),
              SsoButton(
                provider: SsoProvider.google,
                label: 'Sign in with Google',
                onTap: busy ? null : _signIn,
              ),
              const SizedBox(height: 18),
              const _OrDivider(),
              const SizedBox(height: 16),
              const FieldLabel('Email'),
              AppTextField(controller: _email, keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 12),
              const FieldLabel('Password'),
              AppTextField(
                controller: _password,
                obscureText: _obscure,
                suffix: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, size: 17, color: colors.textMed),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Password reset arrives with account sync — coming soon.')),
                  ),
                  child: Text(
                    'Forgot password?',
                    style: AppText.sans(size: 11.5, weight: FontWeight.w700, color: colors.accent),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              PrimaryButton(label: busy ? 'Signing in…' : 'Sign in →', onPressed: busy ? null : _signIn),
              const SizedBox(height: 14),
              Center(
                child: GestureDetector(
                  onTap: () => context.push(Routes.signup),
                  child: Text.rich(
                    TextSpan(
                      text: 'New here? ',
                      style: AppText.sans(size: 11.5, color: colors.textMed),
                      children: [
                        TextSpan(
                          text: 'Create an account',
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

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        Expanded(child: Container(height: 1, color: colors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text('or email', style: AppText.sans(size: 11, color: colors.textDim)),
        ),
        Expanded(child: Container(height: 1, color: colors.border)),
      ],
    );
  }
}
