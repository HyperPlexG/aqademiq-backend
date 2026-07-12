import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/app_bottom_sheet.dart';

/// FRAMES `settings-editname` / `settings-email-change` / `settings-university` /
/// `settings-program` — one reusable single-field sheet on the canonical
/// [AppBottomSheet] shell (keyboard-aware). `light` makes the send button
/// white-on-surface (used by change-email); otherwise ink.
Future<String?> showInputSheet(
  BuildContext context, {
  required String title,
  required String value,
  bool light = false,
}) {
  return showAppBottomSheet<String>(
    context,
    title: title,
    child: _InputBody(value: value, light: light),
  );
}

class _InputBody extends StatefulWidget {
  const _InputBody({required this.value, required this.light});
  final String value;
  final bool light;

  @override
  State<_InputBody> createState() => _InputBodyState();
}

class _InputBodyState extends State<_InputBody> {
  late final TextEditingController _controller = TextEditingController(text: widget.value);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() => Navigator.of(context).pop(_controller.text.trim());

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(AppRadius.rowInput)),
            padding: const EdgeInsets.fromLTRB(15, 4, 12, 4),
            child: TextField(
              controller: _controller,
              autofocus: true,
              cursorColor: colors.accent,
              style: AppText.sans(size: 14, color: colors.text),
              decoration: const InputDecoration(isDense: true, border: InputBorder.none),
              onSubmitted: (_) => _submit(),
            ),
          ),
        ),
        const SizedBox(width: 10),
        GestureDetector(
          onTap: _submit,
          child: Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: widget.light ? colors.surface : colors.ink,
              shape: BoxShape.circle,
              boxShadow: widget.light ? colors.cardShadow : null,
            ),
            child: Icon(Icons.arrow_upward, size: 18, color: widget.light ? colors.text : Colors.white),
          ),
        ),
      ],
    );
  }
}
