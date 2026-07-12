import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// One source row in the add-file sheet (`subj-file`).
class _FileSource {
  const _FileSource({
    required this.icon,
    required this.label,
    required this.sub,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String sub;
  final Color color;
}

const List<_FileSource> _sources = [
  _FileSource(
    icon: Icons.description,
    label: 'Syllabus',
    sub: 'PDF or doc — Ada builds your plan from it',
    color: Color(0xFF6B5CF0),
  ),
  _FileSource(
    icon: Icons.slideshow,
    label: 'Lecture slides',
    sub: 'Decks and handouts',
    color: Color(0xFFE8A430),
  ),
  _FileSource(
    icon: Icons.edit_note,
    label: 'Notes',
    sub: 'Your own notes & summaries',
    color: Color(0xFF5CBBFF),
  ),
  _FileSource(
    icon: Icons.quiz,
    label: 'Past papers',
    sub: 'Previous exams to practice',
    color: Color(0xFF2A9D6B),
  ),
];

/// subj-file — "Add to [subjectName]" bottom sheet (GCS upload).
///
/// Presents a source picker over the dimmed subject context: four upload
/// sources (Syllabus, Lecture slides, Notes, Past papers) plus Browse / Scan
/// outline pills. Tapping any source dismisses the sheet. Returns `null` on
/// dismiss.
Future<void> showAddFileSheet(
  BuildContext context, {
  required String subjectName,
  required Color subjectColor,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x4C140F1C),
    isScrollControlled: true,
    builder: (_) => _AddFileSheet(subjectName: subjectName),
  );
}

class _AddFileSheet extends StatelessWidget {
  const _AddFileSheet({required this.subjectName});

  final String subjectName;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadius.sheetTop),
        ),
        boxShadow: colors.sheetShadow,
      ),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 22),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0DDD7),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text(
                'Add to $subjectName',
                style: AppText.sans(
                  size: 19,
                  weight: FontWeight.w800,
                  color: colors.text,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Ada can read these to plan smarter',
                style: AppText.sans(size: 11.5, color: colors.textMed),
              ),
              const SizedBox(height: 16),
              for (var i = 0; i < _sources.length; i++)
                Padding(
                  padding: EdgeInsets.only(
                    bottom: i == _sources.length - 1 ? 0 : 8,
                  ),
                  child: _SourceRow(
                    source: _sources[i],
                    onTap: () => Navigator.of(context).pop(),
                  ),
                ),
              const SizedBox(height: 14),
              const Row(
                children: [
                  Expanded(
                    child: _OutlinePill(
                      icon: Icons.folder_open,
                      label: 'Browse',
                    ),
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: _OutlinePill(
                      icon: Icons.document_scanner,
                      label: 'Scan',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A single source row: tinted icon tile, label over sub, trailing chevron.
class _SourceRow extends StatelessWidget {
  const _SourceRow({required this.source, required this.onTap});

  final _FileSource source;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
        decoration: BoxDecoration(
          color: colors.bg,
          borderRadius: BorderRadius.circular(AppRadius.rowInput),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: source.color.alpha8(0x1C),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(source.icon, size: 19, color: source.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    source.label,
                    style: AppText.sans(
                      size: 12.5,
                      weight: FontWeight.w800,
                      color: colors.text,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    source.sub,
                    style: AppText.sans(size: 9.5, color: colors.textDim),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Icon(Icons.chevron_right, size: 18, color: colors.textDim),
          ],
        ),
      ),
    );
  }
}

/// An outline action pill (Browse / Scan): 1.5px border, full radius, icon
/// + label centered.
class _OutlinePill extends StatelessWidget {
  const _OutlinePill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: colors.border, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: colors.text),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppText.sans(
              size: 12,
              weight: FontWeight.w800,
              color: colors.text,
            ),
          ),
        ],
      ),
    );
  }
}
