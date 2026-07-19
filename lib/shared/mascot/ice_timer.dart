import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'ada_mascot.dart';

/// The Focus "Ice melt" timer (prototype `IceTimer`): a progress ring around the
/// Ada cube, which melts as [progress] (0..1) advances. [frost] re-freezes the
/// look (paused state) with a cyan arc.
class IceTimer extends StatefulWidget {
  const IceTimer({
    super.key,
    this.progress = 0,
    this.size = 150,
    this.expr = AdaExpr.happy,
    this.frost = false,
  });

  final double progress;
  final double size;
  final AdaExpr expr;
  final bool frost;

  @override
  State<IceTimer> createState() => _IceTimerState();
}

class _IceTimerState extends State<IceTimer> with SingleTickerProviderStateMixin {
  // A slow "breathing" loop so the cube is visibly alive while the timer runs
  // (the melt itself advances over the whole session, too subtle second-to-
  // second). It holds still while frosted/paused (FOC-4).
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );

  @override
  void initState() {
    super.initState();
    if (!widget.frost) unawaited(_pulse.repeat(reverse: true));
  }

  @override
  void didUpdateWidget(covariant IceTimer old) {
    super.didUpdateWidget(old);
    if (widget.frost && _pulse.isAnimating) {
      _pulse.stop();
    } else if (!widget.frost && !_pulse.isAnimating) {
      unawaited(_pulse.repeat(reverse: true));
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final p = widget.progress.clamp(0.0, 1.0);
    // Smoothly interpolate the arc + melt between per-second ticks (the
    // prototype's `transition: stroke-dashoffset 0.9s linear`) so the cube
    // visibly melts while running rather than snapping each second (FOC-4).
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: p),
      duration: const Duration(milliseconds: 900),
      builder: (context, value, _) => SizedBox.square(
        dimension: widget.size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: Size.square(widget.size),
              painter: _RingPainter(
                progress: value,
                track: colors.hilite,
                arc: widget.frost ? const Color(0xFF9FD6EF) : colors.accent,
              ),
            ),
            AnimatedBuilder(
              animation: _pulse,
              builder: (context, child) {
                final t = widget.frost ? 0.0 : Curves.easeInOut.transform(_pulse.value);
                return Transform.scale(
                  scale: 1.0 + 0.035 * t,
                  child: Opacity(opacity: 0.9 + 0.1 * t, child: child),
                );
              },
              child: AdaMascot(
                size: widget.size * 0.6,
                melt: widget.frost ? 0.4 : value,
                expr: widget.expr,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.track, required this.arc});

  final double progress;
  final Color track;
  final Color arc;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 7.0;
    final r = (size.width - stroke) / 2 - 1;
    final center = size.center(Offset.zero);
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    if (progress > 0.001) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: r),
        -math.pi / 2,
        progress * 2 * math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = arc,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress || old.track != track || old.arc != arc;
}
