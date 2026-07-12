import 'package:flutter/material.dart';

/// Wraps a screen so a tap on empty space dismisses the keyboard. Descendant
/// gestures (fields, buttons) win the arena first, so only stray taps unfocus.
/// Use on full-screen forms; bottom sheets get this for free via
/// `AppBottomSheet`'s keyboard handling.
class DismissKeyboard extends StatelessWidget {
  const DismissKeyboard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      behavior: HitTestBehavior.opaque,
      child: child,
    );
  }
}
