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

  Future<AdaMessage> reply(String userText, List<AdaMessage> history) async {
    final dto = await _source.reply(userText, const []);
    return dto.toModel();
  }
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

  void clear() => state = const AdaChatState();
}
