import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../data/models/enums.dart';
import '../../../../data/models/task.dart';
import '../../providers/plan_ui_providers.dart';
import '../pickers/repeat_picker.dart';
import '../pickers/time_picker.dart';

/// Outcome of the Quick-add sheet: the [TaskDraft] entered, and whether the
/// user asked to continue to the full Add-task form (`details: true` via "More")
/// or quick-create now (`details: false` via send).
typedef QuickAddResult = ({TaskDraft draft, bool details});

/// Presents the lightweight "Quick add" bar (`plan-quickadd`). Returns the
/// [QuickAddResult] on send/More, or `null` if dismissed. Keyboard-aware.
Future<QuickAddResult?> showQuickAddSheet(BuildContext context) {
  return showModalBottomSheet<QuickAddResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x47140F1C),
    builder: (_) => const _QuickAddSheet(),
  );
}

class _QuickAddSheet extends StatefulWidget {
  const _QuickAddSheet();

  @override
  State<_QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<_QuickAddSheet> {
  final _controller = TextEditingController();
  DayPart? _dayPart;
  RepeatRule? _repeat;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  static String _dayPartLabel(DayPart p) => switch (p) {
        DayPart.morning => 'Morning',
        DayPart.afternoon => 'Afternoon',
        DayPart.evening => 'Evening',
        DayPart.anytime => 'Anytime',
      };

  void _submit({required bool details}) {
    Navigator.of(context).pop((
      draft: TaskDraft(title: _controller.text.trim(), dayPart: _dayPart, repeat: _repeat),
      details: details,
    ));
  }

  Future<void> _pickTime() async {
    final v = await showTimeOfDayPicker(context);
    if (v != null) setState(() => _dayPart = DayPartX.fromWire(v.toLowerCase()));
  }

  Future<void> _pickRepeat() async {
    final v = await showRepeatPicker(context);
    if (v != null) setState(() => _repeat = v);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.sheetTop)),
          boxShadow: colors.sheetShadow,
        ),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0DDD7),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              _InputPill(controller: _controller, colors: colors),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _ContextChip(icon: Icons.schedule, label: _dayPart == null ? 'Anytime' : _dayPartLabel(_dayPart!), colors: colors, onTap: _pickTime),
                          const SizedBox(width: 6),
                          _ContextChip(icon: Icons.repeat, label: repeatRuleLabel(_repeat), colors: colors, onTap: _pickRepeat),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _MorePill(colors: colors, onTap: () => _submit(details: true)),
                  const SizedBox(width: 8),
                  _SendButton(colors: colors, onTap: () => _submit(details: false)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The "Just one thing to do…" input pill with a trailing mic icon.
class _InputPill extends StatelessWidget {
  const _InputPill({required this.controller, required this.colors});

  final TextEditingController controller;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(AppRadius.rowInput),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              autofocus: true,
              cursorColor: colors.accent,
              style: AppText.sans(size: 14, color: colors.text),
              decoration: InputDecoration(
                isDense: true,
                isCollapsed: true,
                border: InputBorder.none,
                hintText: 'Just one thing to do…',
                hintStyle: AppText.sans(size: 14, color: colors.textDim),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Voice capture is not implemented yet (needs a speech-to-text package
          // + native mic permissions). Render the mic dimmed so it doesn't read
          // as an active control, and surface a "coming soon" note on tap.
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Voice capture is coming soon.')),
            ),
            child: Icon(Icons.mic_none, size: 19, color: colors.textDim),
          ),
        ],
      ),
    );
  }
}

/// A small `bg`-filled pill carrying a leading icon and a label (e.g. "Anytime").
class _ContextChip extends StatelessWidget {
  const _ContextChip({
    required this.icon,
    required this.label,
    required this.colors,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final AppColors colors;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: colors.bg,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: colors.textMed),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppText.sans(size: 10.5, weight: FontWeight.w700, color: colors.textMed),
            ),
          ],
        ),
      ),
    );
  }
}

/// The "More" affordance — opens the full Add-task form.
class _MorePill extends StatelessWidget {
  const _MorePill({required this.colors, required this.onTap});

  final AppColors colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: colors.bg,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Icon(Icons.more_horiz, size: 15, color: colors.textMed),
      ),
    );
  }
}

/// 38px ink circle send button — quick-creates the task.
class _SendButton extends StatelessWidget {
  const _SendButton({required this.colors, required this.onTap});

  final AppColors colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: colors.ink, shape: BoxShape.circle),
        child: const Icon(Icons.arrow_upward, size: 18, color: Colors.white),
      ),
    );
  }
}
