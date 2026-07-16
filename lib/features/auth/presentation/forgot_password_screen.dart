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
import 'widgets/otp_field.dart';

/// FRAMES `auth` → "Forgot password?" — a 3-step reset flow over
/// `POST /auth/forgot-password` → `/verify` → `/reset`.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

enum _Step { email, code, reset }

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String _code = '';
  _Step _step = _Step.email;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    final auth = ref.read(authControllerProvider.notifier);
    setState(() => _error = null);
    switch (_step) {
      case _Step.email:
        if (_email.text.trim().isEmpty) {
          return setState(() => _error = 'Enter your email.');
        }
        if (await auth.forgotPassword(_email.text.trim())) {
          if (mounted) setState(() => _step = _Step.code);
        }
      case _Step.code:
        if (_code.length < 6) {
          return setState(() => _error = 'Enter the 6-digit code.');
        }
        final ok = await auth.forgotVerify(email: _email.text.trim(), code: _code);
        if (ok && mounted) {
          setState(() => _step = _Step.reset);
        } else if (mounted) {
          setState(() => _error = 'That code is invalid or expired.');
        }
      case _Step.reset:
        if (_password.text.isEmpty) {
          return setState(() => _error = 'Enter a new password.');
        }
        if (_password.text != _confirm.text) {
          return setState(() => _error = "Passwords don't match.");
        }
        final ok = await auth.forgotReset(
          email: _email.text.trim(),
          code: _code,
          newPassword: _password.text,
        );
        if (ok && mounted) {
          context.go(Routes.signin);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Password reset — sign in with your new password.')),
          );
        } else if (mounted) {
          setState(() => _error = 'Could not reset. Request a new code.');
        }
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
              Align(
                alignment: Alignment.centerLeft,
                child: CircleBackButton(onTap: () => context.pop()),
              ),
              const SizedBox(height: 16),
              Text(_title, style: AppText.sans(size: 28, weight: FontWeight.w800, color: colors.text)),
              const SizedBox(height: 4),
              Text(_subtitle, style: AppText.sans(size: 12, height: 1.5, color: colors.textMed)),
              const SizedBox(height: 22),
              ..._body(colors),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: AppText.sans(size: 11.5, color: colors.danger)),
              ],
              const SizedBox(height: 22),
              PrimaryButton(label: busy ? 'Please wait…' : _cta, onPressed: busy ? null : _next),
            ],
          ),
        ),
      ),
    );
  }

  String get _title => switch (_step) {
        _Step.email => 'Reset password',
        _Step.code => "Verify it's you",
        _Step.reset => 'New password',
      };

  String get _subtitle => switch (_step) {
        _Step.email => "Enter your email and we'll send a reset code.",
        _Step.code => 'Enter the 6-digit code we sent to ${_email.text.trim()}.',
        _Step.reset => 'Choose a new password for your account.',
      };

  String get _cta => switch (_step) {
        _Step.email => 'Send code →',
        _Step.code => 'Verify →',
        _Step.reset => 'Reset password →',
      };

  List<Widget> _body(AppColors colors) {
    switch (_step) {
      case _Step.email:
        return [
          const FieldLabel('Email'),
          AppTextField(controller: _email, keyboardType: TextInputType.emailAddress),
        ];
      case _Step.code:
        return [
          OtpField(initial: _code, onCompleted: (v) => setState(() => _code = v)),
        ];
      case _Step.reset:
        return [
          const FieldLabel('New password'),
          AppTextField(controller: _password, obscureText: true),
          const SizedBox(height: 14),
          const FieldLabel('Confirm password'),
          AppTextField(controller: _confirm, obscureText: true),
        ];
    }
  }
}
