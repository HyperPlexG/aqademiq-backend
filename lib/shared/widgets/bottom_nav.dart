import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../mascot/ada_mascot.dart';

/// Stable semantic tab indices (README §4 / prototype). NOTE the order is
/// non-sequential by design: the center Ada carries index 4.
abstract final class NavTab {
  static const int subjects = 0;
  static const int planner = 1;
  static const int timer = 2;
  static const int stats = 3;
  static const int ada = 4;
}

class _NavItem {
  const _NavItem(this.icon, this.index);
  final IconData? icon; // null = Ada center face
  final int index;
}

/// Floating 5-tab bottom navigation (prototype `BNav`). Visual L→R:
/// Subjects · Planner · **Ada (center)** · Timer · Stats. Guest mode locks
/// Ada(4) + Stats(3) with a lock dot.
class BottomNav extends StatelessWidget {
  const BottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.guest = false,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final bool guest;

  /// Floating bar height (prototype `BNav`). Single source of truth — screens
  /// derive their bottom clearance from this via `AppScaffold.navClearanceOf`.
  static const double height = 56;

  /// Gap between the floating bar and the bottom safe-area edge (see AppShell).
  static const double bottomGap = 8;

  static const List<_NavItem> _items = [
    _NavItem(Icons.menu_book_outlined, NavTab.subjects),
    _NavItem(Icons.calendar_today_outlined, NavTab.planner),
    _NavItem(null, NavTab.ada),
    _NavItem(Icons.timer_outlined, NavTab.timer),
    _NavItem(Icons.bar_chart_outlined, NavTab.stats),
  ];

  bool _locked(int i) => guest && (i == NavTab.ada || i == NavTab.stats);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.nav),
        boxShadow: colors.navShadow,
      ),
      child: Row(
        children: [
          for (final item in _items)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onTap(item.index),
                child: SizedBox(
                  height: height,
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      Center(
                        child: item.icon == null
                            ? _AdaTab(active: currentIndex == item.index, locked: _locked(item.index))
                            : _StandardTab(icon: item.icon!, active: currentIndex == item.index),
                      ),
                      if (_locked(item.index))
                        const Positioned(top: 6, right: 6, child: _LockDot()),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StandardTab extends StatelessWidget {
  const _StandardTab({required this.icon, required this.active});
  final IconData icon;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 46,
      height: 40,
      decoration: BoxDecoration(
        color: active ? colors.ink : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, size: 24, color: active ? Colors.white : colors.textMed),
    );
  }
}

class _AdaTab extends StatelessWidget {
  const _AdaTab({required this.active, required this.locked});
  final bool active;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Opacity(
      opacity: locked ? 0.55 : 1,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? colors.ink : colors.surface,
          shape: BoxShape.circle,
          border: active ? null : Border.all(color: colors.border, width: 1.5),
        ),
        child: const AdaNavFace(),
      ),
    );
  }
}

class _LockDot extends StatelessWidget {
  const _LockDot();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 14,
      height: 14,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.warn,
        shape: BoxShape.circle,
        border: Border.all(color: colors.surface, width: 2),
      ),
      child: const Icon(Icons.lock, size: 8, color: Colors.white),
    );
  }
}
