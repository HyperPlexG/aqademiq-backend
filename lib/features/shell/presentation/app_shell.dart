import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/auth/auth_repository.dart';
import '../../../shared/widgets/bottom_nav.dart';

/// The 5-tab shell: an indexed-stack body + the floating [BottomNav]. Guest
/// taps on Ada / Stats open a setup prompt instead of navigating (README §5).
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final guest = ref.watch(isGuestProvider);

    return Scaffold(
      backgroundColor: colors.bg,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            navigationShell,
            Align(
              alignment: Alignment.bottomCenter,
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
                  child: BottomNav(
                    currentIndex: navigationShell.currentIndex,
                    guest: guest,
                    onTap: (index) => _onTap(context, index, guest),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onTap(BuildContext context, int index, bool guest) {
    // Guest gating: Ada / Stats open a full-screen setup prompt (README §5).
    if (guest && index == NavTab.ada) {
      unawaited(context.push(Routes.guestAda));
      return;
    }
    if (guest && index == NavTab.stats) {
      unawaited(context.push(Routes.guestStats));
      return;
    }
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }
}
