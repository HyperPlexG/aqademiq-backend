import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/app_bottom_sheet.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../auth/controllers/auth_controller.dart';

/// Presents the change-password sheet (`settings-password`). Wired to
/// `POST /v1/auth/change-password` via the auth controller (§2.1). In mock mode
/// the repository resolves successfully without a server round-trip.
Future<void> showPasswordSheet(BuildContext context) {
  return showAppBottomSheet<void>(
    context,
    title: 'Change password',
    child: const _PasswordBody(),
  );
}

class _PasswordBody extends ConsumerStatefulWidget {
  const _PasswordBody();

  @override
  ConsumerState<_PasswordBody> createState() => _PasswordBodyState();
}

class _PasswordBodyState extends ConsumerState<_PasswordBody> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_current.text.isEmpty || _next.text.isEmpty) {
      setState(() => _error = 'Fill in every field.');
      return;
    }
    if (_next.text != _confirm.text) {
      setState(() => _error = "New passwords don't match.");
      return;
    }
    setState(() => _error = null);
    final ok = await ref.read(authControllerProvider.notifier).changePassword(
          oldPassword: _current.text,
          newPassword: _next.text,
        );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated.')),
      );
    } else {
      setState(() => _error = 'Current password is incorrect.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = ref.watch(authControllerProvider).isLoading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PasswordField(label: 'Current password', controller: _current),
        const SizedBox(height: 13),
        _PasswordField(label: 'New password', controller: _next),
        const SizedBox(height: 13),
        _PasswordField(label: 'Confirm new password', controller: _confirm),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(
            _error!,
            style: AppText.sans(size: 11.5, color: context.colors.danger),
          ),
        ],
        const SizedBox(height: 10),
        PrimaryButton(
          label: busy ? 'Updating…' : 'Update password',
          onPressed: busy ? null : _submit,
        ),
      ],
    );
  }
}

class _PasswordField extends StatelessWidget {
  const _PasswordField({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 6),
          child: Text(
            label,
            style: AppText.sans(
              size: 11.5,
              weight: FontWeight.w700,
              color: context.colors.textMed,
            ),
          ),
        ),
        AppTextField(controller: controller, obscureText: true),
      ],
    );
  }
}
