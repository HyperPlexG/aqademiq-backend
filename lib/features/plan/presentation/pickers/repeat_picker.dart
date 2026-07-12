import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../data/models/enums.dart';
import '../../../../data/models/task.dart';

/// Presents the Repeat picker bottom sheet (`plan-pick-repeat`) and returns the
/// chosen [RepeatRule] (recurrence the planner actually expands), or `null` if
/// dismissed. A `frequency: none` rule means "No repeat".
Future<RepeatRule?> showRepeatPicker(BuildContext context) {
  return showModalBottomSheet<RepeatRule>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x4C140F1C),
    builder: (_) => const _RepeatSheet(),
  );
}

/// Human label for a [RepeatRule], shown on the Add-task "Repeat" row.
String repeatRuleLabel(RepeatRule? rule) {
  if (rule == null || rule.frequency == RepeatFrequency.none) return 'No repeat';
  switch (rule.frequency) {
    case RepeatFrequency.daily:
      return rule.interval == 1 ? 'Every day' : 'Every ${rule.interval} days';
    case RepeatFrequency.weekly:
      final wd = rule.weekdays.toSet();
      if (wd.length == 5 && wd.containsAll({1, 2, 3, 4, 5})) return 'Weekdays';
      return rule.interval == 1 ? 'Weekly' : 'Every ${rule.interval} weeks';
    case RepeatFrequency.monthly:
      return rule.interval == 1 ? 'Monthly' : 'Every ${rule.interval} months';
    case RepeatFrequency.none:
    case RepeatFrequency.custom:
      return 'Custom';
  }
}

/// The bottom-sheet shell (prototype `PickerSheet`, `hi="Repeat"`).
class _RepeatSheet extends StatelessWidget {
  const _RepeatSheet();

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
                      'Repeat',
                      style: AppText.sans(
                        size: 20,
                        weight: FontWeight.w800,
                        color: colors.text,
                      ),
                    ),
                  ),
                  _CloseCircle(onTap: () => Navigator.of(context).pop()),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(
                  'Make this a recurring task',
                  style: AppText.sans(size: 11.5, color: colors.textMed),
                ),
              ),
              const SizedBox(height: 12),
              _OptRow(
                icon: Icons.block,
                label: 'No repeat',
                active: true,
                onTap: () => Navigator.of(context).pop(const RepeatRule(frequency: RepeatFrequency.none)),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.today,
                label: 'Every day',
                onTap: () => Navigator.of(context).pop(const RepeatRule(frequency: RepeatFrequency.daily)),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.work_outline,
                label: 'Weekdays',
                sub: 'Mon – Fri',
                onTap: () => Navigator.of(context).pop(const RepeatRule(frequency: RepeatFrequency.weekly, weekdays: [1, 2, 3, 4, 5])),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.event_repeat,
                label: 'Weekly',
                sub: 'Same weekday',
                onTap: () => Navigator.of(context).pop(const RepeatRule(frequency: RepeatFrequency.weekly)),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.calendar_month,
                label: 'Monthly',
                sub: 'Same date',
                onTap: () => Navigator.of(context).pop(const RepeatRule(frequency: RepeatFrequency.monthly)),
              ),
              const SizedBox(height: 1),
              _OptRow(
                icon: Icons.tune,
                label: 'Custom…',
                trailing: const _SetPill(),
                onTap: () async {
                  final result = await _showCustomRepeatDialog(context);
                  if (result != null && context.mounted) {
                    Navigator.of(context).pop(result);
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

/// Opens the centered Custom repeat dialog (`plan-pick-repeat-custom`, w=234)
/// and returns the built [RepeatRule], or `null` if dismissed.
Future<RepeatRule?> _showCustomRepeatDialog(BuildContext context) {
  return showDialog<RepeatRule>(
    context: context,
    barrierColor: const Color(0x66140F1C),
    builder: (_) => const _CustomRepeatDialog(),
  );
}

/// A list row in the picker sheet (prototype `OptRow`).
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
    final leadColor = active ? colors.accent : colors.textMed;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        decoration: BoxDecoration(
          color: active ? colors.accentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadius.cellSmall),
        ),
        child: Row(
          children: [
            Icon(icon, size: 19, color: leadColor),
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
              Text(
                '✓',
                style: AppText.sans(
                  size: 14,
                  weight: FontWeight.w800,
                  color: colors.accent,
                ),
              ),
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
        style: AppText.sans(size: 11, weight: FontWeight.w700, color: colors.textMed),
      ),
    );
  }
}

/// The centered Custom repeat dialog (prototype `CenterDialog`, w=234).
class _CustomRepeatDialog extends StatefulWidget {
  const _CustomRepeatDialog();

  @override
  State<_CustomRepeatDialog> createState() => _CustomRepeatDialogState();
}

class _CustomRepeatDialogState extends State<_CustomRepeatDialog> {
  static const _units = ['Days', 'Weeks', 'Months'];
  static const _dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  int _interval = 2;
  int _unitIndex = 1; // Weeks
  final Set<int> _activeDays = {0, 2}; // Mon & Wed

  String get _ctaLabel {
    final unit = _units[_unitIndex].toLowerCase();
    final singular = _interval == 1 ? unit.substring(0, unit.length - 1) : unit;
    return 'Every $_interval $singular';
  }

  /// Build the recurrence from the dialog's interval / unit / weekday picks.
  /// Days→daily, Weeks→weekly (with chosen weekdays, 1=Mon…7=Sun), Months→monthly.
  RepeatRule get _rule => switch (_unitIndex) {
        0 => RepeatRule(frequency: RepeatFrequency.daily, interval: _interval),
        2 => RepeatRule(frequency: RepeatFrequency.monthly, interval: _interval),
        _ => RepeatRule(
            frequency: RepeatFrequency.weekly,
            interval: _interval,
            weekdays: (_activeDays.map((i) => i + 1).toList()..sort()),
          ),
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: 234,
          padding: const EdgeInsets.fromLTRB(18, 17, 18, 18),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.sheetTop),
            boxShadow: const [
              BoxShadow(color: Color(0x57000000), blurRadius: 64, offset: Offset(0, 20)),
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
                      'Custom repeat',
                      style: AppText.sans(
                        size: 19,
                        weight: FontWeight.w800,
                        color: colors.text,
                      ),
                    ),
                  ),
                  _CloseCircle(onTap: () => Navigator.of(context).pop()),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 3, bottom: 14),
                child: Text(
                  'Set your own recurring rhythm',
                  style: AppText.sans(size: 11, color: colors.textMed),
                ),
              ),
              _IntervalRow(
                value: _interval,
                onDecrement: _interval > 1
                    ? () => setState(() => _interval--)
                    : null,
                onIncrement: () => setState(() => _interval++),
              ),
              const SizedBox(height: 14),
              _UnitSegmented(
                units: _units,
                selected: _unitIndex,
                onSelect: (i) => setState(() => _unitIndex = i),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'ON THESE DAYS',
                  style: AppText.sans(
                    size: 10,
                    weight: FontWeight.w800,
                    letterSpacing: AppText.em(0.08, 10),
                    color: colors.textDim,
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (var i = 0; i < _dayLetters.length; i++)
                    _DayCircle(
                      letter: _dayLetters[i],
                      active: _activeDays.contains(i),
                      onTap: () => setState(() {
                        if (!_activeDays.add(i)) _activeDays.remove(i);
                      }),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Material(
                  color: colors.ink,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    onTap: () => Navigator.of(context).pop(_rule),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      alignment: Alignment.center,
                      child: Text(
                        'Save · $_ctaLabel',
                        style: AppText.sans(
                          size: 13,
                          weight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
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

/// "Repeat every" stepper row inside the custom dialog.
class _IntervalRow extends StatelessWidget {
  const _IntervalRow({
    required this.value,
    required this.onIncrement,
    this.onDecrement,
  });

  final int value;
  final VoidCallback onIncrement;
  final VoidCallback? onDecrement;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Repeat every',
          style: AppText.sans(size: 12.5, weight: FontWeight.w700, color: colors.text),
        ),
        Row(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onDecrement,
              child: Icon(
                Icons.remove_circle_outline,
                size: 18,
                color: colors.textMed,
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 14,
              child: Text(
                '$value',
                textAlign: TextAlign.center,
                style: AppText.sans(
                  size: 18,
                  weight: FontWeight.w800,
                  color: colors.text,
                ),
              ),
            ),
            const SizedBox(width: 10),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onIncrement,
              child: Icon(Icons.add_circle, size: 18, color: colors.accent),
            ),
          ],
        ),
      ],
    );
  }
}

/// Days / Weeks / Months segmented control.
class _UnitSegmented extends StatelessWidget {
  const _UnitSegmented({
    required this.units,
    required this.selected,
    required this.onSelect,
  });

  final List<String> units;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        for (var i = 0; i < units.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onSelect(i),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: i == selected ? colors.accent : colors.bg,
                  borderRadius: BorderRadius.circular(AppRadius.tile),
                ),
                child: Text(
                  units[i],
                  style: AppText.sans(
                    size: 11.5,
                    weight: i == selected ? FontWeight.w800 : FontWeight.w700,
                    color: i == selected ? Colors.white : colors.textMed,
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// A 25×25 weekday toggle circle.
class _DayCircle extends StatelessWidget {
  const _DayCircle({
    required this.letter,
    required this.active,
    required this.onTap,
  });

  final String letter;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 25,
        height: 25,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? colors.accent : colors.bg,
        ),
        child: Text(
          letter,
          style: AppText.sans(
            size: 11,
            weight: FontWeight.w800,
            color: active ? Colors.white : colors.textMed,
          ),
        ),
      ),
    );
  }
}

/// Shared 26×26 close circle used by both the sheet and the dialog.
class _CloseCircle extends StatelessWidget {
  const _CloseCircle({required this.onTap});
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
