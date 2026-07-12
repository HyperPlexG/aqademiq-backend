import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text.dart';

/// FRAMES `ada-history` — chat-history slide-over panel (the Ada screen peeks at
/// the right edge).
Future<void> showChatHistory(BuildContext context) {
  return showGeneralDialog<void>(
    context: context,
    barrierLabel: 'Chat history',
    barrierColor: const Color(0x33140F1C),
    transitionDuration: const Duration(milliseconds: 240),
    pageBuilder: (_, _, _) => const _ChatHistoryPanel(),
    transitionBuilder: (_, anim, _, child) => SlideTransition(
      position: Tween(begin: const Offset(-1, 0), end: Offset.zero)
          .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
      child: child,
    ),
  );
}

class _ChatHistoryPanel extends StatelessWidget {
  const _ChatHistoryPanel();

  static const _entries = [
    ('MONDAY, 1 JUN', 'CC viva prep plan'),
    ('FRIDAY, 22 MAY', 'NLP assignment 3 breakdown'),
    ('MONDAY, 18 MAY', 'Exam-week schedule'),
    ('FRIDAY, 15 MAY', "I'm overwhelmed — triage"),
    ('MONDAY, 9 FEB', 'Google Calendar import'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Align(
      alignment: Alignment.centerLeft,
      child: FractionallySizedBox(
        widthFactor: 0.86,
        child: Material(
          color: colors.surface,
          borderRadius: const BorderRadius.only(topRight: Radius.circular(16), bottomRight: Radius.circular(16)),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14, top: 8),
                    child: Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: Container(
                            width: 32,
                            height: 32,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: colors.surface, shape: BoxShape.circle, boxShadow: colors.cardShadow),
                            child: Icon(Icons.menu, size: 15, color: colors.text),
                          ),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                          decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(100)),
                          child: Text('↑ Upload', style: AppText.sans(size: 10, weight: FontWeight.w700, color: colors.text)),
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      Text('Chat history', style: AppText.sans(size: 26, weight: FontWeight.w800, letterSpacing: -0.5, color: colors.text)),
                      const Spacer(),
                      Container(
                        width: 36,
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: colors.surface, shape: BoxShape.circle, boxShadow: colors.cardShadow),
                        child: Icon(Icons.edit_note, size: 17, color: colors.text),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.separated(
                      padding: EdgeInsets.zero,
                      itemCount: _entries.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 16),
                      itemBuilder: (_, i) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_entries[i].$1, style: AppText.sans(size: 9, weight: FontWeight.w800, letterSpacing: AppText.em(0.08, 9), color: colors.textDim)),
                          const SizedBox(height: 3),
                          Text(_entries[i].$2, style: AppText.sans(size: 15, weight: FontWeight.w700, color: colors.text)),
                        ],
                      ),
                    ),
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
