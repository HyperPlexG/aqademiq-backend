import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import 'bottom_nav.dart';

/// Standard screen body wrapper: top safe area + 16px side padding + bottom
/// clearance so scroll content clears the floating bottom nav (README §4).
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.child,
    this.horizontalPadding = AppSpacing.screenSide,
    this.bottomClearance,
    this.top = true,
  });

  /// Breathing room above the floating nav so primary actions never tuck under
  /// it.
  static const double navBreathing = 20;

  final Widget child;
  final double horizontalPadding;

  /// Bottom inset for the body. Defaults to [navClearanceOf] (the real nav
  /// footprint incl. the home-indicator inset) when null.
  final double? bottomClearance;
  final bool top;

  /// Vertical space the floating [BottomNav] occupies measured from the
  /// physical screen bottom: home-indicator inset + gap + bar height +
  /// breathing. Single source of truth for "clear the nav" on every screen —
  /// the fixed-92 guess used before under-cleared devices with a home indicator
  /// (GLOB-1).
  static double navClearanceOf(BuildContext context) =>
      MediaQuery.viewPaddingOf(context).bottom +
      BottomNav.bottomGap +
      BottomNav.height +
      navBreathing;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      top: top,
      child: Padding(
        padding: EdgeInsets.only(
          left: horizontalPadding,
          right: horizontalPadding,
          bottom: bottomClearance ?? navClearanceOf(context),
        ),
        child: child,
      ),
    );
  }
}
