import 'package:dio/dio.dart';

import '../dtos/ada_message_dto.dart';
import 'mock_latency.dart';

/// A file staged for Ada (via `POST /ada/uploads`), referenced from the next
/// chat message's `attachments`.
class AdaAttachmentRef {
  const AdaAttachmentRef({required this.key, required this.name, this.mimeType});
  final String key;
  final String name;
  final String? mimeType;
}

abstract interface class AdaSource {
  Future<AdaMessageDto> reply(
    String userText,
    List<AdaMessageDto> history, {
    List<AdaAttachmentRef>? attachments,
  });

  /// Stage a file for the conversation and return a reference to attach to the
  /// next message. Returns null when uploads aren't available (mock mode, or no
  /// storage configured on the server).
  Future<AdaAttachmentRef?> uploadAttachment({
    required String name,
    required List<int> bytes,
    String? mimeType,
  });
}

class MockAdaSource implements AdaSource {
  static const _canned = [
    "Let's break that down. I can add a few focused steps to your plan — want me to schedule them this week?",
    'Got it. Based on your peak focus time, mornings look best for deep work. Shall I block 9–11?',
    "Nice progress! You're on a 5-day streak. Keep one small task for today so it stays alive.",
    'I can split that into 3 microtasks (~25 min each) and drop them into Anytime. Sound good?',
  ];

  int _i = 0;

  @override
  Future<AdaMessageDto> reply(
    String userText,
    List<AdaMessageDto> history, {
    List<AdaAttachmentRef>? attachments,
  }) {
    final text = _canned[_i++ % _canned.length];
    return mockDelay(
      AdaMessageDto(
        id: 'ada-${DateTime.now().microsecondsSinceEpoch}',
        role: 'ada',
        text: text,
        createdAt: DateTime.now(),
      ),
      ms: 700,
    );
  }

  @override
  Future<AdaAttachmentRef?> uploadAttachment({
    required String name,
    required List<int> bytes,
    String? mimeType,
  }) =>
      mockDelay(AdaAttachmentRef(key: 'mock/$name', name: name, mimeType: mimeType), ms: 300);
}

/// Live impl against `/v1/ada`. Keeps conversation history server-side, so it
/// lazily creates a conversation, posts the user turn (with any attachments),
/// and returns the assistant reply. Uploads presign a GCS spot then PUT the
/// bytes directly (no bearer on the GCS URL).
class ApiAdaSource implements AdaSource {
  ApiAdaSource(this._dio);
  final Dio _dio;

  String? _conversationId;

  @override
  Future<AdaMessageDto> reply(
    String userText,
    List<AdaMessageDto> history, {
    List<AdaAttachmentRef>? attachments,
  }) async {
    final convoId = _conversationId ??= await _ensureConversation();
    final atts = attachments ?? const <AdaAttachmentRef>[];
    final res = await _dio.post<Map<String, dynamic>>(
      '/v1/ada/conversations/$convoId/messages',
      data: {
        'text': userText,
        if (atts.isNotEmpty)
          'attachments': atts
              .map((a) => {
                    'key': a.key,
                    'name': a.name,
                    if (a.mimeType != null) 'mime_type': a.mimeType,
                  })
              .toList(),
      },
    );
    final msgs = (res.data?['messages'] as List?) ?? const [];
    Map<String, dynamic>? assistant;
    for (final m in msgs) {
      final map = (m as Map).cast<String, dynamic>();
      if (map['is_user'] == false) assistant = map;
    }
    assistant ??= msgs.isNotEmpty ? (msgs.last as Map).cast<String, dynamic>() : null;
    if (assistant == null) {
      throw StateError('Ada returned no reply');
    }
    return _fromMessage(assistant);
  }

  @override
  Future<AdaAttachmentRef?> uploadAttachment({
    required String name,
    required List<int> bytes,
    String? mimeType,
  }) async {
    final convoId = _conversationId ??= await _ensureConversation();
    final res = await _dio.post<Map<String, dynamic>>(
      '/v1/ada/uploads',
      data: {
        'conversation_id': convoId,
        'name': name,
        'mime_type': ?mimeType,
        'size_bytes': bytes.length,
      },
    );
    final uploadUrl = res.data?['upload_url'] as String?;
    final key = res.data?['key'] as String?;
    if (uploadUrl == null || key == null) return null;

    // PUT bytes straight to the GCS signed URL — a clean Dio so no Bearer header
    // (which the signature would reject) and no refresh interceptor.
    await Dio().put<void>(
      uploadUrl,
      data: Stream<List<int>>.fromIterable([bytes]),
      options: Options(
        headers: {Headers.contentLengthHeader: bytes.length},
        contentType: mimeType ?? 'application/octet-stream',
      ),
    );
    return AdaAttachmentRef(key: key, name: name, mimeType: mimeType);
  }

  Future<String> _ensureConversation() async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/v1/ada/conversations',
      data: <String, dynamic>{},
    );
    return res.data!['id'] as String;
  }

  AdaMessageDto _fromMessage(Map<String, dynamic> m) {
    final createdAt = m['created_at'];
    return AdaMessageDto(
      id: m['id'] as String,
      role: m['is_user'] == true ? 'user' : 'ada',
      text: (m['text'] as String?) ?? '',
      createdAt: createdAt is String ? DateTime.tryParse(createdAt) : null,
    );
  }
}
