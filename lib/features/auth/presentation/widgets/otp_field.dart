import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// A 6-cell OTP input (prototype `auth-otp`). Filled cells show the digit on an
/// `accentSoft` fill; the active cell shows an accent border + blinking cursor.
class OtpField extends StatefulWidget {
  const OtpField({super.key, this.length = 6, this.initial = '', this.onCompleted});

  final int length;
  final String initial;
  final ValueChanged<String>? onCompleted;

  @override
  State<OtpField> createState() => _OtpFieldState();
}

class _OtpFieldState extends State<OtpField> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initial);
  final FocusNode _focus = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final value = _controller.text;
    return GestureDetector(
      onTap: _focus.requestFocus,
      child: Stack(
        children: [
          Row(
            children: [
              for (var i = 0; i < widget.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: _cell(colors, i, value)),
              ],
            ],
          ),
          // Transparent capture field overlaid on the cells.
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: TextField(
                controller: _controller,
                focusNode: _focus,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(widget.length),
                ],
                onChanged: (v) {
                  setState(() {});
                  if (v.length == widget.length) widget.onCompleted?.call(v);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cell(AppColors colors, int i, String value) {
    final filled = i < value.length;
    final active = i == value.length;
    final border = filled
        ? colors.accent.withValues(alpha: 0.33)
        : (active ? colors.accent : colors.border);
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? colors.accentSoft : colors.bg,
          borderRadius: BorderRadius.circular(AppRadius.rowInput),
          border: Border.all(color: border, width: 2),
        ),
        child: filled
            ? Text(value[i], style: AppText.sans(size: 22, weight: FontWeight.w800, color: colors.text))
            : (active ? Container(width: 2, height: 22, color: colors.accent) : null),
      ),
    );
  }
}
