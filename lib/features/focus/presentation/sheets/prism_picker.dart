import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_text.dart';
import '../../../../shared/widgets/app_toggle.dart';

/// fc-prism — anchored Prism mode picker dropdown.
///
/// Opened by tapping the "Prism" pill on fc-set. Renders as an anchored dropdown
/// (top-left, offset 30/10) over a dimmed backdrop that shows the live config
/// (pill row, "Focus" title, subtitle, duration ring). Selecting a mode pops the
/// mode's name; tapping outside / back returns `null`.
Future<String?> showPrismPicker(BuildContext context) {
  return showDialog<String>(
    context: context,
    barrierColor: const Color(0x6B140F1C),
    builder: (_) => const _PrismPickerOverlay(),
  );
}

/// A selectable Prism mode descriptor.
class _PrismMode {
  const _PrismMode({
    required this.label,
    required this.color,
    this.mute = false,
    this.active = false,
  });

  final String label;
  final Color color;
  final bool mute;
  final bool active;
}

const List<_PrismMode> _modes = [
  _PrismMode(label: 'Deep Work', color: Color(0xFF6B5CF0), active: true),
  _PrismMode(label: 'Flow', color: Color(0xFF2A9D6B)),
  _PrismMode(label: 'Review', color: Color(0xFFE8A430)),
  _PrismMode(label: 'Wind-down', color: Color(0xFF777777)),
  _PrismMode(label: 'No sound', color: Color(0xFFC0C0C0), mute: true),
];

class _PrismPickerOverlay extends StatelessWidget {
  const _PrismPickerOverlay();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      type: MaterialType.transparency,
      child: Stack(
        children: [
          const Positioned.fill(child: _DimmedBackdrop()),
          Align(
            alignment: Alignment.topLeft,
            child: Padding(
              padding: const EdgeInsets.only(top: 30, left: 10),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 184),
                child: IntrinsicWidth(
                  child: Container(
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x26000000),
                          blurRadius: 36,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var i = 0; i < _modes.length; i++)
                            _ModeRow(mode: _modes[i], last: i == _modes.length - 1),
                          _AutoplayFooter(colors: colors),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The dimmed live-config preview behind the dropdown (pointer-inert).
class _DimmedBackdrop extends StatelessWidget {
  const _DimmedBackdrop();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return IgnorePointer(
      child: Opacity(
        opacity: 0.25,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _BackdropPill(
                    leading: Text(
                      '◈',
                      style: TextStyle(fontSize: 12, color: colors.accent, height: 1),
                    ),
                    label: 'Prism',
                    colors: colors,
                  ),
                  _BackdropPill(
                    leading: Icon(Icons.timer_outlined, size: 12, color: colors.text),
                    label: 'Set time',
                    colors: colors,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Focus',
              style: AppText.sans(size: 34, weight: FontWeight.w800, color: colors.text),
            ),
            const SizedBox(height: 4),
            Text(
              'CC 401 · LL(1) parsing notes',
              style: AppText.sans(size: 10, color: colors.textMed),
            ),
            const SizedBox(height: 14),
            const _DurationRing(mins: 15, maxMins: 60, size: 168),
          ],
        ),
      ),
    );
  }
}

class _BackdropPill extends StatelessWidget {
  const _BackdropPill({
    required this.leading,
    required this.label,
    required this.colors,
  });

  final Widget leading;
  final String label;
  final AppColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          leading,
          const SizedBox(width: 6),
          Text(
            label,
            style: AppText.sans(size: 11, weight: FontWeight.w700, color: colors.text),
          ),
        ],
      ),
    );
  }
}

/// A single selectable mode row inside the dropdown.
class _ModeRow extends StatelessWidget {
  const _ModeRow({required this.mode, required this.last});

  final _PrismMode mode;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).pop(mode.label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        decoration: BoxDecoration(
          color: mode.active ? colors.accentSoft : null,
          border: last
              ? null
              : Border(bottom: BorderSide(color: colors.border)),
        ),
        child: Row(
          children: [
            CustomPaint(
              size: const Size.square(22),
              painter: _PrismGlyphPainter(color: mode.color, mute: mode.mute),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Text(
                mode.label,
                style: AppText.sans(
                  size: 14,
                  weight: mode.active ? FontWeight.w700 : FontWeight.w500,
                  color: mode.active ? colors.accent : colors.text,
                ),
              ),
            ),
            if (mode.active)
              Icon(Icons.check, size: 12, color: colors.accent),
          ],
        ),
      ),
    );
  }
}

/// 22×22 Prism glyph: r9 outer circle (stroke 1.6) + either 5 soundwave bars
/// `[4,7,10,7,4]` or a diagonal mute slash.
class _PrismGlyphPainter extends CustomPainter {
  const _PrismGlyphPainter({required this.color, required this.mute});

  final Color color;
  final bool mute;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, 9, stroke);

    if (mute) {
      const d = 9 / math.sqrt2;
      canvas.drawLine(
        Offset(center.dx - d, center.dy - d),
        Offset(center.dx + d, center.dy + d),
        stroke,
      );
      return;
    }

    const heights = [4.0, 7.0, 10.0, 7.0, 4.0];
    const gap = 2.6;
    final totalWidth = (heights.length - 1) * gap;
    var x = center.dx - totalWidth / 2;
    for (final h in heights) {
      canvas.drawLine(
        Offset(x, center.dy - h / 2),
        Offset(x, center.dy + h / 2),
        stroke,
      );
      x += gap;
    }
  }

  @override
  bool shouldRepaint(_PrismGlyphPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.mute != mute;
}

/// Footer row with the "Autoplay Prism" toggle (top border).
class _AutoplayFooter extends StatefulWidget {
  const _AutoplayFooter({required this.colors});

  final AppColors colors;

  @override
  State<_AutoplayFooter> createState() => _AutoplayFooterState();
}

class _AutoplayFooterState extends State<_AutoplayFooter> {
  bool _autoplay = true;

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: Row(
        children: [
          Icon(Icons.music_note, size: 15, color: colors.textMed),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Autoplay Prism',
              style: AppText.sans(size: 12.5, color: colors.text),
            ),
          ),
          AppToggle(
            value: _autoplay,
            onChanged: (value) => setState(() => _autoplay = value),
          ),
        ],
      ),
    );
  }
}

/// Tick-ring duration dial shown (dimmed) behind the dropdown — accent arc +
/// 60 ticks, accentSoft track, center Playfair numeral + "MINS" + axis labels.
class _DurationRing extends StatelessWidget {
  const _DurationRing({
    required this.mins,
    required this.maxMins,
    required this.size,
  });

  final int mins;
  final int maxMins;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _DurationRingPainter(
          pct: mins / maxMins,
          track: colors.accentSoft,
          accent: colors.accent,
          offTick: const Color(0xFFDEDEDE),
          labelColor: colors.textDim,
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$mins',
                style: AppText.numeral(
                  size: 46,
                  letterSpacing: -2,
                  color: colors.text,
                ),
              ),
              Text(
                'MINS',
                style: AppText.sans(
                  size: 9,
                  weight: FontWeight.w800,
                  letterSpacing: AppText.em(0.14, 9),
                  color: colors.textMed,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DurationRingPainter extends CustomPainter {
  const _DurationRingPainter({
    required this.pct,
    required this.track,
    required this.accent,
    required this.offTick,
    required this.labelColor,
  });

  final double pct;
  final Color track;
  final Color accent;
  final Color offTick;
  final Color labelColor;

  static const double _trackR = 58;
  static const double _stroke = 10;
  static const double _tickR = 69;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);

    canvas.drawCircle(
      center,
      _trackR,
      Paint()
        ..color = track
        ..style = PaintingStyle.stroke
        ..strokeWidth = _stroke,
    );

    const start = -math.pi / 2;
    final sweep = pct * 2 * math.pi;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: _trackR),
      start,
      sweep,
      false,
      Paint()
        ..color = accent
        ..style = PaintingStyle.stroke
        ..strokeWidth = _stroke
        ..strokeCap = StrokeCap.round,
    );

    final knobAngle = start + sweep;
    canvas.drawCircle(
      center + Offset(math.cos(knobAngle), math.sin(knobAngle)) * _trackR,
      7,
      Paint()..color = accent,
    );

    for (var i = 0; i < 60; i++) {
      final angle = -math.pi / 2 + i / 60 * 2 * math.pi;
      final major = i % 15 == 0;
      final on = i / 60 < pct;
      final len = major ? 9.0 : 5.0;
      final dir = Offset(math.cos(angle), math.sin(angle));
      canvas.drawLine(
        center + dir * (_tickR - len),
        center + dir * _tickR,
        Paint()
          ..color = on ? accent : offTick
          ..strokeWidth = major ? 2 : 1
          ..strokeCap = StrokeCap.round,
      );
    }

    const labels = ['15', '30', '45', '60'];
    const cardinals = [
      Offset(0, -1),
      Offset(1, 0),
      Offset(0, 1),
      Offset(-1, 0),
    ];
    for (var i = 0; i < labels.length; i++) {
      final painter = TextPainter(
        text: TextSpan(
          text: labels[i],
          style: AppText.sans(size: 9, weight: FontWeight.w700, color: labelColor),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final pos = center + cardinals[i] * (_tickR + 9);
      painter.paint(
        canvas,
        pos - Offset(painter.width / 2, painter.height / 2),
      );
    }
  }

  @override
  bool shouldRepaint(_DurationRingPainter oldDelegate) =>
      oldDelegate.pct != pct ||
      oldDelegate.track != track ||
      oldDelegate.accent != accent ||
      oldDelegate.offTick != offTick ||
      oldDelegate.labelColor != labelColor;
}
