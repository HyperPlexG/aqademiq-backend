import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// Presents the "Notification sound" sheet (`settings-notif-sound`) — a bottom
/// sheet over the dimmed Notifications screen. Lists five sound options as pill
/// rows. Tapping an option pops with its label; returns `null` on dismiss.
Future<String?> showNotifSoundSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x6B140F1C),
    isScrollControlled: true,
    builder: (_) => const _NotifSoundSheet(),
  );
}

const _sounds = <String>['Chime', 'Pulse', 'Glass', 'Drop', 'None'];

class _NotifSoundSheet extends StatefulWidget {
  const _NotifSoundSheet();

  @override
  State<_NotifSoundSheet> createState() => _NotifSoundSheetState();
}

class _NotifSoundSheetState extends State<_NotifSoundSheet> {
  String _selected = 'Chime';

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadius.sheetTop),
        ),
        boxShadow: colors.sheetShadow,
      ),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0DDD7),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                'Notification sound',
                style: AppText.sans(
                  size: 20,
                  weight: FontWeight.w800,
                  color: colors.text,
                ),
              ),
            ),
            for (final sound in _sounds)
              _OptionRow(
                label: sound,
                selected: sound == _selected,
                onTap: () {
                  setState(() => _selected = sound);
                  Navigator.of(context).pop(sound);
                },
              ),
          ],
        ),
      ),
    );
  }
}

/// A single pill-shaped sound option (prototype `OptionRow`).
class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = colors.accent;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(bottom: 9),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: selected ? colors.accentSoft : colors.hilite,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(
            width: 1.5,
            color: selected ? accent : Colors.transparent,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: AppText.sans(
                size: 13.5,
                weight: FontWeight.w700,
                color: selected ? accent : colors.text,
              ),
            ),
            if (selected) Icon(Icons.check_circle, size: 20, color: accent),
          ],
        ),
      ),
    );
  }
}
