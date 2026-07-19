import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../core/utils/hex_color.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/tag.dart';
import '../../../data/models/task.dart';
import '../../../data/repositories/tags_repository.dart';
import '../../../data/repositories/tasks_repository.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_toggle.dart';
import '../../../shared/widgets/dismiss_keyboard.dart';
import '../../../shared/widgets/tag_chip.dart';
import '../../settings/presentation/sheets/add_tag_sheet.dart';
import '../providers/plan_providers.dart';
import '../providers/plan_ui_providers.dart';
import 'pickers/date_picker.dart';
import 'pickers/duration_picker.dart';
import 'pickers/repeat_picker.dart';
import 'pickers/time_picker.dart';

/// FRAMES `plan-addtask` — the full add-task form. Each detail row opens the
/// matching picker (time / date / duration / repeat) and reflects the result.
class AddTaskScreen extends ConsumerStatefulWidget {
  const AddTaskScreen({super.key});

  @override
  ConsumerState<AddTaskScreen> createState() => _AddTaskScreenState();
}

class _AddTaskScreenState extends ConsumerState<AddTaskScreen> {
  final _title = TextEditingController();
  String _tag = 'exam';
  String _subject = 'cc401';
  String _timeOfDay = 'Anytime';
  String _date = '18 May 2026';
  int _durationMin = 30;
  RepeatRule? _repeat;
  bool _adaBreakdown = true;

  static const _subjects = [
    ('cc401', 'CC 401', Color(0xFF6B5CF0)),
    ('nlp302', 'NLP 302', Color(0xFF5CBBFF)),
    ('net305', 'NET 305', Color(0xFF2A9D6B)),
    ('dbs310', 'DBS 310', Color(0xFFE8A430)),
  ];

  @override
  void initState() {
    super.initState();
    // Consume a Quick-add draft so the typed title / time / repeat carry over.
    // Read the value here (no mutation), then clear the one-shot draft *after*
    // this build lifecycle — mutating a provider inside initState throws
    // Riverpod's "modify a provider while the widget tree was building" error
    // (which was crashing this screen when opened from Quick-add "More" or the
    // list-view group "+").
    final draft = ref.read(taskDraftProvider);
    if (draft != null) {
      _title.text = draft.title;
      if (draft.dayPart != null) _timeOfDay = _dayPartLabel(draft.dayPart!);
      _repeat = draft.repeat;
    }
    unawaited(Future(() {
      if (mounted) ref.read(taskDraftProvider.notifier).take();
    }));
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  static String _dayPartLabel(DayPart p) => switch (p) {
        DayPart.morning => 'Morning',
        DayPart.afternoon => 'Afternoon',
        DayPart.evening => 'Evening',
        DayPart.anytime => 'Anytime',
      };

  Future<void> _save() async {
    final date = ref.read(selectedDateProvider);
    final repeat =
        (_repeat != null && _repeat!.frequency != RepeatFrequency.none) ? _repeat : null;
    final task = Task(
      id: '',
      title: _title.text.trim().isEmpty ? 'New task' : _title.text.trim(),
      tagId: _tag,
      date: date,
      dayPart: DayPartX.fromWire(_timeOfDay.toLowerCase()),
      durationMin: _durationMin,
      repeat: repeat,
    );
    await ref.read(tasksRepositoryProvider).create(task);
    ref.invalidate(dayTasksProvider);
    if (mounted) context.pop();
  }

  Future<void> _addTag() async {
    final draft = await showAddTagSheet(context);
    if (draft == null) return;
    await ref.read(tagsProvider.notifier).add(label: draft.label, colorHex: hexFromColor(draft.color));
    final tags = ref.read(tagsProvider).value ?? const <Tag>[];
    Tag? created;
    for (final t in tags) {
      if (t.label == draft.label) created = t;
    }
    if (created != null) setState(() => _tag = created!.id);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tags = ref.watch(tagsProvider).value ?? const <Tag>[];
    return Scaffold(
      backgroundColor: colors.bg,
      body: DismissKeyboard(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(10, 4, 10, 24),
            children: [
              _HeaderCard(controller: _title, onClose: () => context.pop(), onSave: _save),
              const SizedBox(height: 6),
              _Section(
                label: "Tag · what's this for?",
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final t in tags)
                      TagChip(label: t.label, color: hexColor(t.color), active: _tag == t.id, onTap: () => setState(() => _tag = t.id)),
                    TagChip(label: '+ New', color: colors.accent, dashed: true, onTap: _addTag),
                  ],
                ),
              ),
              _Section(
                label: 'Subject · link it (optional)',
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final s in _subjects)
                      TagChip(label: s.$2, color: s.$3, active: _subject == s.$1, onTap: () => setState(() => _subject = s.$1)),
                    TagChip(label: 'None', active: _subject.isEmpty, onTap: () => setState(() => _subject = '')),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                child: Column(
                  children: [
                    _DetailRow(icon: Icons.schedule, label: 'Time of day', value: _timeOfDay, onTap: _pickTime),
                    _DetailRow(icon: Icons.event, label: 'Date', value: _date, onTap: _pickDate),
                    _DetailRow(icon: Icons.hourglass_empty, label: 'Duration', value: '$_durationMin min', onTap: _pickDuration),
                    _DetailRow(icon: Icons.repeat, label: 'Repeat', value: repeatRuleLabel(_repeat), onTap: _pickRepeat, last: true),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: AppCard(
                child: Row(
                  children: [
                    const AdaMascot(size: 28, expr: AdaExpr.focused),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('Let Ada break this down', style: AppText.sans(size: 12.5, weight: FontWeight.w700, color: colors.text)),
                    ),
                    AppToggle(value: _adaBreakdown, onChanged: (v) => setState(() => _adaBreakdown = v)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: AppCard(
                child: Row(
                  children: [
                    Icon(Icons.notes, size: 16, color: colors.textMed),
                    const SizedBox(width: 8),
                    Text('Add a note…', style: AppText.sans(size: 12.5, color: colors.textDim)),
                  ],
                ),
              ),
            ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickTime() async {
    final v = await showTimeOfDayPicker(context);
    if (v != null) setState(() => _timeOfDay = v);
  }

  Future<void> _pickDate() async {
    final v = await showTaskDatePicker(context);
    if (v != null) setState(() => _date = v);
  }

  Future<void> _pickDuration() async {
    final v = await showDurationPicker(context);
    if (v != null) setState(() => _durationMin = v);
  }

  Future<void> _pickRepeat() async {
    final v = await showRepeatPicker(context);
    if (v != null) setState(() => _repeat = v);
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.controller, required this.onClose, required this.onSave});
  final TextEditingController controller;
  final VoidCallback onClose;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, 2))],
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 13),
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: onClose,
                child: Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
                  child: Text('✕', style: TextStyle(fontSize: 13, color: colors.textMed, height: 1)),
                ),
              ),
              Expanded(
                child: Text('Add task', textAlign: TextAlign.center, style: AppText.sans(size: 16, weight: FontWeight.w800, color: colors.text)),
              ),
              GestureDetector(
                onTap: onSave,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(AppRadius.pill)),
                  child: Text('Save', style: AppText.sans(size: 12, weight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: TextField(
              controller: controller,
              style: AppText.sans(size: 14, color: colors.text),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: 'What do you need to do?',
                hintStyle: AppText.sans(size: 14, color: colors.textDim),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 7),
            child: Text(
              label.toUpperCase(),
              style: AppText.sans(size: 9, weight: FontWeight.w800, letterSpacing: AppText.em(0.12, 9), color: colors.textDim),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label, required this.value, required this.onTap, this.last = false});
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          border: last ? null : Border(bottom: BorderSide(color: colors.border)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 16, color: colors.textMed),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: AppText.sans(size: 12.5, color: colors.text))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(AppRadius.pill)),
              child: Text(value, style: AppText.sans(size: 11, color: colors.textMed)),
            ),
          ],
        ),
      ),
    );
  }
}
