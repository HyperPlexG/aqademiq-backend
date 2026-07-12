import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/hex_color.dart';
import '../../../../data/models/subject.dart';
import '../../../../data/repositories/subjects_repository.dart';
import '../../../../shared/mascot/ada_mascot.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/mood_blob.dart';

/// The shared "New subject" form sheet (prototype `AddSubjectBody`). A
/// bottom-anchored sheet reused by onboarding (`ob2-add`) and §03 (`subj-add`):
/// a white header card (close / title / save), a name field, then a body with
/// code + credits, professor, target-grade format + letter picker, colour
/// swatches, and a per-subject mood row. Holds its own local selection state.
///
/// When [existing] is supplied the form pre-fills for an edit; saving reuses the
/// existing id. The CTA persists via [SubjectsController] and pops the resulting
/// [Subject].
class SubjectFormSheet extends ConsumerStatefulWidget {
  const SubjectFormSheet({super.key, this.existing});

  /// The subject being edited, or `null` to create a new one.
  final Subject? existing;

  @override
  ConsumerState<SubjectFormSheet> createState() => _SubjectFormSheetState();
}

class _SubjectFormSheetState extends ConsumerState<SubjectFormSheet> {
  static const List<String> _formats = ['Letter', 'GPA', '%'];
  static const List<String> _letterGrades = ['A+', 'A', 'A−', 'B+', 'B'];
  static const List<Color> _swatches = [
    Color(0xFF6B5CF0),
    Color(0xFF5CBBFF),
    Color(0xFF2A9D6B),
    Color(0xFFE8A430),
    Color(0xFFE85476),
    Color(0xFFC0497B),
  ];

  late final TextEditingController _nameController;
  late final TextEditingController _codeController;
  late final TextEditingController _professorController;

  int _formatIdx = 0;
  int _gradeIdx = 1;
  int _colorIdx = 0;
  int _moodIdx = 1;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameController = TextEditingController(text: existing?.name ?? '');
    _codeController = TextEditingController(text: existing?.code ?? '');
    _professorController =
        TextEditingController(text: existing?.professor ?? '');
    if (existing != null) {
      final gradeIdx = _letterGrades.indexOf(existing.targetGrade ?? '');
      if (gradeIdx >= 0) _gradeIdx = gradeIdx;
      final existingHex = hexFromColor(hexColor(existing.color));
      final colorIdx =
          _swatches.indexWhere((c) => hexFromColor(c) == existingHex);
      if (colorIdx >= 0) _colorIdx = colorIdx;
      _moodIdx = (existing.mood ?? 1).clamp(0, 4);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    _professorController.dispose();
    super.dispose();
  }

  bool get _isEdit => widget.existing != null;

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Give your subject a name first.')),
      );
      return;
    }
    setState(() => _saving = true);

    final existing = widget.existing;
    final semesterId = existing?.semesterId ??
        ref.read(selectedSemesterProvider) ??
        (ref.read(semestersProvider).value?.firstOrNull?.id ?? '');
    final code = _codeController.text.trim();
    final professor = _professorController.text.trim();

    final subject = (existing ??
            const Subject(id: '', name: '', color: '', semesterId: ''))
        .copyWith(
      name: name,
      color: hexFromColor(_swatches[_colorIdx]),
      semesterId: semesterId,
      code: code.isEmpty ? null : code,
      targetGrade: _formatIdx == 0 ? _letterGrades[_gradeIdx] : null,
      professor: professor.isEmpty ? null : professor,
      mood: _moodIdx,
    );

    try {
      final saved = await ref.read(subjectsProvider.notifier).save(subject);
      if (!mounted) return;
      Navigator.of(context).pop(saved);
    } on Exception {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't save subject. Try again.")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: Container(
        decoration: BoxDecoration(
          color: colors.bg,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.sheetTop),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeaderCard(colors),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildCodeCreditsRow(colors),
                      const SizedBox(height: 9),
                      const FieldLabel('Professor'),
                      _bodyTextField(
                        colors,
                        controller: _professorController,
                        hint: 'Prof. S. Rao',
                      ),
                      const SizedBox(height: 9),
                      const FieldLabel('Target grade'),
                      _buildFormatSelector(colors),
                      const SizedBox(height: 7),
                      if (_formatIdx == 0)
                        _buildLetterGradeRow(colors)
                      else
                        _buildValueInput(colors),
                      const SizedBox(height: 9),
                      const FieldLabel('Colour'),
                      _buildColorRow(colors),
                      const SizedBox(height: 9),
                      const FieldLabel('How do you feel about it?'),
                      _buildMoodRow(),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // --- Header card (close / title / save) + name field ---------------------

  Widget _buildHeaderCard(AppColors colors) {
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 4, 10, 8),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 13),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(22),
        boxShadow: const [
          BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: context.pop,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.bg,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    '✕',
                    style: AppText.sans(
                      size: 13,
                      weight: FontWeight.w700,
                      color: colors.textMed,
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  _isEdit ? 'Edit subject' : 'New subject',
                  textAlign: TextAlign.center,
                  style: AppText.sans(size: 16, weight: FontWeight.w800),
                ),
              ),
              GestureDetector(
                onTap: _saving ? null : _save,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: colors.ink,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    'Save',
                    style: AppText.sans(
                      size: 12,
                      weight: FontWeight.w700,
                      color: colors.surface,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Container(
            decoration: BoxDecoration(
              color: colors.bg,
              borderRadius: BorderRadius.circular(AppRadius.cellSmall),
            ),
            child: TextField(
              controller: _nameController,
              autofocus: !_isEdit,
              cursorColor: colors.accent,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _save(),
              style: AppText.sans(
                size: 15,
                weight: FontWeight.w700,
                color: colors.text,
              ),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                hintText: 'Compiler Construction',
                hintStyle: AppText.sans(
                  size: 15,
                  weight: FontWeight.w700,
                  color: colors.textDim,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Body fields ----------------------------------------------------------

  /// A white body field shell: surface bg, radius 12, card shadow.
  Widget _bodyField(AppColors colors, {required Widget child}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.cellSmall),
        boxShadow: colors.cardShadow,
      ),
      child: child,
    );
  }

  /// An editable body field matching [_bodyField]'s look.
  Widget _bodyTextField(
    AppColors colors, {
    required TextEditingController controller,
    required String hint,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.cellSmall),
        boxShadow: colors.cardShadow,
      ),
      child: TextField(
        controller: controller,
        cursorColor: colors.accent,
        style: AppText.sans(
          size: 12.5,
          weight: FontWeight.w700,
          color: colors.text,
        ),
        decoration: InputDecoration(
          isDense: true,
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          hintText: hint,
          hintStyle: AppText.sans(
            size: 12.5,
            weight: FontWeight.w700,
            color: colors.textDim,
          ),
        ),
      ),
    );
  }

  Widget _buildCodeCreditsRow(AppColors colors) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const FieldLabel('Code'),
              _bodyTextField(
                colors,
                controller: _codeController,
                hint: 'CC 401',
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildCreditsLabel(colors),
              _bodyField(
                colors,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Add',
                      style: AppText.sans(
                        size: 12.5,
                        weight: FontWeight.w700,
                        color: colors.textDim,
                      ),
                    ),
                    Text(
                      '＋',
                      style: AppText.sans(
                        size: 12.5,
                        weight: FontWeight.w700,
                        color: colors.text,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// "CREDITS · OPTIONAL" — the "· optional" suffix is dimmed.
  Widget _buildCreditsLabel(AppColors colors) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: 'CREDITS',
              style: AppText.sans(
                size: 9,
                weight: FontWeight.w800,
                letterSpacing: AppText.em(0.12, 9),
                color: colors.textDim,
              ),
            ),
            TextSpan(
              text: ' · OPTIONAL',
              style: AppText.sans(
                size: 9,
                letterSpacing: AppText.em(0.12, 9),
                color: colors.textDim,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Target grade: format selector + letter grades ------------------------

  Widget _buildFormatSelector(AppColors colors) {
    return Row(
      children: [
        for (var i = 0; i < _formats.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _formatIdx = i),
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 6),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: i == _formatIdx ? colors.ink : colors.surface,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: colors.cardShadow,
                ),
                child: Text(
                  _formats[i],
                  style: AppText.sans(
                    size: 11,
                    weight: FontWeight.w800,
                    color: i == _formatIdx ? colors.surface : colors.textMed,
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildLetterGradeRow(AppColors colors) {
    return Row(
      children: [
        for (var i = 0; i < _letterGrades.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _gradeIdx = i),
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 7),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: i == _gradeIdx ? colors.accentSoft : colors.surface,
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(
                    color: i == _gradeIdx ? colors.accent : colors.border,
                    width: 1.5,
                  ),
                ),
                child: Text(
                  _letterGrades[i],
                  style: AppText.sans(
                    size: 12,
                    weight: FontWeight.w800,
                    color: i == _gradeIdx ? colors.accent : colors.text,
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  /// GPA / % target value input (FRAMES `subj-add-gpa` / `subj-add-pct`).
  Widget _buildValueInput(AppColors colors) {
    final isGpa = _formatIdx == 1;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: colors.cardShadow,
        border: Border.all(color: colors.accent, width: 1.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(isGpa ? '3.7' : '85', style: AppText.sans(size: 19, weight: FontWeight.w800, letterSpacing: -0.5, color: colors.text)),
          if (!isGpa) Text('%', style: AppText.sans(size: 14, color: colors.textMed)),
          const Spacer(),
          Text(isGpa ? 'out of 4.0' : 'target %', style: AppText.sans(size: 12, weight: FontWeight.w700, color: colors.textDim)),
        ],
      ),
    );
  }

  // --- Colour swatches ------------------------------------------------------

  Widget _buildColorRow(AppColors colors) {
    return Row(
      children: [
        for (var i = 0; i < _swatches.length; i++) ...[
          if (i > 0) const SizedBox(width: 9),
          GestureDetector(
            onTap: () => setState(() => _colorIdx = i),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: _swatches[i],
                shape: BoxShape.circle,
                border: Border.all(
                  color: i == _colorIdx ? colors.text : Colors.transparent,
                  width: 2.5,
                ),
                boxShadow: i == _colorIdx
                    ? [
                        BoxShadow(
                          color: colors.surface,
                          spreadRadius: 2,
                        ),
                      ]
                    : null,
              ),
            ),
          ),
        ],
      ],
    );
  }

  // --- Mood row -------------------------------------------------------------

  Widget _buildMoodRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (var i = 0; i < 5; i++) _buildMoodCell(i),
        ],
      ),
    );
  }

  Widget _buildMoodCell(int i) {
    final selected = i == _moodIdx;
    final tone = kCubeTones[i];
    return GestureDetector(
      onTap: () => setState(() => _moodIdx = i),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(2.5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected ? tone.border.withAlpha(0x20) : Colors.transparent,
          border: Border.all(
            color: selected ? tone.border : Colors.transparent,
            width: 2,
          ),
        ),
        child: MoodBlob(idx: i, size: selected ? 32 : 29),
      ),
    );
  }
}
