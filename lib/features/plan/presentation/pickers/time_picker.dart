import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/primary_button.dart';

/// Presents the time-of-day picker (`plan-pick-time`) as a bottom sheet.
///
/// Returns the chosen bucket label ("Anytime"/"Morning"/"Afternoon"/"Evening"),
/// or the formatted time ("2:30 PM") if the user sets a specific time via the
/// custom dialog. Returns `null` on dismiss.
Future<String?> showTimeOfDayPicker(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x4C140F1C),
    builder: (_) => const _TimeOfDaySheet(),
  );
}

class _TimeOfDaySheet extends StatelessWidget {
  const _TimeOfDaySheet();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius:
            const BorderRadius.vertical(top: Radius.circular(AppRadius.sheetTop)),
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
                      'Time of day',
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
                  'When should this land in your day?',
                  style: AppText.sans(size: 11.5, color: colors.textMed),
                ),
              ),
              _OptRow(
                icon: Icons.all_inclusive,
                label: 'Anytime',
                sub: 'Ada slots it into a free moment',
                active: true,
                onTap: () => Navigator.of(context).pop('Anytime'),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.wb_twilight,
                label: 'Morning',
                sub: 'Before 12 PM',
                onTap: () => Navigator.of(context).pop('Morning'),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.light_mode,
                label: 'Afternoon',
                sub: '12 – 5 PM',
                onTap: () => Navigator.of(context).pop('Afternoon'),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.nights_stay,
                label: 'Evening',
                sub: 'After 5 PM',
                onTap: () => Navigator.of(context).pop('Evening'),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.schedule,
                label: 'Specific time',
                trailing: const _SetPill(),
                onTap: () async {
                  final picked = await _showSpecificTimeDialog(context);
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

/// A picker list row (prototype `OptRow`).
class _OptRow extends StatelessWidget {
  const _OptRow({
    required this.icon,
    required this.label,
    this.sub,
    this.trailing,
    this.active = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String? sub;
  final Widget? trailing;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        decoration: BoxDecoration(
          color: active ? colors.accentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 19,
              color: active ? colors.accent : colors.textMed,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: AppText.sans(
                      size: 13.5,
                      weight: active ? FontWeight.w800 : FontWeight.w600,
                      color: active ? colors.accent : colors.text,
                    ),
                  ),
                  if (sub != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Text(
                        sub!,
                        style: AppText.sans(size: 10.5, color: colors.textDim),
                      ),
                    ),
                ],
              ),
            ),
            if (trailing != null)
              trailing!
            else if (active)
              Icon(Icons.check, size: 14, color: colors.accent),
          ],
        ),
      ),
    );
  }
}

/// Trailing "Set →" pill (prototype `SetPill`).
class _SetPill extends StatelessWidget {
  const _SetPill();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
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
        child: Text(
          '✕',
          style: TextStyle(fontSize: 12, color: colors.textMed, height: 1),
        ),
      ),
    );
  }
}

/// Centered "Set time" dialog (`plan-pick-time-custom`). Returns the formatted
/// time on commit, or `null` on dismiss.
Future<String?> _showSpecificTimeDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    barrierColor: const Color(0x66140F1C),
    builder: (_) => const _SpecificTimeDialog(),
  );
}

class _SpecificTimeDialog extends StatelessWidget {
  const _SpecificTimeDialog();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
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
                      'Set time',
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
                  'Pick the exact start time',
                  style: AppText.sans(size: 11, color: colors.textMed),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Positioned(
                          left: -2,
                          right: -2,
                          child: Container(
                            height: 40,
                            decoration: BoxDecoration(
                              color: colors.accentSoft,
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                        const Row(
                          children: [
                            Expanded(
                              child: _TimeWheelCol(values: [1, 2, 3], selected: 2),
                            ),
                            _WheelColon(),
                            Expanded(
                              child: _TimeWheelCol(
                                values: [15, 30, 45],
                                selected: 30,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  const _AmPmSegmented(),
                ],
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'Set · 2:30 PM',
                onPressed: () => Navigator.of(context).pop('2:30 PM'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A vertical wheel column (prototype `TimeWheelCol`): selected value large,
/// neighbours dimmed.
class _TimeWheelCol extends StatelessWidget {
  const _TimeWheelCol({required this.values, required this.selected});

  final List<int> values;
  final int selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < values.length; i++) ...[
          if (i > 0) const SizedBox(height: 9),
          Text(
            values[i].toString().padLeft(2, '0'),
            style: AppText.sans(
              size: values[i] == selected ? 22 : 15,
              weight:
                  values[i] == selected ? FontWeight.w800 : FontWeight.w600,
              color: values[i] == selected
                  ? colors.text
                  : const Color(0xFFC8C4BE),
            ),
          ),
        ],
      ],
    );
  }
}

class _WheelColon extends StatelessWidget {
  const _WheelColon();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Text(
      ':',
      style: AppText.sans(size: 20, weight: FontWeight.w800, color: colors.text),
    );
  }
}

/// AM/PM segmented control with PM selected (prototype state).
class _AmPmSegmented extends StatelessWidget {
  const _AmPmSegmented();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
          decoration: BoxDecoration(
            color: colors.bg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            'AM',
            style: AppText.sans(
              size: 12,
              weight: FontWeight.w700,
              color: colors.textMed,
            ),
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
          decoration: BoxDecoration(
            color: colors.accent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            'PM',
            style: AppText.sans(
              size: 12,
              weight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}
