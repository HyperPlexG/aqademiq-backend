import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text.dart';

/// Study-tag pill (prototype `TagChip`): dot + label + optional ✕, 1.5px solid
/// or dashed border, full radius. Used in forms/Settings (the timeline task row
/// uses a borderless inline tag instead).
class TagChip extends StatelessWidget {
  const TagChip({
    super.key,
    required this.label,
    this.color,
    this.active = false,
    this.dashed = false,
    this.onTap,
    this.onRemove,
  });

  final String label;
  final Color? color;
  final bool active;
  final bool dashed;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final c = color;
    final borderColor = dashed
        ? (c ?? colors.textDim)
        : (active ? (c ?? colors.accent) : colors.border);
    final fill = active && c != null
        ? c.alpha8(0x18)
        : (active ? colors.accentSoft : colors.surface);
    final textColor = dashed
        ? (c ?? colors.textMed)
        : (active ? (c ?? colors.accent) : colors.textMed);

    return GestureDetector(
      onTap: onTap,
      child: CustomPaint(
        painter: _ChipBorderPainter(border: borderColor, fill: fill, dashed: dashed),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 11),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!dashed && c != null) ...[
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(color: c, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: AppText.sans(size: 11, color: textColor),
              ),
              if (onRemove != null) ...[
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: onRemove,
                  child: Icon(Icons.close, size: 12, color: textColor),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ChipBorderPainter extends CustomPainter {
  _ChipBorderPainter({required this.border, required this.fill, required this.dashed});

  final Color border;
  final Color fill;
  final bool dashed;

  @override
  void paint(Canvas canvas, Size size) {
    final radius = size.height / 2;
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    canvas.drawRRect(rrect, Paint()..color = fill);

    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = border;

    if (!dashed) {
      canvas.drawRRect(rrect, stroke);
      return;
    }

    final path = Path()..addRRect(rrect);
    const dash = 3.0;
    const gap = 3.0;
    for (final metric in path.computeMetrics()) {
      var dist = 0.0;
      while (dist < metric.length) {
        canvas.drawPath(
          metric.extractPath(dist, math.min(dist + dash, metric.length)),
          stroke,
        );
        dist += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_ChipBorderPainter old) =>
      old.border != border || old.fill != fill || old.dashed != dashed;
}
