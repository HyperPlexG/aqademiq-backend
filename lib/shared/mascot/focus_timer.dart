import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text.dart';

/// The focus-timer ring (prototype `FocusRing`, native size 168). Track +
/// 60 ticks + progress arc + end knob + quarter labels, with a Playfair numeral
/// readout in the center. Angles run clockwise from 12 o'clock.
class FocusTimerRing extends StatelessWidget {
  const FocusTimerRing({
    super.key,
    required this.minutes,
    this.maxMinutes = 60,
    this.progress,
    this.size = 168,
  });

  /// The big numeral shown in the center (selected minutes, or remaining).
  final int minutes;
  final int maxMinutes;

  /// Fill fraction 0..1; defaults to `minutes / maxMinutes` (set mode).
  final double? progress;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final scale = size / 168.0;
    final pct = (progress ?? (minutes / maxMinutes)).clamp(0.0, 1.0);

    return SizedBox.square(
      dimension: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size.square(size),
            painter: _RingPainter(
              pct: pct,
              accent: colors.accent,
              track: colors.accentSoft,
              labelColor: colors.textDim,
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$minutes',
                style: AppText.numeral(
                  size: 46 * scale,
                  letterSpacing: -2 * scale,
                  color: colors.text,
                ),
              ),
              Text(
                'MINS',
                style: AppText.sans(
                  size: 9 * scale,
                  weight: FontWeight.w800,
                  letterSpacing: AppText.em(0.14, 9 * scale),
                  color: colors.textMed,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.pct,
    required this.accent,
    required this.track,
    required this.labelColor,
  });

  final double pct;
  final Color accent;
  final Color track;
  final Color labelColor;

  static const _off = Color(0xFFDEDEDE);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 168.0;
    canvas
      ..save()
      ..scale(s);

    const cx = 84.0;
    const cy = 84.0;
    const r = 58.0;
    const center = Offset(cx, cy);

    // Track ring.
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..color = track,
    );

    // Ticks (60), major at quarters.
    for (var i = 0; i < 60; i++) {
      final frac = i / 60.0;
      final angle = frac * 2 * math.pi - math.pi / 2;
      final major = i % 15 == 0;
      const rO = 69.0;
      final rI = rO - (major ? 9 : 5);
      final on = frac < pct;
      final cos = math.cos(angle);
      final sin = math.sin(angle);
      canvas.drawLine(
        Offset(cx + cos * rO, cy + sin * rO),
        Offset(cx + cos * rI, cy + sin * rI),
        Paint()
          ..strokeWidth = major ? 2 : 1
          ..strokeCap = StrokeCap.round
          ..color = on ? accent : _off,
      );
    }

    // Progress arc + knob.
    if (pct > 0.01) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: r),
        -math.pi / 2,
        pct * 2 * math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 10
          ..strokeCap = StrokeCap.round
          ..color = accent,
      );
      final endAngle = pct * 2 * math.pi - math.pi / 2;
      canvas.drawCircle(
        Offset(cx + math.cos(endAngle) * r, cy + math.sin(endAngle) * r),
        7,
        Paint()..color = accent,
      );
    }

    // Quarter labels.
    const labels = [
      ['15', 139.0, 84.0],
      ['30', 84.0, 139.0],
      ['45', 29.0, 84.0],
      ['60', 84.0, 29.0],
    ];
    for (final l in labels) {
      final tp = TextPainter(
        text: TextSpan(
          text: l[0] as String,
          style: AppText.sans(size: 9, weight: FontWeight.w700, color: labelColor),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(
        canvas,
        Offset((l[1] as double) - tp.width / 2, (l[2] as double) - tp.height / 2),
      );
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.pct != pct ||
      old.accent != accent ||
      old.track != track ||
      old.labelColor != labelColor;
}
