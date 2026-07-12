import 'package:flutter/material.dart';

/// One periwinkle tone of the ice cube: outline/shadow, fill, and ink (face).
@immutable
class AdaTone {
  const AdaTone(this.border, this.body, this.ink);
  final Color border;
  final Color body;
  final Color ink;
}

/// CUBE_TONES ramp (index 0 = palest/worst → 4 = vivid/best). From the prototype.
const List<AdaTone> kCubeTones = [
  AdaTone(Color(0xFFA79FC4), Color(0xFFEAE8F2), Color(0xFF938EAC)),
  AdaTone(Color(0xFF9286D2), Color(0xFFE4DDF3), Color(0xFF787299)),
  AdaTone(Color(0xFF7D70D9), Color(0xFFDCD3F7), Color(0xFF5C5499)),
  AdaTone(Color(0xFF6A5CE4), Color(0xFFD2C5FA), Color(0xFF41358F)),
  AdaTone(Color(0xFF5A44F1), Color(0xFFCBBCFD), Color(0xFF31237C)),
];

/// Ada's facial expressions (CUBE_MOUTHS + happy/sad specials).
enum AdaExpr { happy, smile, neutral, focused, meh, sad }

/// The Ada ice-cube mascot, ported 1:1 from the prototype's `CubeSVG`
/// (viewBox 60×60). [melt] 0→1 morphs the crisp cube into a melted puddle and is
/// tied to focus progress; decorative drips fade under reduced motion (handled by
/// the caller passing a frozen [melt]).
class AdaMascot extends StatelessWidget {
  const AdaMascot({
    super.key,
    this.size = 60,
    this.tone = kCubeTones,
    this.toneIndex = 4,
    this.melt = 0,
    this.expr = AdaExpr.happy,
    this.bubbles = 3,
    this.cheeks = false,
    this.sparkles = false,
    this.sweat = false,
  });

  final double size;
  final List<AdaTone> tone;
  final int toneIndex;
  final double melt;
  final AdaExpr expr;
  final int bubbles;
  final bool cheeks;
  final bool sparkles;
  final bool sweat;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _CubePainter(
          tone: tone[toneIndex.clamp(0, tone.length - 1)],
          melt: melt.clamp(0, 1),
          expr: expr,
          bubbles: bubbles,
          cheeks: cheeks,
          sparkles: sparkles,
          sweat: sweat,
        ),
      ),
    );
  }
}

class _CubePainter extends CustomPainter {
  _CubePainter({
    required this.tone,
    required this.melt,
    required this.expr,
    required this.bubbles,
    required this.cheeks,
    required this.sparkles,
    required this.sweat,
  });

  final AdaTone tone;
  final double melt;
  final AdaExpr expr;
  final int bubbles;
  final bool cheeks;
  final bool sparkles;
  final bool sweat;

  @override
  void paint(Canvas canvas, Size size) {
    final m = melt;
    final s = size.width / 60.0;
    canvas
      ..save()
      ..scale(s);

    // Melt-driven geometry (linear interpolation in m).
    final tY = 8 + 15 * m;
    final bY = 50 + 2 * m;
    final tL = 11 + 7 * m;
    final tR = 49 - 7 * m;
    final bL = 11 - 6 * m;
    final bR = 49 + 6 * m;
    final rTop = 9 + 3 * m;
    final rBot = 9 + 13 * m;
    final sag = 2.5 * m;

    final faceCY = (tY + bY) / 2 + 1;
    final eyeY = faceCY - 2;
    final eyeR = 2.7 - 0.5 * m;
    final eyeDX = 6 - 1.2 * m;
    final mY = faceCY + 5;
    final gloss = 0.5 * (1 - 0.55 * m);

    // 1. Sparkles (behind the body).
    if (sparkles) {
      final p = Paint()..color = tone.border;
      _sparkle(canvas, 46, 9, 4.2, p);
      _sparkle(canvas, 53, 17, 2.6, p);
      canvas
        ..drawCircle(const Offset(40, 6), 1.6, p)
        ..drawCircle(const Offset(50, 5), 1.2, p)
        ..drawCircle(const Offset(56, 12), 1.4, p);
    }

    // 2. Drop-shadow ellipse.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(30, bY + 3),
        width: (16 + 4 * m) * 2,
        height: 3.2 * 2,
      ),
      Paint()..color = tone.border.withValues(alpha: 0.16),
    );

    // 3. Outer body + 4. inner sheen.
    final body = _cubeBody(tL, tY, tR, bL, bR, bY, rTop, rBot, sag);
    final inner = _cubeBody(
      tL + 5, tY + 5, tR - 5, bL + 5, bR - 5, bY - 5,
      rTop * 0.55, rBot * 0.6, sag * 0.6,
    );
    canvas
      ..drawPath(body, Paint()..color = tone.body)
      ..drawPath(
        body,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.4 - 1.2 * m
          ..strokeJoin = StrokeJoin.round
          ..color = tone.border,
      )
      ..drawPath(
        inner,
        Paint()..color = Colors.white.withValues(alpha: 0.32 * (1 - 0.5 * m)),
      );

    // 5. Top gloss streak.
    final glossPath = Path()
      ..moveTo(tL + rTop + 1, tY + 2.5)
      ..quadraticBezierTo(tL + 3, tY + 3, tL + 3.2, tY + rTop + 5);
    canvas.drawPath(
      glossPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: gloss),
    );

    // 6. Frozen bubbles.
    const bub = [
      [21.0, 9.0, 2.7],
      [26.5, 6.0, 1.5],
      [19.5, 15.5, 1.9],
    ];
    for (var i = 0; i < bubbles && i < bub.length; i++) {
      final b = bub[i];
      canvas.drawCircle(
        Offset(b[0], tY + b[1]),
        b[2],
        Paint()..color = Colors.white.withValues(alpha: (0.85 - i * 0.15) * (1 - 0.5 * m)),
      );
    }

    // 7. Cheeks.
    if (cheeks) {
      final p = Paint()..color = const Color(0xFFF0A0B6).withValues(alpha: 0.72);
      canvas
        ..drawOval(Rect.fromCenter(center: Offset(30 - eyeDX - 2, eyeY + 5.5), width: 6, height: 4), p)
        ..drawOval(Rect.fromCenter(center: Offset(30 + eyeDX + 2, eyeY + 5.5), width: 6, height: 4), p);
    }

    // 8. Eyes.
    _drawEyes(canvas, eyeDX, eyeY, eyeR, m);

    // 9. Mouth.
    _drawMouth(canvas, mY, m);

    // 10. Sweat.
    if (sweat) {
      final path = Path()
        ..moveTo(30 + eyeDX + 6, eyeY - 3)
        ..relativeQuadraticBezierTo(-2.4, 4, 0, 6)
        ..relativeQuadraticBezierTo(2.4, -2, 0, -6)
        ..close();
      canvas
        ..drawPath(path, Paint()..color = const Color(0xFF8FD0EF))
        ..drawPath(
          path,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.5
            ..color = const Color(0xFF6BB8E0),
        );
    }

    canvas.restore();
  }

  Path _cubeBody(
    double tL,
    double tY,
    double tR,
    double bL,
    double bR,
    double bY,
    double rTop,
    double rBot,
    double sag,
  ) {
    return Path()
      ..moveTo(tL + rTop, tY)
      ..lineTo(tR - rTop, tY)
      ..quadraticBezierTo(tR, tY, tR, tY + rTop)
      ..lineTo(bR, bY - rBot)
      ..quadraticBezierTo(bR, bY, bR - rBot, bY)
      ..quadraticBezierTo(30, bY + sag, bL + rBot, bY)
      ..quadraticBezierTo(bL, bY, bL, bY - rBot)
      ..lineTo(tL, tY + rTop)
      ..quadraticBezierTo(tL, tY, tL + rTop, tY)
      ..close();
  }

  void _sparkle(Canvas canvas, double x, double y, double r, Paint p) {
    final path = Path()
      ..moveTo(x, y - r)
      ..quadraticBezierTo(x + 0.2 * r, y - 0.2 * r, x + r, y)
      ..quadraticBezierTo(x + 0.2 * r, y + 0.2 * r, x, y + r)
      ..quadraticBezierTo(x - 0.2 * r, y + 0.2 * r, x - r, y)
      ..quadraticBezierTo(x - 0.2 * r, y - 0.2 * r, x, y - r)
      ..close();
    canvas.drawPath(path, p);
  }

  void _drawEyes(Canvas canvas, double eyeDX, double eyeY, double eyeR, double m) {
    if (expr == AdaExpr.happy) {
      final p = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.1
        ..strokeCap = StrokeCap.round
        ..color = tone.ink;
      canvas
        ..drawPath(
          Path()
            ..moveTo(30 - eyeDX - 3, eyeY + 1.2)
            ..quadraticBezierTo(30 - eyeDX, eyeY - 3, 30 - eyeDX + 3, eyeY + 1.2),
          p,
        )
        ..drawPath(
          Path()
            ..moveTo(30 + eyeDX - 3, eyeY + 1.2)
            ..quadraticBezierTo(30 + eyeDX, eyeY - 3, 30 + eyeDX + 3, eyeY + 1.2),
          p,
        );
    } else if (expr == AdaExpr.sad) {
      final p = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = tone.ink;
      canvas
        ..drawLine(Offset(30 - eyeDX - 2.5, eyeY - 1.5), Offset(30 - eyeDX + 2.5, eyeY + 1.5), p)
        ..drawLine(Offset(30 + eyeDX + 2.5, eyeY - 1.5), Offset(30 + eyeDX - 2.5, eyeY + 1.5), p);
    } else {
      final p = Paint()..color = tone.ink;
      canvas
        ..drawCircle(Offset(30 - eyeDX, eyeY), eyeR, p)
        ..drawCircle(Offset(30 + eyeDX, eyeY), eyeR, p);
    }
  }

  void _drawMouth(Canvas canvas, double mY, double m) {
    if (expr == AdaExpr.happy) {
      final mouth = Path()
        ..moveTo(30 - 6.5, mY - 1)
        ..quadraticBezierTo(30, mY + 8.5, 30 + 6.5, mY - 1)
        ..quadraticBezierTo(30, mY + 1.5, 30 - 6.5, mY - 1)
        ..close();
      final tongue = Path()
        ..moveTo(30 - 3.3, mY + 3.4)
        ..quadraticBezierTo(30, mY + 6.4, 30 + 3.3, mY + 3.4)
        ..quadraticBezierTo(30, mY + 5, 30 - 3.3, mY + 3.4)
        ..close();
      canvas
        ..drawPath(mouth, Paint()..color = tone.ink)
        ..drawPath(tongue, Paint()..color = const Color(0xFFE8607F));
      return;
    }
    canvas.drawPath(
      _mouthPath(expr, mY),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4 - 0.4 * m
        ..strokeCap = StrokeCap.round
        ..color = tone.ink,
    );
  }

  Path _mouthPath(AdaExpr expr, double my) {
    const cx = 30.0;
    switch (expr) {
      case AdaExpr.smile:
        return Path()
          ..moveTo(cx - 6, my)
          ..quadraticBezierTo(cx, my + 4.5, cx + 6, my);
      case AdaExpr.neutral:
        return Path()
          ..moveTo(cx - 6, my)
          ..lineTo(cx + 6, my);
      case AdaExpr.focused:
        return Path()
          ..moveTo(cx - 5, my)
          ..quadraticBezierTo(cx, my + 3, cx + 5, my);
      case AdaExpr.meh:
        return Path()
          ..moveTo(cx - 6, my + 2)
          ..quadraticBezierTo(cx, my - 2, cx + 6, my + 2);
      case AdaExpr.sad:
        return Path()
          ..moveTo(cx - 7, my + 3)
          ..quadraticBezierTo(cx, my - 3.5, cx + 7, my + 3);
      case AdaExpr.happy:
        return Path()
          ..moveTo(cx - 7, my - 1)
          ..quadraticBezierTo(cx, my + 6, cx + 7, my - 1);
    }
  }

  @override
  bool shouldRepaint(_CubePainter old) =>
      old.melt != melt ||
      old.expr != expr ||
      old.tone != tone ||
      old.bubbles != bubbles ||
      old.cheeks != cheeks ||
      old.sparkles != sparkles ||
      old.sweat != sweat;
}

/// AdaNavFace — the glossy gradient bead used as the center nav icon (NOT the
/// cube). A radial-gradient circle with an inner-bottom shadow + a simple happy
/// face, sized to fit inside the 44px nav circle.
class AdaNavFace extends StatelessWidget {
  const AdaNavFace({super.key, this.size = 34});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: Alignment(-0.28, -0.4), // ~ circle at 36% 30%
          radius: 0.9,
          colors: [Color(0xFFCBBCFD), Color(0xFFB7A6F5), Color(0xFF6B5CF0)],
          stops: [0.0, 0.46, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x2E281959), // rgba(40,25,90,0.18)
            blurRadius: 5,
            offset: Offset(0, -2),
            spreadRadius: -1,
          ),
        ],
      ),
      child: CustomPaint(painter: _NavFacePainter()),
    );
  }
}

class _NavFacePainter extends CustomPainter {
  static const _ink = Color(0xFF31237C);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40.0;
    canvas
      ..save()
      ..scale(s);
    final eye = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..color = _ink;
    canvas
      ..drawPath(
        Path()
          ..moveTo(12.5, 18.5)
          ..quadraticBezierTo(15.5, 14.5, 18.5, 18.5),
        eye,
      )
      ..drawPath(
        Path()
          ..moveTo(21.5, 18.5)
          ..quadraticBezierTo(24.5, 14.5, 27.5, 18.5),
        eye,
      )
      ..drawPath(
        Path()
          ..moveTo(15, 23)
          ..quadraticBezierTo(20, 30.5, 25, 23)
          ..quadraticBezierTo(20, 25.5, 15, 23)
          ..close(),
        Paint()..color = _ink,
      )
      ..restore();
  }

  @override
  bool shouldRepaint(_NavFacePainter oldDelegate) => false;
}
