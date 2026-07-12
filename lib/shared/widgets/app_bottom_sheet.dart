import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_text.dart';

/// Canonical scrim opacities (prototype): pickers 0.30, dialogs 0.40,
/// settings 0.42 (max).
abstract final class AppScrim {
  static const Color picker = Color(0x4C140F1C);
  static const Color settings = Color(0x6B140F1C);
  static const Color dialog = Color(0x66140F1C);
}

/// Presents an [AppBottomSheet] over the dimmed real screen (README §4: "the
/// real screen, dimmed — not a fake backdrop"). Top corners 24, drag handle,
/// title + close, content.
Future<T?> showAppBottomSheet<T>(
  BuildContext context, {
  required String title,
  required Widget child,
  String? subtitle,
  Color scrim = AppScrim.settings,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: scrim,
    builder: (_) => AppBottomSheet(title: title, subtitle: subtitle, child: child),
  );
}

class AppBottomSheet extends StatelessWidget {
  const AppBottomSheet({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    // Lift the whole sheet above the keyboard; the body below scrolls so tall
    // forms stay reachable while a field is focused.
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.92),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.sheetTop)),
          boxShadow: colors.sheetShadow,
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0DDD7),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: AppText.sans(size: 20, weight: FontWeight.w800, color: colors.text),
                      ),
                    ),
                    _CloseButton(onTap: () => Navigator.of(context).pop()),
                  ],
                ),
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 3, 18, 0),
                  child: Text(
                    subtitle!,
                    style: AppText.sans(size: 11.5, color: colors.textMed),
                  ),
                ),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
                  child: child,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 26,
        height: 26,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
        child: Text('✕', style: TextStyle(fontSize: 12, color: colors.textMed, height: 1)),
      ),
    );
  }
}
