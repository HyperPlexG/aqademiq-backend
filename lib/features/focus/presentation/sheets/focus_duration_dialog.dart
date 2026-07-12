import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// fc-duration — centered "Set time" dialog. Opened by tapping the "Set time"
/// pill on the Focus setup screen. Returns the chosen minutes (5..120) when the
/// user taps "Set · N min", or `null` on dismiss (✕ / scrim).
Future<int?> showFocusDurationDialog(
  BuildContext context, {
  int current = 25,
}) {
  return showDialog<int>(
    context: context,
    barrierColor: const Color(0x6B140F1C),
    builder: (_) => _FocusDurationDialog(current: current),
  );
}

class _FocusDurationDialog extends StatefulWidget {
  const _FocusDurationDialog({required this.current});

  final int current;

  @override
  State<_FocusDurationDialog> createState() => _FocusDurationDialogState();
}

class _FocusDurationDialogState extends State<_FocusDurationDialog> {
  static const int _min = 5;
  static const int _max = 120;
  static const List<int> _presets = [15, 25, 45, 60];

  late int _minutes = widget.current.clamp(_min, _max);

  void _setMinutes(int value) {
    setState(() => _minutes = value.clamp(_min, _max));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: 230,
          padding: const EdgeInsets.fromLTRB(18, 17, 18, 18),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.sheetTop),
            boxShadow: const [
              BoxShadow(
                color: Color(0x57000000),
                blurRadius: 64,
                offset: Offset(0, 20),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Header(onClose: () => Navigator.of(context).pop()),
              _StepperRow(
                minutes: _minutes,
                onRemove: () => _setMinutes(_minutes - 5),
                onAdd: () => _setMinutes(_minutes + 5),
              ),
              _DurationSlider(
                minutes: _minutes,
                min: _min,
                max: _max,
                onChanged: (v) => _setMinutes(v.round()),
              ),
              _PresetChips(
                presets: _presets,
                selected: _minutes,
                onSelected: _setMinutes,
              ),
              _SetButton(
                minutes: _minutes,
                onPressed: () => Navigator.of(context).pop(_minutes),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Set time',
              style: AppText.sans(
                size: 19,
                weight: FontWeight.w800,
                color: colors.text,
              ),
            ),
          ),
          GestureDetector(
            onTap: onClose,
            child: Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
              child: Text(
                '✕',
                style: TextStyle(fontSize: 12, color: colors.textMed, height: 1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepperRow extends StatelessWidget {
  const _StepperRow({
    required this.minutes,
    required this.onRemove,
    required this.onAdd,
  });

  final int minutes;
  final VoidCallback onRemove;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _StepBtn(icon: Icons.remove, onTap: onRemove),
          const SizedBox(width: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '$minutes',
                style: AppText.sans(
                  size: 38,
                  weight: FontWeight.w800,
                  height: 1,
                  color: colors.text,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                'min',
                style: AppText.sans(
                  size: 13,
                  weight: FontWeight.w700,
                  color: colors.textMed,
                ),
              ),
            ],
          ),
          const SizedBox(width: 18),
          _StepBtn(icon: Icons.add, onTap: onAdd),
        ],
      ),
    );
  }
}

class _StepBtn extends StatelessWidget {
  const _StepBtn({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
        child: Icon(icon, size: 20, color: colors.text),
      ),
    );
  }
}

class _DurationSlider extends StatelessWidget {
  const _DurationSlider({
    required this.minutes,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  final int minutes;
  final int min;
  final int max;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: SliderTheme(
        data: SliderThemeData(
          trackHeight: 6,
          activeTrackColor: colors.accent,
          inactiveTrackColor: colors.bg,
          thumbColor: colors.surface,
          overlayColor: colors.accent.alpha8(0x1F),
          trackShape: const RoundedRectSliderTrackShape(),
          thumbShape: const _RingThumbShape(),
          overlayShape: const RoundSliderOverlayShape(overlayRadius: 16),
        ),
        child: Slider(
          min: min.toDouble(),
          max: max.toDouble(),
          value: minutes.toDouble().clamp(min.toDouble(), max.toDouble()),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

/// 18px white thumb with a 2px accent ring + soft drop shadow.
class _RingThumbShape extends SliderComponentShape {
  const _RingThumbShape();

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) => const Size(18, 18);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final canvas = context.canvas;
    const radius = 9.0;

    canvas
      ..drawCircle(
        center.translate(0, 2),
        radius,
        Paint()
          ..color = const Color(0x40000000)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      )
      ..drawCircle(
        center,
        radius,
        Paint()..color = sliderTheme.thumbColor ?? const Color(0xFFFFFFFF),
      )
      ..drawCircle(
        center,
        radius - 1,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = sliderTheme.activeTrackColor ?? const Color(0xFF6B5CF0),
      );
  }
}

class _PresetChips extends StatelessWidget {
  const _PresetChips({
    required this.presets,
    required this.selected,
    required this.onSelected,
  });

  final List<int> presets;
  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          for (var i = 0; i < presets.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: _PresetChip(
                value: presets[i],
                active: presets[i] == selected,
                onTap: () => onSelected(presets[i]),
                colors: colors,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PresetChip extends StatelessWidget {
  const _PresetChip({
    required this.value,
    required this.active,
    required this.onTap,
    required this.colors,
  });

  final int value;
  final bool active;
  final VoidCallback onTap;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? colors.accent : colors.bg,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Text(
          '$value',
          style: AppText.sans(
            size: 11,
            weight: FontWeight.w700,
            color: active ? Colors.white : colors.textMed,
          ),
        ),
      ),
    );
  }
}

class _SetButton extends StatelessWidget {
  const _SetButton({required this.minutes, required this.onPressed});

  final int minutes;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderRadius = BorderRadius.circular(AppRadius.pill);
    return Material(
      color: colors.ink,
      borderRadius: borderRadius,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          alignment: Alignment.center,
          child: Text(
            'Set · $minutes min',
            style: AppText.sans(
              size: 13,
              weight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
