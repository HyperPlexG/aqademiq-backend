import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text.dart';

/// Duration presets shown in the picker grid, paired with the minute value
/// each cell commits when tapped (`plan-pick-duration`).
const _presets = <_Preset>[
  _Preset('15 min', 15),
  _Preset('25 min', 25),
  _Preset('30 min', 30),
  _Preset('45 min', 45),
  _Preset('1 hr', 60),
  _Preset('1.5 hr', 90),
];

/// The minute value that renders in the active state by default.
const _activeMinutes = 30;

/// Presents the `plan-pick-duration` bottom sheet. Tapping a preset cell returns
/// its minute value; "Custom duration → Set" opens [_showCustomDuration] and
/// returns the fine-tuned value from there. Returns `null` if dismissed.
Future<int?> showDurationPicker(BuildContext context) {
  return showModalBottomSheet<int>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x4C140F1C),
    builder: (_) => const _DurationSheet(),
  );
}

class _Preset {
  const _Preset(this.label, this.minutes);
  final String label;
  final int minutes;
}

class _DurationSheet extends StatelessWidget {
  const _DurationSheet();

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
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0DDD7),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Duration',
                      style: AppText.sans(
                        size: 20,
                        weight: FontWeight.w800,
                        color: colors.text,
                      ),
                    ),
                  ),
                  _CloseButton(onTap: () => Navigator.of(context).pop()),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 3, bottom: 12),
                child: Text(
                  'How long do you expect this to take?',
                  style: AppText.sans(size: 11.5, color: colors.textMed),
                ),
              ),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: AppSpacing.x2,
                crossAxisSpacing: AppSpacing.x2,
                childAspectRatio: 2.3,
                children: [
                  for (final preset in _presets)
                    _PresetCell(
                      preset: preset,
                      active: preset.minutes == _activeMinutes,
                      onTap: () => Navigator.of(context).pop(preset.minutes),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              _OptRow(
                icon: Icons.tune,
                label: 'Custom duration',
                onTap: () async {
                  final picked = await _showCustomDuration(context);
                  if (picked != null && context.mounted) {
                    Navigator.of(context).pop(picked);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A single preset cell in the 3-column grid. Active = accent fill / white w800;
/// inactive = `bg` fill / text w700.
class _PresetCell extends StatelessWidget {
  const _PresetCell({
    required this.preset,
    required this.active,
    required this.onTap,
  });

  final _Preset preset;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderRadius = BorderRadius.circular(AppRadius.rowInput);
    return Material(
      color: active ? colors.accent : colors.bg,
      borderRadius: borderRadius,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onTap,
        child: Center(
          child: Text(
            preset.label,
            style: AppText.sans(
              size: 13,
              weight: active ? FontWeight.w800 : FontWeight.w700,
              color: active ? Colors.white : colors.text,
            ),
          ),
        ),
      ),
    );
  }
}

/// A list row (`OptRow`) with a leading icon, label, and a trailing "Set →"
/// pill that opens the custom dialog.
class _OptRow extends StatelessWidget {
  const _OptRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderRadius = BorderRadius.circular(AppRadius.cellSmall);
    return Material(
      color: Colors.transparent,
      borderRadius: borderRadius,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
          child: Row(
            children: [
              Icon(icon, size: 19, color: colors.textMed),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: AppText.sans(size: 13.5, color: colors.text),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 12),
                decoration: BoxDecoration(
                  color: colors.bg,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  'Set →',
                  style: AppText.sans(
                    size: 11,
                    weight: FontWeight.w700,
                    color: colors.textMed,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Presents the `plan-pick-duration-custom` centered dialog. The stepper, slider
/// and quick chips mutate local state; "Set · N min" returns the chosen minutes.
Future<int?> _showCustomDuration(BuildContext context) {
  return showDialog<int>(
    context: context,
    barrierColor: const Color(0x66140F1C),
    builder: (_) => const _CustomDurationDialog(),
  );
}

class _CustomDurationDialog extends StatefulWidget {
  const _CustomDurationDialog();

  @override
  State<_CustomDurationDialog> createState() => _CustomDurationDialogState();
}

class _CustomDurationDialogState extends State<_CustomDurationDialog> {
  static const _min = 5;
  static const _max = 120;
  int _minutes = 50;

  void _setMinutes(int value) {
    setState(() => _minutes = value.clamp(_min, _max));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final fraction = (_minutes - _min) / (_max - _min);
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: 226,
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Custom duration',
                      style: AppText.sans(
                        size: 19,
                        weight: FontWeight.w800,
                        color: colors.text,
                      ),
                    ),
                  ),
                  _CloseButton(onTap: () => Navigator.of(context).pop()),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 3, bottom: 14),
                child: Text(
                  'Fine-tune the time you need',
                  style: AppText.sans(size: 11, color: colors.textMed),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _StepBtn(
                      icon: Icons.remove,
                      onTap: () => _setMinutes(_minutes - 5),
                    ),
                    const SizedBox(width: 18),
                    Row(
                      textBaseline: TextBaseline.alphabetic,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      children: [
                        Text(
                          '$_minutes',
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
                    _StepBtn(
                      icon: Icons.add,
                      onTap: () => _setMinutes(_minutes + 5),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _DurationSlider(
                  fraction: fraction,
                  onChanged: (value) =>
                      _setMinutes((_min + value * (_max - _min)).round()),
                ),
              ),
              Row(
                children: [
                  for (final chip in const [
                    _Preset('45 min', 45),
                    _Preset('1 hr', 60),
                    _Preset('1.5 hr', 90),
                    _Preset('2 hr', 120),
                  ])
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                          right: chip.minutes == 120 ? 0 : 6,
                        ),
                        child: _QuickChip(
                          label: chip.label,
                          onTap: () => _setMinutes(chip.minutes),
                        ),
                      ),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: _DialogCta(
                  label: 'Set · $_minutes min',
                  onTap: () => Navigator.of(context).pop(_minutes),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A 38px circular stepper button (`StepBtn`).
class _StepBtn extends StatelessWidget {
  const _StepBtn({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: colors.bg,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(icon, size: 20, color: colors.text),
        ),
      ),
    );
  }
}

/// The custom-duration slider: a `bg` track with an accent fill and a white
/// accent-bordered thumb. Drags translate the local fraction to minutes.
class _DurationSlider extends StatelessWidget {
  const _DurationSlider({required this.fraction, required this.onChanged});

  final double fraction;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        void handle(Offset local) =>
            onChanged((local.dx / width).clamp(0.0, 1.0));
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (details) => handle(details.localPosition),
          onHorizontalDragUpdate: (details) => handle(details.localPosition),
          child: SizedBox(
            height: 18,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.centerLeft,
              children: [
                Container(
                  height: 6,
                  decoration: BoxDecoration(
                    color: colors.bg,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                FractionallySizedBox(
                  widthFactor: fraction,
                  child: Container(
                    height: 6,
                    decoration: BoxDecoration(
                      color: colors.accent,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                Align(
                  alignment: Alignment(fraction * 2 - 1, 0),
                  child: Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: colors.accent, width: 2),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x40000000),
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// An inactive quick-pick chip in the custom dialog (`bg` fill / med text).
class _QuickChip extends StatelessWidget {
  const _QuickChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderRadius = BorderRadius.circular(AppRadius.pill);
    return Material(
      color: colors.bg,
      borderRadius: borderRadius,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: AppText.sans(
              size: 10.5,
              weight: FontWeight.w700,
              color: colors.textMed,
            ),
          ),
        ),
      ),
    );
  }
}

/// The ink CTA pill used by the custom dialog.
class _DialogCta extends StatelessWidget {
  const _DialogCta({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderRadius = BorderRadius.circular(AppRadius.pill);
    return Material(
      color: colors.ink,
      borderRadius: borderRadius,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 12),
          alignment: Alignment.center,
          child: Text(
            label,
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

/// The 26px circular close button shared by the sheet and dialog headers.
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
        child: Text(
          '✕',
          style: TextStyle(fontSize: 12, color: colors.textMed, height: 1),
        ),
      ),
    );
  }
}
