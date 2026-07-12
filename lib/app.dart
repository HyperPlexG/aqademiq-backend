import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';

/// Root widget: wires the router, the light/dark themes (rebuilt on accent
/// change), and the Light/Dark/System mode.
class AqademiqApp extends ConsumerWidget {
  const AqademiqApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accent = ref.watch(accentProvider);
    final mode = ref.watch(themeModeProvider);
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Aqademiq',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(brightness: Brightness.light, accent: accent),
      darkTheme: buildAppTheme(brightness: Brightness.dark, accent: accent),
      themeMode: mode,
      routerConfig: router,
    );
  }
}
