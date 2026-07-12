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

  final TextEditingController _nameController =
      TextEditingController(text: "Fall '26");

  // "Fall" is the active term in the spec (index 2).
  int _termIdx = 2;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name your semester first.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final saved = await ref
          .read(semestersProvider.notifier)
          .save(Semester(id: '', name: name));
      ref.read(selectedSemesterProvider.notifier).select(saved.id);
      if (!mounted) return;
      Navigator.of(context).pop(saved);
    } on Exception {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
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
          onSelect: (i) => setState(() => _termIdx = i),
        ),
        const SizedBox(height: 12),
        const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _DateColumn(label: 'Starts', value: '1 Sep 2026'),
            ),
            SizedBox(width: 10),
            Expanded(
              child: _DateColumn(label: 'Ends', value: '20 Dec 2026'),
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
  const _DateColumn({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: colors.bg,
            borderRadius: BorderRadius.circular(AppRadius.cellSmall),
          ),
          child: Text(
            value,
            style: AppText.sans(
              size: 12.5,
              weight: FontWeight.w700,
              color: colors.text,
            ),
          ),
        ),
      ],
    );
  }
}
