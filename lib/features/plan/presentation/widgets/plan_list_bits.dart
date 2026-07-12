import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';

/// Empty-bucket "add a task" row (prototype `AddRow`, used on plan-otherday).
class AddRow extends StatelessWidget {
  const AddRow({super.key, this.label = 'Add a task for anytime', this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 2),
        child: Row(
          children: [
            Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFFD6D3CE), shape: BoxShape.circle)),
            const SizedBox(width: 11),
            Expanded(child: Text(label, style: AppText.sans(size: 12.5, color: colors.textDim))),
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
              child: Icon(Icons.add, size: 16, color: colors.textDim),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tinted group header for the list grouping view (prototype `ListGroupHead`).
class ListGroupHead extends StatelessWidget {
  const ListGroupHead({
    super.key,
    required this.icon,
    required this.label,
    required this.count,
    this.tint,
    this.onTap,
    this.onAdd,
  });

  final IconData icon;
  final String label;
  final int count;
  final Color? tint;
  final VoidCallback? onTap;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Stack(
        alignment: Alignment.center,
        children: [
          GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.fromLTRB(11, 6, 13, 6),
              decoration: BoxDecoration(
                color: tint != null ? tint!.alpha8(0x2E) : colors.hilite,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 14, color: colors.textMed),
                  const SizedBox(width: 7),
                  Text(
                    '$label ($count)',
                    style: AppText.sans(size: 11.5, weight: FontWeight.w800, letterSpacing: AppText.em(0.04, 11.5), color: colors.text),
                  ),
                  const SizedBox(width: 7),
                  Icon(Icons.expand_more, size: 17, color: colors.text),
                ],
              ),
            ),
          ),
          Positioned(
            right: 0,
            child: GestureDetector(
              onTap: onAdd,
              child: Icon(Icons.add, size: 19, color: colors.textDim),
            ),
          ),
        ],
      ),
    );
  }
}
