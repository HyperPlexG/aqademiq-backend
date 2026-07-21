import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../data/auth/auth_error.dart';
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
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;

  String? _emailError;
  String? _passwordError;

  /// Failure text from the last attempt (bad credentials, network, …). Null when
  /// nothing has failed yet.
  String? _formError;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  /// Returns true when the form is worth sending. Trailing whitespace in a
  /// pasted email is stripped rather than rejected — it is never intentional.
  bool _validate() {
    final email = _email.text.trim();
    final password = _password.text;
    setState(() {
      _formError = null;
      _emailError = email.isEmpty
          ? 'Enter your email.'
          : (isValidEmail(email) ? null : 'That does not look like an email address.');
      _passwordError = password.isEmpty ? 'Enter your password.' : null;
    });
    return _emailError == null && _passwordError == null;
  }

  Future<void> _signIn() async {
    if (!_validate()) return;
    final notifier = ref.read(authControllerProvider.notifier);
    final ok = await notifier.signIn(
      email: _email.text.trim(),
      password: _password.text,
    );
    if (!mounted) return;
    if (ok) {
      context.go(Routes.plan);
    } else {
      setState(() => _formError =
          authErrorMessage(ref.read(authControllerProvider).error));
    }
  }

  Future<void> _google() async {
    final ok = await ref.read(authControllerProvider.notifier).signInWithGoogle();
    if (!mounted) return;
    if (ok) {
      context.go(Routes.plan);
    } else {
      setState(() => _formError =
          authErrorMessage(ref.read(authControllerProvider).error));
    }
  }

  Future<void> _apple() async {
    final ok = await ref.read(authControllerProvider.notifier).signInWithApple();
    if (!mounted) return;
    if (ok) {
      context.go(Routes.plan);
    } else {
      setState(() => _formError =
          authErrorMessage(ref.read(authControllerProvider).error));
    }
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
                onTap: busy ? null : _apple,
              ),
              const SizedBox(height: 10),
              SsoButton(
                provider: SsoProvider.google,
                label: 'Sign in with Google',
                onTap: busy ? null : _google,
              ),
              const SizedBox(height: 18),
              const _OrDivider(),
              const SizedBox(height: 16),
              const FieldLabel('Email'),
              AppTextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
              ),
              _FieldError(_emailError),
              const SizedBox(height: 12),
              const FieldLabel('Password'),
              AppTextField(
                controller: _password,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => busy ? null : _signIn(),
                suffix: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, size: 17, color: colors.textMed),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              _FieldError(_passwordError),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => context.push(Routes.forgot),
                  child: Text(
                    'Forgot password?',
                    style: AppText.sans(size: 11.5, weight: FontWeight.w700, color: colors.accent),
                  ),
                ),
              ),
              if (_formError != null) ...[
                const SizedBox(height: 12),
                _FormError(_formError!),
              ],
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

/// Inline per-field validation message. Renders nothing when [message] is null so
/// the layout doesn't shift as errors appear and clear.
class _FieldError extends StatelessWidget {
  const _FieldError(this.message);

  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6, left: 2),
      child: Text(
        message!,
        style: AppText.sans(size: 11, color: context.colors.danger),
      ),
    );
  }
}

/// Whole-form failure (rejected credentials, network trouble).
class _FormError extends StatelessWidget {
  const _FormError(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.danger.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline, size: 16, color: colors.danger),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: AppText.sans(size: 11.5, height: 1.4, color: colors.danger),
            ),
          ),
        ],
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
