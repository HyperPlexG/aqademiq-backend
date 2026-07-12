import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../shared/widgets/app_bottom_sheet.dart';
import '../../../shared/widgets/settings_row.dart';
import '../providers/prism_settings_provider.dart';
import 'widgets/settings_scaffold.dart';

/// settings-sounds — Prism (Focus audio + in-app sounds).
class PrismSettingsScreen extends ConsumerStatefulWidget {
  const PrismSettingsScreen({super.key});

  @override
  ConsumerState<PrismSettingsScreen> createState() => _PrismSettingsScreenState();
}

class _PrismSettingsScreenState extends ConsumerState<PrismSettingsScreen> {
  bool _playInFocus = true;
  bool _allInApp = true;
  bool _createTask = true;
  bool _completeTask = true;
  bool _taskCountdown = true;
  bool _completeSubtask = true;

  Future<void> _pickDefaultMode() async {
    final current = ref.read(prismDefaultModeProvider);
    final picked = await showAppBottomSheet<String>(
      context,
      title: 'Default Prism mode',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final mode in prismModes)
            _ModeOption(
              label: mode,
              selected: mode == current,
              onTap: () => Navigator.of(context).pop(mode),
            ),
        ],
      ),
    );
    if (picked != null) ref.read(prismDefaultModeProvider.notifier).set(picked);
  }

  @override
  Widget build(BuildContext context) {
    final defaultMode = ref.watch(prismDefaultModeProvider);
    return SettingsScaffold(
      title: 'Prism',
      children: [
        const GroupLabel('Prism focus audio'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'Play Prism in Focus',
              toggle: _playInFocus,
              onToggle: (v) => setState(() => _playInFocus = v),
            ),
            SettingsRow(
              label: 'Default mode',
              value: defaultMode,
              showChevron: true,
              last: true,
              onTap: _pickDefaultMode,
            ),
          ],
        ),
        const SizedBox(height: 20),
        const GroupLabel('In-app sounds'),
        SetGroup(
          children: [
            SettingsRow(
              label: 'All in-app sounds',
              toggle: _allInApp,
              onToggle: (v) => setState(() => _allInApp = v),
            ),
            SettingsRow(
              label: 'Create task',
              toggle: _createTask,
              onToggle: (v) => setState(() => _createTask = v),
            ),
            SettingsRow(
              label: 'Complete task',
              toggle: _completeTask,
              onToggle: (v) => setState(() => _completeTask = v),
            ),
            SettingsRow(
              label: 'Task countdown',
              toggle: _taskCountdown,
              onToggle: (v) => setState(() => _taskCountdown = v),
            ),
            SettingsRow(
              label: 'Complete a subtask item',
              toggle: _completeSubtask,
              onToggle: (v) => setState(() => _completeSubtask = v),
              last: true,
            ),
          ],
        ),
      ],
    );
  }
}

/// A selectable row in the default-Prism-mode picker sheet.
class _ModeOption extends StatelessWidget {
  const _ModeOption({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
          decoration: BoxDecoration(
            color: selected ? colors.accentSoft : colors.hilite,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(width: 1.5, color: selected ? colors.accent : Colors.transparent),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: AppText.sans(size: 13.5, weight: FontWeight.w700, color: selected ? colors.accent : colors.text)),
              if (selected) Icon(Icons.check_circle, size: 20, color: colors.accent),
            ],
          ),
        ),
      ),
    );
  }
}
