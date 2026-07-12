import 'package:dio/dio.dart';

import '../dtos/ada_message_dto.dart';
import 'mock_latency.dart';

abstract interface class AdaSource {
  Future<AdaMessageDto> reply(String userText, List<AdaMessageDto> history);
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
  Future<AdaMessageDto> reply(String userText, List<AdaMessageDto> history) {
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
}

class ApiAdaSource implements AdaSource {
  ApiAdaSource(this._dio);
  // Retained for the §8 wiring pass; real requests use this Dio (streamed
  // /ada/messages backed by Claude on Vertex AI).
  // ignore: unused_field
  final Dio _dio;

  @override
  Future<AdaMessageDto> reply(String userText, List<AdaMessageDto> history) =>
      throw UnimplementedError('ApiAdaSource is wired in the §8 pass.');
}
