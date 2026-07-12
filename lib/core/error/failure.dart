/// A single, typed error surface for the whole app (README §7: "typed Failure
/// + a single error -> toast/snackbar surface; never swallow exceptions").
///
/// Sources/repositories throw a [Failure]; the presentation layer renders it
/// via `AsyncValue.when(error: ...)`. Network/serialization details are mapped
/// into one of these variants in `data/sources` so widgets stay backend-blind.
sealed class Failure implements Exception {
  const Failure(this.message, {this.cause});

  /// Human-readable, surface-ready message.
  final String message;

  /// The originating error, if any (for logging — never shown to users).
  final Object? cause;

  @override
  String toString() => message;
}

/// No connectivity / request never reached the server.
final class NetworkFailure extends Failure {
  const NetworkFailure({
    String message = 'No connection. Check your network and try again.',
    super.cause,
  }) : super(message);
}

/// Server responded with an error status (4xx/5xx, non-auth).
final class ServerFailure extends Failure {
  const ServerFailure(super.message, {this.statusCode, super.cause});

  final int? statusCode;
}

/// Auth required / token invalid / 401-403.
final class AuthFailure extends Failure {
  const AuthFailure({
    String message = 'Please sign in to continue.',
    super.cause,
  }) : super(message);
}

/// Response could not be parsed into the expected DTO.
final class SerializationFailure extends Failure {
  const SerializationFailure(super.message, {super.cause});
}

/// A requested resource was not found.
final class NotFoundFailure extends Failure {
  const NotFoundFailure({String message = 'Not found.', super.cause})
      : super(message);
}

/// Anything we did not anticipate.
final class UnknownFailure extends Failure {
  const UnknownFailure({
    String message = 'Something went wrong. Please try again.',
    super.cause,
  }) : super(message);
}
