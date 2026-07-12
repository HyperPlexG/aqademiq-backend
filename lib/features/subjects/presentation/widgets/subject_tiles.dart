import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../core/utils/hex_color.dart';
import '../../../../data/models/subject.dart';

/// Target-grade chip (prototype `GradeChip`).
class GradeChip extends StatelessWidget {
  const GradeChip({super.key, required this.grade, required this.color});
  final String grade;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: color.alpha8(0x1C), borderRadius: BorderRadius.circular(7)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.track_changes, size: 11, color: color),
          const SizedBox(width: 3),
          Text(grade, style: AppText.sans(size: 10, weight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

/// List-mode subject tile (prototype `SubjectRow`).
class SubjectRow extends StatelessWidget {
  const SubjectRow({super.key, required this.subject, this.onTap});
  final Subject subject;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = hexColor(subject.color);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          boxShadow: colors.cardShadow,
        ),
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 13),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4))),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(subject.code ?? '', style: AppText.sans(size: 9, weight: FontWeight.w800, color: color)),
                        if (subject.credits != null) ...[
                          const SizedBox(width: 4),
                          Text('· ${subject.credits} cr', style: AppText.sans(size: 9, weight: FontWeight.w700, color: colors.textDim)),
                        ],
                        const Spacer(),
                        if (subject.targetGrade != null) GradeChip(grade: subject.targetGrade!, color: color),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(subject.name, style: AppText.sans(size: 13, weight: FontWeight.w800, height: 1.2, color: colors.text)),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (subject.professor != null) ...[
                          Icon(Icons.person_outline, size: 12, color: colors.textDim),
                          const SizedBox(width: 3),
                          Text(subject.professor!, style: AppText.sans(size: 10, color: colors.textDim)),
                          const SizedBox(width: 9),
                        ],
                        Icon(Icons.attach_file, size: 12, color: colors.textDim),
                        const SizedBox(width: 3),
                        Text('${subject.fileCount}', style: AppText.sans(size: 10, color: colors.textDim)),
                        if (subject.nextLabel != null) ...[
                          const SizedBox(width: 9),
                          Container(width: 5, height: 5, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                          const SizedBox(width: 4),
                          Flexible(child: Text(subject.nextLabel!, overflow: TextOverflow.ellipsis, style: AppText.sans(size: 10, color: color))),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Grid-mode subject tile (prototype `SubjectTile`).
class SubjectTile extends StatelessWidget {
  const SubjectTile({super.key, required this.subject, this.onTap});
  final Subject subject;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = hexColor(subject.color);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          boxShadow: colors.cardShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              color: color,
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
              child: Row(
                children: [
                  Text(subject.code ?? '', style: AppText.sans(size: 9, weight: FontWeight.w800, letterSpacing: AppText.em(0.04, 9), color: Colors.white)),
                  const Spacer(),
                  if (subject.targetGrade != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.28), borderRadius: BorderRadius.circular(6)),
                      child: Text(subject.targetGrade!, style: AppText.sans(size: 9, weight: FontWeight.w800, color: Colors.white)),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(11, 9, 11, 11),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    height: 29,
                    child: Text(subject.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.sans(size: 12, weight: FontWeight.w800, height: 1.2, color: colors.text)),
                  ),
                  const SizedBox(height: 4),
                  if (subject.professor != null)
                    Text(subject.professor!, style: AppText.sans(size: 9.5, color: colors.textDim)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.attach_file, size: 11, color: colors.textMed),
                      const SizedBox(width: 3),
                      Text('${subject.fileCount}', style: AppText.sans(size: 9.5, weight: FontWeight.w700, color: colors.textMed)),
                      if (subject.credits != null) ...[
                        const SizedBox(width: 8),
                        Text('${subject.credits} cr', style: AppText.sans(size: 9.5, weight: FontWeight.w700, color: colors.textMed)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
