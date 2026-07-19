import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../data/models/subject.dart';
import '../../../../data/repositories/subjects_repository.dart';
import '../../../../shared/widgets/app_bottom_sheet.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/primary_button.dart';

/// subj-add-sem — "Add semester" bottom sheet (routed through [showAppBottomSheet]
/// so it lifts above the keyboard, fixing SUBJ-1).
///
/// Body: a name field, a 3-segment term picker (Spring / Summer / Fall), and a
/// read-only Starts/Ends dates row. The `Semester` model only carries id + name,
/// so the typed name is the source of truth (SUBJ-2). On create the new semester
/// is persisted and selected. Returns the created [Semester], or `null` on
/// dismiss.
Future<Semester?> showAddSemesterSheet(BuildContext context) {
  return showAppBottomSheet<Semester>(
    context,
    title: 'Add semester',
    scrim: AppScrim.picker,
    child: const _AddSemesterBody(),
  );
}

class _AddSemesterBody extends ConsumerStatefulWidget {
  const _AddSemesterBody();

  @override
  ConsumerState<_AddSemesterBody> createState() => _AddSemesterBodyState();
}

class _AddSemesterBodyState extends ConsumerState<_AddSemesterBody> {
  static const List<String> _terms = ['Spring', 'Summer', 'Fall'];
  static const List<String> _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  final TextEditingController _nameController = TextEditingController();

  // "Fall" is the active term in the spec (index 2).
  int _termIdx = 2;
  late DateTime _startDate;
  late DateTime _endDate;
  // Once the user hand-edits the name we stop overwriting it from the term.
  bool _nameEdited = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _applyTermDefaults(_termIdx, updateName: true);
    _nameController.addListener(() => _nameEdited = true);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  /// Term → sensible default name + start/end range for the current year.
  void _applyTermDefaults(int idx, {required bool updateName}) {
    final year = DateTime.now().year;
    switch (idx) {
      case 0: // Spring
        _startDate = DateTime(year, 1, 15);
        _endDate = DateTime(year, 5, 10);
      case 1: // Summer
        _startDate = DateTime(year, 6);
        _endDate = DateTime(year, 8, 20);
      default: // Fall
        _startDate = DateTime(year, 9);
        _endDate = DateTime(year, 12, 20);
    }
    if (updateName) {
      final label = "${_terms[idx]} '${year % 100}";
      _nameController.value = TextEditingValue(text: label);
      _nameEdited = false;
    }
  }

  void _onTermSelected(int idx) {
    setState(() {
      _termIdx = idx;
      _applyTermDefaults(idx, updateName: !_nameEdited);
    });
  }

  String _fmt(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';

  Future<void> _pickDate({required bool isStart}) async {
    final initial = isStart ? _startDate : _endDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(initial.year - 5),
      lastDate: DateTime(initial.year + 5),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
        if (_endDate.isBefore(_startDate)) _endDate = _startDate;
      } else {
        _endDate = picked;
        if (_endDate.isBefore(_startDate)) _startDate = _endDate;
      }
    });
  }

  Future<void> _create() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Name your semester first.')),
      );
      return;
    }

    // Dedupe: if a semester with this name already exists, select it instead of
    // creating a look-alike duplicate.
    final existing = ref.read(semestersProvider).value ?? const <Semester>[];
    final lower = name.toLowerCase();
    Semester? dupe;
    for (final s in existing) {
      if (s.name.trim().toLowerCase() == lower) {
        dupe = s;
        break;
      }
    }
    if (dupe != null) {
      ref.read(selectedSemesterProvider.notifier).select(dupe.id);
      messenger.showSnackBar(
        SnackBar(content: Text('You already have a "${dupe.name}" semester.')),
      );
      navigator.pop(dupe);
      return;
    }

    setState(() => _saving = true);
    try {
      final saved = await ref.read(semestersProvider.notifier).save(
            Semester(id: '', name: name),
            start: _startDate,
            end: _endDate,
          );
      ref.read(selectedSemesterProvider.notifier).select(saved.id);
      if (!mounted) return;
      navigator.pop(saved);
    } on Exception {
      if (!mounted) return;
      setState(() => _saving = false);
      messenger.showSnackBar(
        const SnackBar(content: Text("Couldn't create semester. Try again.")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel('Name'),
        AppTextField(controller: _nameController),
        const SizedBox(height: 12),
        const FieldLabel('Term'),
        _TermSelector(
          terms: _terms,
          selectedIndex: _termIdx,
          onSelect: _onTermSelected,
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _DateColumn(
                label: 'Starts',
                value: _fmt(_startDate),
                onTap: () => _pickDate(isStart: true),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _DateColumn(
                label: 'Ends',
                value: _fmt(_endDate),
                onTap: () => _pickDate(isStart: false),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        PrimaryButton(
          label: 'Create semester',
          onPressed: _saving ? null : _create,
        ),
      ],
    );
  }
}

/// The 3-segment term picker (Spring / Summer / Fall). The active segment uses
/// `accentSoft` fill + `accent` text + a 1.5px accent border; inactive segments
/// use a `bg` fill, `textMed` text, and a transparent border.
class _TermSelector extends StatelessWidget {
  const _TermSelector({
    required this.terms,
    required this.selectedIndex,
    required this.onSelect,
  });

  final List<String> terms;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        for (var i = 0; i < terms.length; i++) ...[
          if (i > 0) const SizedBox(width: 7),
          Expanded(
            child: GestureDetector(
              onTap: () => onSelect(i),
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: i == selectedIndex ? colors.accentSoft : colors.bg,
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(
                    color: i == selectedIndex ? colors.accent : Colors.transparent,
                    width: 1.5,
                  ),
                ),
                child: Text(
                  terms[i],
                  style: AppText.sans(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: i == selectedIndex ? colors.accent : colors.textMed,
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

/// A labelled read-only date box (one column of the Starts/Ends row): a
/// [FieldLabel] over a `bg`-filled box (radius 12, 11×14 padding) showing the
/// date at 12.5/w700.
class _DateColumn extends StatelessWidget {
  const _DateColumn({
    required this.label,
    required this.value,
    this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label),
        GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: colors.bg,
              borderRadius: BorderRadius.circular(AppRadius.cellSmall),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value,
                    style: AppText.sans(
                      size: 12.5,
                      weight: FontWeight.w700,
                      color: colors.text,
                    ),
                  ),
                ),
                Icon(Icons.calendar_today, size: 13, color: colors.textMed),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
