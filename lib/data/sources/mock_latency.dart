/// Shared mock-source latency so loading states are real (README §7, seam 3:
/// "fixtures return after a small delay and can throw").
Future<T> mockDelay<T>(T value, {int ms = 450}) =>
    Future<T>.delayed(Duration(milliseconds: ms), () => value);

Future<void> mockDelayVoid({int ms = 350}) =>
    Future<void>.delayed(Duration(milliseconds: ms));
