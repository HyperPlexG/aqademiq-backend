import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_text.dart';
import 'app_toggle.dart';

/// A label above a [SetGroup] (prototype `GroupLabel`).
class GroupLabel extends StatelessWidget {
  const GroupLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 3, bottom: 8),
      child: Text(
        text,
        style: AppText.sans(
          size: 12.5,
          weight: FontWeight.w700,
          color: context.colors.textMed,
        ),
      ),
    );
  }
}

/// Rounded surface container that clips a stack of [SettingsRow]s
/// (prototype `SetGroup`, radius 18).
class SetGroup extends StatelessWidget {
  const SetGroup({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.group),
        boxShadow: colors.cardShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }
}

/// Inset value pill on the right of a row (prototype `TimePill`).
class TimePill extends StatelessWidget {
  const TimePill(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 12),
      decoration: BoxDecoration(
        color: colors.hilite,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: AppText.sans(size: 12, weight: FontWeight.w700, color: colors.text),
      ),
    );
  }
}

/// A settings list row (prototype `SetRow`): optional avatar/icon, label (+sub),
/// optional right-aligned value, then pill / toggle / chevron. When a [toggle]
/// is present and there is no value, the label wraps to 2 lines instead of
/// overlapping the toggle (README §4).
class SettingsRow extends StatelessWidget {
  const SettingsRow({
    super.key,
    required this.label,
    this.icon,
    this.avatar,
    this.sub,
    this.value,
    this.pill,
    this.toggle,
    this.onToggle,
    this.showChevron = false,
    this.onTap,
    this.danger = false,
    this.last = false,
  });

  final String label;
  final IconData? icon;
  final Widget? avatar;
  final String? sub;
  final String? value;
  final String? pill;
  final bool? toggle;
  final ValueChanged<bool>? onToggle;
  final bool showChevron;
  final VoidCallback? onTap;
  final bool danger;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final labelColor = danger ? colors.danger : colors.text;
    final hasValue = value != null;

    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          border: last
              ? null
              : Border(bottom: BorderSide(color: colors.border)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 15),
        child: Row(
          children: [
            if (avatar != null) ...[avatar!, const SizedBox(width: 11)],
            if (icon != null) ...[
              Icon(icon, size: 20, color: danger ? colors.danger : colors.text),
              const SizedBox(width: 11),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    maxLines: hasValue ? 1 : 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(
                      size: 13.5,
                      height: 1.3,
                      color: labelColor,
                    ),
                  ),
                  if (sub != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        sub!,
                        style: AppText.sans(
                          size: 11,
                          height: 1.4,
                          color: colors.textMed,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (hasValue)
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.only(left: 10),
                  child: Text(
                    value!,
                    textAlign: TextAlign.right,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(
                      size: 12.5,
                      weight: FontWeight.w500,
                      color: colors.textMed,
                    ),
                  ),
                ),
              ),
            if (pill != null) ...[const SizedBox(width: 10), TimePill(pill!)],
            if (toggle != null) ...[
              const SizedBox(width: 10),
              AppToggle(value: toggle!, onChanged: onToggle),
            ],
            if (showChevron) ...[
              const SizedBox(width: 6),
              Icon(Icons.chevron_right, size: 19, color: colors.textDim),
            ],
          ],
        ),
      ),
    );
  }
}
