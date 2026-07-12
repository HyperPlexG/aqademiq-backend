import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/settings_row.dart';
import '../providers/profile_controller.dart';
import 'sheets/gender_sheet.dart';
import 'sheets/input_sheet.dart';
import 'sheets/password_sheet.dart';
import 'widgets/settings_scaffold.dart';

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String _formatDob(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';

/// FRAMES `settings-profile` — edit personal info. Every row reads from and
/// writes to [ProfileController], so edits persist and reflect everywhere.
class SettingsProfileScreen extends ConsumerWidget {
  const SettingsProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final profile = ref.watch(profileControllerProvider);
    final controller = ref.read(profileControllerProvider.notifier);

    return SettingsScaffold(
      title: 'Profile',
      children: [
        Center(
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(center: const Alignment(-0.24, -0.34), colors: [colors.accentSoft, colors.accent]),
                ),
                child: const Text('🎓', style: TextStyle(fontSize: 34)),
              ),
              const SizedBox(height: 9),
              Text('Change photo', style: AppText.sans(size: 12, weight: FontWeight.w800, color: colors.accent)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const GroupLabel('Personal'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'Name',
              value: profile.name,
              showChevron: true,
              onTap: () => _editText(context, title: 'What should we call you?', value: profile.name, onSave: controller.updateName),
            ),
            SettingsRow(
              label: 'Gender',
              value: profile.gender ?? 'Add',
              showChevron: true,
              onTap: () async {
                final picked = await showGenderSheet(context);
                if (picked != null) controller.updateGender(picked);
              },
            ),
            SettingsRow(
              label: 'Date of birth',
              value: profile.dateOfBirth == null ? 'Add' : _formatDob(profile.dateOfBirth!),
              showChevron: true,
              onTap: () => _editDob(context, current: profile.dateOfBirth, onSave: controller.updateDateOfBirth),
            ),
            SettingsRow(
              label: 'Health & accessibility',
              value: profile.health ?? 'Add',
              showChevron: true,
              last: true,
              onTap: () => _editText(context, title: 'Anything we should know?', value: profile.health ?? '', onSave: controller.updateHealth),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const GroupLabel('Account'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'Email',
              value: profile.email,
              showChevron: true,
              onTap: () => _editText(context, title: 'Change email address', value: profile.email, light: true, onSave: controller.updateEmail),
            ),
            SettingsRow(
              label: 'Password',
              showChevron: true,
              last: true,
              onTap: () => showPasswordSheet(context),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const GroupLabel('Study'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'University',
              value: profile.university ?? 'Add',
              showChevron: true,
              onTap: () => _editText(context, title: 'Your university', value: profile.university ?? '', onSave: controller.updateUniversity),
            ),
            SettingsRow(
              label: 'Program',
              value: profile.program ?? 'Add',
              showChevron: true,
              last: true,
              onTap: () => _editText(context, title: 'Your program', value: profile.program ?? '', onSave: controller.updateProgram),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _editText(
    BuildContext context, {
    required String title,
    required String value,
    required void Function(String) onSave,
    bool light = false,
  }) async {
    final result = await showInputSheet(context, title: title, value: value, light: light);
    if (result != null && result.isNotEmpty) onSave(result);
  }

  Future<void> _editDob(
    BuildContext context, {
    required DateTime? current,
    required void Function(DateTime) onSave,
  }) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime(now.year - 20, now.month, now.day),
      firstDate: DateTime(1950),
      lastDate: now,
    );
    if (picked != null) onSave(picked);
  }
}
