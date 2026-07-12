import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../data/models/subject.dart';
import '../../../../data/repositories/subjects_repository.dart';

/// Result of the `···` semester menu popover ([showSubjectMenu]).
enum SubjectMenuResult {
  /// "Add semester" action row.
  addSemester,

  /// "Edit semesters" action row.
  editSemesters,

  /// "Sort subjects" action row.
  sort,
}

/// Presents the `subj-menu` popover anchored to the header `···`, over the
/// dimmed real Subjects list (the barrier dims it — we do not rebuild a copy).
///
/// Returns the chosen [SubjectMenuResult], or `null` when dismissed by the
/// barrier or by tapping a semester row.
Future<SubjectMenuResult?> showSubjectMenu(BuildContext context) {
  return showDialog<SubjectMenuResult>(
    context: context,
    barrierColor: const Color(0x4C140F1C),
    builder: (_) => const _SubjectMenuPopover(),
  );
}

class _SubjectMenuPopover extends ConsumerWidget {
  const _SubjectMenuPopover();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final semesters = ref.watch(semestersProvider).value ?? const <Semester>[];
    final selectedId = ref.watch(selectedSemesterProvider) ??
        (semesters.isNotEmpty ? semesters.first.id : null);
    return Align(
      alignment: Alignment.topRight,
      child: Padding(
        padding: const EdgeInsets.only(top: 44, right: 12),
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: 224,
            clipBehavior: Clip.antiAlias,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x2E000000),
                  blurRadius: 44,
                  offset: Offset(0, 14),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 8),
                  child: Text(
                    'SEMESTER',
                    style: AppText.sans(
                      size: 9,
                      weight: FontWeight.w800,
                      letterSpacing: AppText.em(0.1, 9),
                      color: colors.textDim,
                    ),
                  ),
                ),
                for (final sem in semesters)
                  _SemesterRow(
                    label: sem.name,
                    on: sem.id == selectedId,
                    onTap: () {
                      ref
                          .read(selectedSemesterProvider.notifier)
                          .select(sem.id);
                      Navigator.of(context).pop();
                    },
                  ),
                Container(
                  height: 1,
                  margin: const EdgeInsets.symmetric(vertical: 6),
                  color: colors.border,
                ),
                _ActionRow(
                  icon: Icons.add,
                  label: 'Add semester',
                  onTap: () =>
                      Navigator.of(context).pop(SubjectMenuResult.addSemester),
                ),
                _ActionRow(
                  icon: Icons.edit_calendar,
                  label: 'Edit semesters',
                  onTap: () =>
                      Navigator.of(context).pop(SubjectMenuResult.editSemesters),
                ),
                _ActionRow(
                  icon: Icons.sort,
                  label: 'Sort subjects',
                  onTap: () => Navigator.of(context).pop(SubjectMenuResult.sort),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SemesterRow extends StatelessWidget {
  const _SemesterRow({
    required this.label,
    required this.on,
    required this.onTap,
  });

  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
        child: Row(
          children: [
            Icon(
              Icons.check,
              size: 17,
              color: on ? colors.accent : Colors.transparent,
            ),
            const SizedBox(width: 10),
            Text(
              label,
              style: AppText.sans(
                size: 13.5,
                weight: on ? FontWeight.w800 : FontWeight.w600,
                color: on ? colors.text : colors.textMed,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
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
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        child: Row(
          children: [
            Icon(icon, size: 18, color: colors.text),
            const SizedBox(width: 12),
            Text(
              label,
              style: AppText.sans(size: 13.5, color: colors.text),
            ),
          ],
        ),
      ),
    );
  }
}
