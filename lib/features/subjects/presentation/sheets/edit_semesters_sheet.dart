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
import 'add_semester_sheet.dart';

/// The pink delete glyph color (`#e85476`) used for the trailing remove icon.
const _deleteColor = Color(0xFFE85476);

/// Presents the "Edit semesters" sheet (`subj-edit-sem`) — a bottom sheet
/// listing each term with rename and remove affordances plus a dashed
/// "Add semester" button. Rename/delete operate on the live store (SUBJ-3).
/// Returns `null` on dismiss.
Future<void> showEditSemestersSheet(BuildContext context) {
  return showAppBottomSheet<void>(
    context,
    title: 'Edit semesters',
    subtitle: 'Rename or remove a term',
    scrim: AppScrim.picker,
    child: const _EditSemestersBody(),
  );
}

class _EditSemestersBody extends ConsumerWidget {
  const _EditSemestersBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final semesters = ref.watch(semestersProvider).value ?? const <Semester>[];
    final subjects = ref.watch(subjectsProvider).value ?? const <Subject>[];
    final selectedId = ref.watch(selectedSemesterProvider) ??
        (semesters.isNotEmpty ? semesters.first.id : null);

    int countFor(String id) => subjects.where((s) => s.semesterId == id).length;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < semesters.length; i++)
          Padding(
            padding: EdgeInsets.only(
              bottom: i == semesters.length - 1 ? 0 : 8,
            ),
            child: _SemesterRow(
              semester: semesters[i],
              count: countFor(semesters[i].id),
              isCurrent: semesters[i].id == selectedId,
              canDelete: semesters.length > 1,
              colors: colors,
              onRename: () => _rename(context, ref, semesters[i]),
              onDelete: () => _delete(context, ref, semesters[i].id),
            ),
          ),
        const SizedBox(height: 8),
        _AddSemesterButton(
          colors: colors,
          onTap: () => showAddSemesterSheet(context),
        ),
      ],
    );
  }

  Future<void> _rename(
    BuildContext context,
    WidgetRef ref,
    Semester semester,
  ) async {
    final newName = await showAppBottomSheet<String>(
      context,
      title: 'Rename semester',
      scrim: AppScrim.picker,
      child: _RenameBody(initial: semester.name),
    );
    final trimmed = newName?.trim();
    if (trimmed == null || trimmed.isEmpty || trimmed == semester.name) return;
    await ref
        .read(semestersProvider.notifier)
        .save(semester.copyWith(name: trimmed));
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, String id) async {
    await ref.read(semestersProvider.notifier).remove(id);
    final selected = ref.read(selectedSemesterProvider);
    if (selected == id) {
      final remaining = ref.read(semestersProvider).value ?? const <Semester>[];
      if (remaining.isNotEmpty) {
        ref.read(selectedSemesterProvider.notifier).select(remaining.first.id);
      }
    }
  }
}

class _RenameBody extends StatefulWidget {
  const _RenameBody({required this.initial});

  final String initial;

  @override
  State<_RenameBody> createState() => _RenameBodyState();
}

class _RenameBodyState extends State<_RenameBody> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel('Name'),
        AppTextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (v) => Navigator.of(context).pop(v),
        ),
        const SizedBox(height: 16),
        PrimaryButton(
          label: 'Save',
          onPressed: () => Navigator.of(context).pop(_controller.text),
        ),
      ],
    );
  }
}

class _SemesterRow extends StatelessWidget {
  const _SemesterRow({
    required this.semester,
    required this.count,
    required this.isCurrent,
    required this.canDelete,
    required this.colors,
    required this.onRename,
    required this.onDelete,
  });

  final Semester semester;
  final int count;
  final bool isCurrent;
  final bool canDelete;
  final AppColors colors;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(AppRadius.rowInput),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: Row(
        children: [
          Icon(Icons.drag_indicator, size: 18, color: colors.textDim),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        semester.name,
                        style: AppText.sans(
                          size: 13.5,
                          weight: FontWeight.w800,
                          color: colors.text,
                        ),
                      ),
                    ),
                    if (isCurrent) ...[
                      const SizedBox(width: 7),
                      _CurrentPill(colors: colors),
                    ],
                  ],
                ),
                const SizedBox(height: 1),
                Text(
                  '$count ${count == 1 ? 'subject' : 'subjects'}',
                  style: AppText.sans(size: 10.5, color: colors.textDim),
                ),
              ],
            ),
          ),
          const SizedBox(width: 11),
          GestureDetector(
            onTap: onRename,
            behavior: HitTestBehavior.opaque,
            child: Icon(Icons.edit, size: 17, color: colors.textMed),
          ),
          const SizedBox(width: 11),
          GestureDetector(
            onTap: canDelete ? onDelete : null,
            behavior: HitTestBehavior.opaque,
            child: Icon(
              Icons.delete_outline,
              size: 17,
              color: canDelete ? _deleteColor : colors.textDim,
            ),
          ),
        ],
      ),
    );
  }
}

class _CurrentPill extends StatelessWidget {
  const _CurrentPill({required this.colors});

  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: colors.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        'Current',
        style: AppText.sans(
          size: 9.5,
          weight: FontWeight.w800,
          color: colors.accent,
        ),
      ),
    );
  }
}

/// The dashed "Add semester" button. The 1.5px dashed border is painted by
/// [_DashedBorderPainter] so the dash cadence matches the prototype.
class _AddSemesterButton extends StatelessWidget {
  const _AddSemesterButton({required this.colors, required this.onTap});

  final AppColors colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: CustomPaint(
        painter: _DashedBorderPainter(
          color: colors.border,
          radius: AppRadius.rowInput,
        ),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 11),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.add, size: 17, color: colors.accent),
              const SizedBox(width: 7),
              Text(
                'Add semester',
                style: AppText.sans(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: colors.accent,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Paints a 1.5px dashed rounded-rectangle border for the "Add semester" button.
class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    const dashWidth = 5.0;
    const dashGap = 4.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(
          metric.extractPath(distance, distance + dashWidth),
          paint,
        );
        distance += dashWidth + dashGap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.radius != radius;
}
