import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/utils/hex_color.dart';
import '../../../core/utils/launch_external.dart';
import '../../../data/auth/auth_repository.dart';
import '../../../data/models/tag.dart';
import '../../../data/repositories/tags_repository.dart';
import '../../../shared/widgets/settings_row.dart';
import '../providers/prism_settings_provider.dart';
import '../providers/profile_controller.dart';
import 'sheets/add_tag_sheet.dart';
import 'sheets/appearance_sheet.dart';
import 'sheets/delete_account_dialog.dart';
import 'sheets/rate_sheet.dart';
import 'widgets/settings_scaffold.dart';

/// FRAMES `settings-home` / `settings-account` (same page, scrolled) — the
/// settings hub.
class SettingsHomeScreen extends ConsumerWidget {
  const SettingsHomeScreen({super.key});

  static String _modeLabel(ThemeMode mode) => switch (mode) {
        ThemeMode.light => 'Light',
        ThemeMode.dark => 'Dark',
        ThemeMode.system => 'System',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final mode = ref.watch(themeModeProvider);
    final profile = ref.watch(profileControllerProvider);

    return SettingsScaffold(
      title: 'Settings',
      big: true,
      gear: true,
      children: [
        GestureDetector(
          onTap: () => unawaited(context.push(Routes.settingsProfile)),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
            decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(18), boxShadow: colors.cardShadow),
            child: Row(
              children: [
                _Avatar(size: 46, emojiSize: 22, colors: colors),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(profile.name, style: AppText.sans(size: 15, weight: FontWeight.w800, color: colors.text)),
                      const SizedBox(height: 1),
                      Text(
                        [profile.university, profile.program].where((s) => s != null && s.isNotEmpty).join(' · '),
                        style: AppText.sans(size: 11.5, color: colors.textMed),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, size: 20, color: colors.textDim),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        const GroupLabel('Study tags'),
        _TagsCard(
          onAdd: () async {
            final result = await showAddTagSheet(context);
            if (result != null) {
              await ref.read(tagsProvider.notifier).add(
                    label: result.label,
                    colorHex: hexFromColor(result.color),
                  );
            }
          },
        ),
        const SizedBox(height: 7),
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 20),
          child: Text(
            'Ada uses your tags to read your workload and shape your plan.',
            style: AppText.sans(size: 10.5, height: 1.5, color: colors.textMed),
          ),
        ),
        const GroupLabel('Preferences'),
        SetGroup(
          children: [
            SettingsRow(label: 'Notifications', icon: Icons.notifications_none, showChevron: true, onTap: () => unawaited(context.push(Routes.settingsNotif))),
            SettingsRow(label: 'Appearance', icon: Icons.wb_sunny, value: _modeLabel(mode), showChevron: true, onTap: () => unawaited(showAppearanceSheet(context))),
            SettingsRow(label: 'Prism', icon: Icons.graphic_eq, value: ref.watch(prismDefaultModeProvider), showChevron: true, onTap: () => unawaited(context.push(Routes.settingsSounds))),
            SettingsRow(label: 'Calendar import', icon: Icons.calendar_today, showChevron: true, onTap: () => _comingSoon(context, 'Calendar import')),
            SettingsRow(label: 'Reminder import', icon: Icons.format_list_bulleted, showChevron: true, last: true, onTap: () => _comingSoon(context, 'Reminder import')),
          ],
        ),
        const SizedBox(height: 20),
        const GroupLabel('Account'),
        SetGroup(
          children: [
            SettingsRow(label: 'Email settings', icon: Icons.chat_bubble_outline, showChevron: true, onTap: () => unawaited(context.push(Routes.settingsEmail))),
            SettingsRow(
              label: 'Sign out',
              icon: Icons.logout,
              showChevron: true,
              onTap: () async {
                await ref.read(authRepositoryProvider).signOut();
                if (context.mounted) context.go(Routes.welcome);
              },
            ),
            SettingsRow(label: 'Delete account', icon: Icons.delete_outline, danger: true, showChevron: true, last: true, onTap: () => unawaited(showDeleteAccountDialog(context))),
          ],
        ),
        const SizedBox(height: 20),
        const GroupLabel('About'),
        SetGroup(
          children: [
            SettingsRow(label: 'Rate Aqademiq', icon: Icons.star_outline, showChevron: true, onTap: () => unawaited(showRateSheet(context))),
            SettingsRow(label: 'Privacy Policy', icon: Icons.description, showChevron: true, onTap: () => unawaited(openExternal(context, Uri.parse('https://aqademiq.app/privacy')))),
            SettingsRow(label: 'Terms of service', icon: Icons.help_outline, showChevron: true, last: true, onTap: () => unawaited(openExternal(context, Uri.parse('https://aqademiq.app/terms')))),
          ],
        ),
      ],
    );
  }
}

void _comingSoon(BuildContext context, String feature) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('$feature is coming soon.')),
  );
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.size, required this.emojiSize, required this.colors});
  final double size;
  final double emojiSize;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(center: const Alignment(-0.24, -0.34), colors: [colors.accentSoft, colors.accent]),
      ),
      child: Text('🎓', style: TextStyle(fontSize: emojiSize)),
    );
  }
}

class _TagsCard extends ConsumerWidget {
  const _TagsCard({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final tags = ref.watch(tagsProvider).value ?? const <Tag>[];
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 13, 13, 14),
      decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(18), boxShadow: colors.cardShadow),
      child: Wrap(
        spacing: 7,
        runSpacing: 7,
        children: [
          for (final t in tags)
            Container(
              padding: const EdgeInsets.fromLTRB(10, 5, 9, 5),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 7, height: 7, decoration: BoxDecoration(color: hexColor(t.color), shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text(t.label, style: AppText.sans(size: 11.5, weight: FontWeight.w700, color: colors.text)),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: () => unawaited(ref.read(tagsProvider.notifier).remove(t.id)),
                    behavior: HitTestBehavior.opaque,
                    child: Icon(Icons.close, size: 13, color: colors.textDim),
                  ),
                ],
              ),
            ),
          GestureDetector(
            onTap: onAdd,
            child: Container(
              padding: const EdgeInsets.fromLTRB(9, 5, 11, 5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: colors.accent.alpha8(0x88), width: 1.5),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add, size: 14, color: colors.accent),
                  const SizedBox(width: 3),
                  Text('New tag', style: AppText.sans(size: 11.5, weight: FontWeight.w700, color: colors.accent)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
