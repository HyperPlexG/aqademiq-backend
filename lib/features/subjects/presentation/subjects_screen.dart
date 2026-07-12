import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../data/auth/auth_repository.dart';
import '../../../data/models/subject.dart';
import '../../../data/repositories/subjects_repository.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/guest_badge.dart';
import '../../../shared/widgets/guest_nudge_card.dart';
import '../../../shared/widgets/share_sheet.dart';
import '../providers/subjects_ui_providers.dart';
import 'sheets/add_semester_sheet.dart';
import 'sheets/edit_semesters_sheet.dart';
import 'sheets/sort_subjects_sheet.dart';
import 'sheets/subject_menu.dart';
import 'widgets/subject_form_sheet.dart';
import 'widgets/subject_tiles.dart';

/// FRAMES `subj-list` / `guest-subjects` — the Subjects tab.
class SubjectsScreen extends ConsumerWidget {
  const SubjectsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final guest = ref.watch(isGuestProvider);
    final subjectsAsync = ref.watch(subjectsProvider);
    final layout = ref.watch(subjectsLayoutProvider);
    final semesters = ref.watch(semestersProvider).value ?? const <Semester>[];
    final selectedId = ref.watch(selectedSemesterProvider);
    final selectedName = _selectedSemesterName(semesters, selectedId);

    return AppScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SubjHeader(
            guest: guest,
            onShare: () => unawaited(showShareSheet(context)),
            onMenu: () => _menu(context, ref),
            onAdd: () => _addSubject(context),
          ),
          const SizedBox(height: 10),
          subjectsAsync.when(
            loading: () => const Expanded(child: Center(child: CircularProgressIndicator())),
            error: (_, _) => Expanded(child: Center(child: Text('Could not load subjects', style: AppText.sans(size: 13, color: colors.textMed)))),
            data: (subjects) => Expanded(
              child: subjects.isEmpty
                  ? _Empty(guest: guest, onAdd: () => _addSubject(context))
                  : _SubjectCollection(
                      subjects: subjects,
                      layout: layout,
                      semesterName: selectedName,
                      onAddMissingFile: () => _openMissingFile(context, subjects),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// The name of the currently selected semester, falling back to the first.
  String? _selectedSemesterName(List<Semester> semesters, String? selectedId) {
    if (semesters.isEmpty) return null;
    if (selectedId != null) {
      for (final s in semesters) {
        if (s.id == selectedId) return s.name;
      }
    }
    return semesters.first.name;
  }

  /// SUBJ-6: jump to the first subject missing a file so its working "Add file"
  /// affordance is reachable.
  void _openMissingFile(BuildContext context, List<Subject> subjects) {
    final target = subjects.firstWhere(
      (s) => s.fileCount == 0,
      orElse: () => subjects.first,
    );
    unawaited(context.push(Routes.subjectDetail(target.id)));
  }

  Future<void> _addSubject(BuildContext context) async {
    // The controller refreshes the list on save, so we only need to await it.
    await showModalBottomSheet<Subject>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x4C140F1C),
      builder: (_) => const SubjectFormSheet(),
    );
  }

  Future<void> _menu(BuildContext context, WidgetRef ref) async {
    final result = await showSubjectMenu(context);
    if (!context.mounted || result == null) return;
    switch (result) {
      case SubjectMenuResult.addSemester:
        await showAddSemesterSheet(context);
      case SubjectMenuResult.editSemesters:
        await showEditSemestersSheet(context);
      case SubjectMenuResult.sort:
        await showSortSubjectsSheet(context);
    }
  }
}

class _SubjHeader extends StatelessWidget {
  const _SubjHeader({required this.guest, required this.onShare, required this.onMenu, required this.onAdd});
  final bool guest;
  final VoidCallback onShare;
  final VoidCallback onMenu;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        if (guest)
          const GuestBadge()
        else
          GestureDetector(
            onTap: onShare,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
              decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(AppRadius.pill), boxShadow: colors.cardShadow),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.ios_share, size: 15, color: colors.text),
                  const SizedBox(width: 6),
                  Text('Share', style: AppText.sans(size: 12, weight: FontWeight.w800, color: colors.text)),
                ],
              ),
            ),
          ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(AppRadius.pill), boxShadow: colors.cardShadow),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onMenu,
                child: SizedBox(
                  width: 30,
                  height: 30,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 5),
                      child: Text('···', style: AppText.sans(size: 17, weight: FontWeight.w800, height: 1, color: colors.text)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 2),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onAdd,
                child: SizedBox(width: 30, height: 30, child: Icon(Icons.add, size: 21, color: colors.text)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SubjectCollection extends StatelessWidget {
  const _SubjectCollection({
    required this.subjects,
    required this.layout,
    required this.semesterName,
    required this.onAddMissingFile,
  });
  final List<Subject> subjects;
  final SubjectsLayout layout;
  final String? semesterName;
  final VoidCallback onAddMissingFile;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    void open(Subject s) => unawaited(context.push(Routes.subjectDetail(s.id)));
    final missingCount = subjects.where((s) => s.fileCount == 0).length;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('Subjects', style: AppText.sans(size: 30, weight: FontWeight.w800, letterSpacing: -0.5, color: colors.text)),
            const SizedBox(width: 7),
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('${subjects.length}', style: AppText.sans(size: 13, weight: FontWeight.w700, color: colors.textDim)),
            ),
            const Spacer(),
            if (semesterName != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(semesterName!, style: AppText.sans(size: 11, weight: FontWeight.w800, color: colors.textMed)),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (missingCount > 0) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: colors.accentSoft, borderRadius: BorderRadius.circular(AppRadius.rowInput)),
            child: Row(
              children: [
                const AdaMascot(size: 24, expr: AdaExpr.focused),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    '$missingCount ${missingCount == 1 ? 'subject is' : 'subjects are'} missing a syllabus — add files so I can plan better.',
                    style: AppText.sans(size: 10.5, height: 1.4, color: colors.text),
                  ),
                ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: onAddMissingFile,
                  behavior: HitTestBehavior.opaque,
                  child: Text('Add →', style: AppText.sans(size: 11, weight: FontWeight.w800, color: colors.accent)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (layout == SubjectsLayout.grid)
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 9,
            crossAxisSpacing: 9,
            childAspectRatio: 0.92,
            padding: EdgeInsets.zero,
            children: [for (final s in subjects) SubjectTile(subject: s, onTap: () => open(s))],
          )
        else
          for (final s in subjects)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SubjectRow(subject: s, onTap: () => open(s)),
            ),
      ],
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.guest, required this.onAdd});
  final bool guest;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('Subjects', style: AppText.sans(size: 30, weight: FontWeight.w800, letterSpacing: -0.5, color: colors.text)),
            const SizedBox(width: 7),
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('0', style: AppText.sans(size: 13, weight: FontWeight.w700, color: colors.textDim)),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 78,
                    height: 78,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: colors.accentSoft, shape: BoxShape.circle),
                    child: const AdaMascot(size: 48),
                  ),
                  const SizedBox(height: 16),
                  Text('No subjects yet', style: AppText.sans(size: 19, weight: FontWeight.w700, color: colors.text)),
                  const SizedBox(height: 6),
                  Text(
                    "Add the classes you're taking and I'll keep your materials, deadlines and grades in one place.",
                    textAlign: TextAlign.center,
                    style: AppText.sans(size: 12, height: 1.55, color: colors.textMed),
                  ),
                  const SizedBox(height: 18),
                  GestureDetector(
                    onTap: onAdd,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
                      decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(AppRadius.pill)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.add, size: 17, color: Colors.white),
                          const SizedBox(width: 7),
                          Text('Add your first subject', style: AppText.sans(size: 12.5, weight: FontWeight.w800, color: Colors.white)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (guest) ...[
          const GuestNudgeCard(
            body: 'Set up so I can plan your week & track grades.',
            mascotExpr: AdaExpr.focused,
            mascotSize: 28,
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}
