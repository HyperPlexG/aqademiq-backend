import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';

/// Surface card: white, radius 16, soft elevation (prototype `Card`).
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
    this.radius = AppRadius.card,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final borderRadius = BorderRadius.circular(radius);
    Widget content = Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: borderRadius,
        boxShadow: colors.cardShadow,
      ),
      child: Padding(padding: padding, child: child),
    );
    if (onTap != null) {
      content = Stack(
        children: [
          content,
          Positioned.fill(
            child: Material(
              color: Colors.transparent,
              child: InkWell(borderRadius: borderRadius, onTap: onTap),
            ),
          ),
        ],
      );
    }
    return content;
  }
}
