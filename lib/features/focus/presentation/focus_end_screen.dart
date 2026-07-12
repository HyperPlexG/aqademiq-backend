import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_text.dart';
import '../../../data/repositories/focus_repository.dart';
import '../../../shared/widgets/mood_blob.dart';

/// FRAMES `fc-end` — session-complete summary + mood capture, on a light
/// gradient. Uses a fixed dark ink (independent of theme) like the prototype.
class FocusEndScreen extends ConsumerStatefulWidget {
  const FocusEndScreen({super.key});

  @override
  ConsumerState<FocusEndScreen> createState() => _FocusEndScreenState();
}

class _FocusEndScreenState extends ConsumerState<FocusEndScreen> {
  static const _ink = Color(0xFF1A1320);
  static const _inkSub = Color.fromRGBO(36, 24, 52, 0.58);
  int _mood = 3;

  String get _duration {
    final mins = ref.read(focusControllerProvider).durationMin;
    return '${mins.toString().padLeft(2, '0')}:00';
  }

  void _backToPlan() {
    ref.read(focusControllerProvider.notifier).reset();
    context.go(Routes.plan);
  }

  void _again() {
    ref.read(focusControllerProvider.notifier).reset();
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF5F2FF), Color(0xFFC9BCF8), Color(0xFF6B5CF0)],
            stops: [0, 0.46, 1],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 5),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(100)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('◈', style: TextStyle(fontSize: 11, color: Color(0xFF6B5CF0), height: 1)),
                        const SizedBox(width: 6),
                        Text('Deep Work · Prism', style: AppText.sans(size: 10, weight: FontWeight.w700, color: _ink)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  Text('Session done', style: AppText.sans(size: 26, weight: FontWeight.w800, color: _ink)),
                  const SizedBox(height: 5),
                  Text('LL(1) parsing notes · CC 401', style: AppText.sans(size: 11.5, color: _inkSub)),
                  const SizedBox(height: 18),
                  Text(_duration, style: AppText.sans(size: 48, weight: FontWeight.w800, letterSpacing: 0.5, height: 1, color: _ink)),
                  const SizedBox(height: 6),
                  Text('Focused', style: AppText.sans(size: 12, color: _inkSub)),
                  const SizedBox(height: 18),
                  _MoodCard(selected: _mood, onSelect: (i) => setState(() => _mood = i)),
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: _backToPlan,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 16),
                      decoration: BoxDecoration(color: _ink, borderRadius: BorderRadius.circular(100)),
                      child: Text('Back to today →', textAlign: TextAlign.center, style: AppText.sans(size: 14, weight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap: _again,
                    child: Text('Start another session', style: AppText.sans(size: 11.5, color: _inkSub)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MoodCard extends StatelessWidget {
  const _MoodCard({required this.selected, required this.onSelect});
  final int selected;
  final ValueChanged<int> onSelect;

  static const _colors = [Color(0xFFA79FC4), Color(0xFF9286D2), Color(0xFF7D70D9), Color(0xFF6A5CE4), Color(0xFF5A44F1)];

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.78), borderRadius: BorderRadius.circular(18)),
      child: Column(
        children: [
          Text('How was that session?', style: AppText.sans(size: 12, weight: FontWeight.w700, color: const Color(0xFF1A1320))),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < 5; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: GestureDetector(
                    onTap: () => onSelect(i),
                    child: Container(
                      padding: const EdgeInsets.all(2.5),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i == selected ? _colors[i].withValues(alpha: 0.13) : Colors.transparent,
                        border: Border.all(color: i == selected ? _colors[i] : Colors.transparent, width: 2),
                      ),
                      child: MoodBlob(idx: i, size: i == selected ? 32 : 29),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
