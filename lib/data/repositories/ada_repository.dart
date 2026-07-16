import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env/env.dart';
import '../../core/network/dio_client.dart';
import '../adapters/adapters.dart';
import '../models/ada_message.dart';
import '../models/enums.dart';
import '../sources/ada_source.dart';

class AdaRepository {
  AdaRepository(this._source);

  final AdaSource _source;

  Future<AdaMessage> reply(
    String userText,
    List<AdaMessage> history, {
    List<AdaAttachmentRef> attachments = const [],
  }) async {
    final dto = await _source.reply(userText, const [], attachments: attachments);
    return dto.toModel();
  }

  Future<AdaAttachmentRef?> uploadAttachment({
    required String name,
    required List<int> bytes,
    String? mimeType,
  }) =>
      _source.uploadAttachment(name: name, bytes: bytes, mimeType: mimeType);
}

final adaRepositoryProvider = Provider<AdaRepository>((ref) {
  final source =
      Env.useMocks ? MockAdaSource() : ApiAdaSource(ref.watch(dioProvider));
  return AdaRepository(source);
});

/// Immutable Ada chat state: the message log + a typing indicator.
class AdaChatState {
  const AdaChatState({this.messages = const [], this.typing = false});

  final List<AdaMessage> messages;
  final bool typing;

  bool get isEmpty => messages.isEmpty;

  AdaChatState copyWith({List<AdaMessage>? messages, bool? typing}) =>
      AdaChatState(
        messages: messages ?? this.messages,
        typing: typing ?? this.typing,
      );
}

final adaChatProvider =
    NotifierProvider<AdaChatController, AdaChatState>(AdaChatController.new);

class AdaChatController extends Notifier<AdaChatState> {
  @override
  AdaChatState build() => const AdaChatState();

  Future<void> send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    final userMsg = AdaMessage(
      id: 'u-${DateTime.now().microsecondsSinceEpoch}',
      role: AdaRole.user,
      text: trimmed,
      createdAt: DateTime.now(),
    );
    state = state.copyWith(
      messages: [...state.messages, userMsg],
      typing: true,
    );
    try {
      final reply = await ref.read(adaRepositoryProvider).reply(trimmed, state.messages);
      state = state.copyWith(messages: [...state.messages, reply], typing: false);
    } on Object catch (_) {
      state = state.copyWith(typing: false);
    }
  }

  /// Pick-then-upload flow: stage [bytes] as a file named [name], attach it to
  /// a new user turn, and stream Ada's grounded reply. Returns false if the
  /// upload wasn't possible (no storage configured / mock mode).
  Future<bool> attach({
    required List<int> bytes,
    required String name,
    String? mimeType,
  }) async {
    state = state.copyWith(typing: true);
    try {
      final attachment = await ref
          .read(adaRepositoryProvider)
          .uploadAttachment(name: name, bytes: bytes, mimeType: mimeType);
      if (attachment == null) {
        state = state.copyWith(typing: false);
        return false;
      }
      final text = "I've attached $name.";
      final userMsg = AdaMessage(
        id: 'u-${DateTime.now().microsecondsSinceEpoch}',
        role: AdaRole.user,
        text: text,
        createdAt: DateTime.now(),
      );
      state = state.copyWith(messages: [...state.messages, userMsg]);
      final reply = await ref
          .read(adaRepositoryProvider)
          .reply(text, state.messages, attachments: [attachment]);
      state = state.copyWith(messages: [...state.messages, reply], typing: false);
      return true;
    } on Object catch (_) {
      state = state.copyWith(typing: false);
      return false;
    }
  }

  void clear() => state = const AdaChatState();
}
