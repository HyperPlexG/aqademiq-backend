import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_text.dart';
import '../../../data/models/ada_message.dart';
import '../../../data/models/enums.dart';
import '../../../data/repositories/ada_repository.dart';
import '../../../shared/mascot/ada_mascot.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/dismiss_keyboard.dart';
import 'widgets/chat_history_sheet.dart';

/// FRAMES `ada-empty` / `ada-chat` — the Ada tab (intro when empty, conversation
/// once started). History opens as a slide-over.
class AdaScreen extends ConsumerStatefulWidget {
  const AdaScreen({super.key});

  @override
  ConsumerState<AdaScreen> createState() => _AdaScreenState();
}

class _AdaScreenState extends ConsumerState<AdaScreen> {
  final _input = TextEditingController();

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  void _send([String? text]) {
    final value = (text ?? _input.text).trim();
    if (value.isEmpty) return;
    _input.clear();
    unawaited(ref.read(adaChatProvider.notifier).send(value));
  }

  @override
  Widget build(BuildContext context) {
    final chat = ref.watch(adaChatProvider);
    // Sit above the keyboard when typing, otherwise above the floating nav.
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final inputBottom = keyboard > 0 ? keyboard + 8 : AppScaffold.navClearanceOf(context);

    return DismissKeyboard(
      child: Column(
        children: [
          _Header(onHistory: () => unawaited(showChatHistory(context))),
          Expanded(
            child: chat.isEmpty
                ? _EmptyState(onSuggest: _send)
                : _MessageList(messages: chat.messages, typing: chat.typing),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(10, 8, 10, inputBottom),
            child: _InputBar(
              controller: _input,
              compact: !chat.isEmpty,
              onSend: _send,
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onHistory});
  final VoidCallback onHistory;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.border))),
      child: Row(
        children: [
          GestureDetector(
            onTap: onHistory,
            child: Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: colors.surface, shape: BoxShape.circle, boxShadow: colors.cardShadow),
              child: Icon(Icons.menu, size: 15, color: colors.text),
            ),
          ),
          const SizedBox(width: 9),
          Text('Ada', style: AppText.sans(size: 15, weight: FontWeight.w800, color: colors.text)),
          const Spacer(),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Document upload is coming soon.')),
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(color: colors.bg, borderRadius: BorderRadius.circular(AppRadius.pill)),
              child: Text('↑ Upload', style: AppText.sans(size: 10, weight: FontWeight.w700, color: colors.text)),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onSuggest});
  final ValueChanged<String> onSuggest;

  static const _chips = ['Plan my week', "I'm overwhelmed", 'Break this down', 'Deadline help'];

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const AdaMascot(size: 72),
        const SizedBox(height: 16),
        Text(
          "Drop your thoughts.\nI'll turn them into a plan.",
          textAlign: TextAlign.center,
          style: AppText.sans(size: 17, weight: FontWeight.w700, height: 1.4, color: colors.text),
        ),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Wrap(
            alignment: WrapAlignment.center,
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final c in _chips)
                GestureDetector(
                  onTap: () => onSuggest(c),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      border: Border.all(color: colors.accent.alpha8(0x44)),
                    ),
                    child: Text(c, style: AppText.sans(size: 10, color: colors.accent)),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MessageList extends StatelessWidget {
  const _MessageList({required this.messages, required this.typing});
  final List<AdaMessage> messages;
  final bool typing;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      children: [
        for (final m in messages) _Bubble(message: m),
        if (typing) const _TypingBubble(),
      ],
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});
  final AdaMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isUser = message.role == AdaRole.user;
    final bubble = Container(
      constraints: BoxConstraints(maxWidth: isUser ? 170 : 185),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isUser ? colors.accent : colors.bg,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(12),
          topRight: const Radius.circular(12),
          bottomLeft: Radius.circular(isUser ? 12 : 3),
          bottomRight: Radius.circular(isUser ? 3 : 12),
        ),
      ),
      child: Text(message.text, style: AppText.sans(size: 12, height: 1.55, color: isUser ? Colors.white : colors.text)),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            const Padding(padding: EdgeInsets.only(top: 2), child: AdaMascot(size: 22)),
            const SizedBox(width: 7),
          ],
          Flexible(child: bubble),
        ],
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(padding: EdgeInsets.only(top: 2), child: AdaMascot(size: 22)),
          const SizedBox(width: 7),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: colors.bg,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                topRight: Radius.circular(12),
                bottomLeft: Radius.circular(3),
                bottomRight: Radius.circular(12),
              ),
            ),
            child: Text('Ada is thinking…', style: AppText.sans(size: 12, color: colors.textMed)),
          ),
        ],
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({required this.controller, required this.compact, required this.onSend});
  final TextEditingController controller;
  final bool compact;
  final VoidCallback onSend;

  static const _ink = Color(0xFF1A1320);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: compact ? 8 : 10),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              style: AppText.sans(size: 12, color: colors.text),
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: compact ? 'Ask Ada anything...' : "What's on your mind?",
                hintStyle: AppText.sans(size: 12, color: colors.textDim),
              ),
            ),
          ),
          const SizedBox(width: 8),
          if (compact)
            GestureDetector(
              onTap: onSend,
              child: Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: _ink, shape: BoxShape.circle),
                child: const Text('↑', style: TextStyle(fontSize: 14, color: Colors.white, height: 1)),
              ),
            )
          else
            GestureDetector(
              onTap: onSend,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(color: _ink, borderRadius: BorderRadius.circular(AppRadius.pill)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('◈', style: TextStyle(fontSize: 12, color: Colors.white, height: 1)),
                    const SizedBox(width: 5),
                    Text('Speak', style: AppText.sans(size: 11, weight: FontWeight.w700, color: Colors.white)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
