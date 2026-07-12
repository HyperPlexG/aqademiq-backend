import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/theme/theme_controller.dart';

/// FRAMES `settings-appearance` — Light / Dark / System picker, wired to the live
/// theme (`themeModeProvider`).
Future<void> showAppearanceSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x6B140F1C),
    builder: (_) => const _AppearanceSheet(),
  );
}

class _AppearanceSheet extends ConsumerWidget {
  const _AppearanceSheet();

  static const List<(ThemeMode, IconData, String, String)> _options = [
    (ThemeMode.light, Icons.light_mode, 'Light', 'Always bright'),
    (ThemeMode.dark, Icons.dark_mode, 'Dark', 'Easy on the eyes'),
    (ThemeMode.system, Icons.brightness_auto, 'System', 'Match your device'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final mode = ref.watch(themeModeProvider);
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.sheetTop)),
        boxShadow: colors.sheetShadow,
      ),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: const Color(0xFFE0DDD7), borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Text('Appearance', style: AppText.sans(size: 20, weight: FontWeight.w800, color: colors.text)),
            const SizedBox(height: 16),
            for (final o in _options) ...[
              _Option(
                icon: o.$2,
                title: o.$3,
                subtitle: o.$4,
                selected: mode == o.$1,
                onTap: () {
                  ref.read(themeModeProvider.notifier).set(o.$1);
                  Navigator.of(context).pop();
                },
              ),
              if (o.$1 != ThemeMode.system) const SizedBox(height: 9),
            ],
          ],
        ),
      ),
    );
  }
}

class _Option extends StatelessWidget {
  const _Option({required this.icon, required this.title, required this.subtitle, required this.selected, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? colors.accentSoft : colors.hilite,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: selected ? colors.accent : Colors.transparent, width: 1.5),
        ),
        child: Row(
          children: [
            Icon(icon, size: 21, color: selected ? colors.accent : colors.text),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppText.sans(size: 14, weight: FontWeight.w700, color: selected ? colors.accent : colors.text)),
                  const SizedBox(height: 1),
                  Text(subtitle, style: AppText.sans(size: 11.5, color: colors.textMed)),
                ],
              ),
            ),
            if (selected) Icon(Icons.check_circle, size: 22, color: colors.accent),
          ],
        ),
      ),
    );
  }
}
