import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';

/// Opens the settings-delete confirm dialog ("Delete account?").
///
/// Returns `true` when the user confirms deletion, `false` on cancel,
/// and `null` if dismissed by tapping the barrier.
///
/// The real settings screen behind is dimmed by the barrier — do not rebuild it.
Future<bool?> showDeleteAccountDialog(BuildContext context) {
  return showDialog<bool>(
    context: context,
    barrierColor: const Color(0x6B140F1C),
    builder: (_) => const _DeleteAccountDialog(),
  );
}

class _DeleteAccountDialog extends StatelessWidget {
  const _DeleteAccountDialog();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: 212,
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(22),
            boxShadow: const [
              BoxShadow(
                color: Color(0x57000000),
                blurRadius: 64,
                offset: Offset(0, 20),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Delete account?',
                style: AppText.sans(
                  size: 19,
                  weight: FontWeight.w800,
                  color: colors.text,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'This permanently removes your profile and data. '
                'There is no undo.',
                style: AppText.sans(
                  size: 12,
                  height: 1.5,
                  color: colors.textMed,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(false),
                    child: Text(
                      'Cancel',
                      style: AppText.sans(
                        size: 13,
                        weight: FontWeight.w700,
                        color: colors.textMed,
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(true),
                    child: Text(
                      'Delete',
                      style: AppText.sans(
                        size: 13,
                        weight: FontWeight.w800,
                        color: const Color(0xFFE85476),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
