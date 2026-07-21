import 'package:supabase_flutter/supabase_flutter.dart';

/// Basic shape check — deliberately permissive (one `@`, a dot in the domain, no
/// spaces). Real validity is only ever proven by the server; this exists to catch
/// obvious typos before spending a round trip on them.
final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

bool isValidEmail(String value) => _emailPattern.hasMatch(value.trim());

/// Maps an auth failure to a short, user-facing message.
///
/// Supabase answers a wrong password and an unknown email with the same
/// `invalid_credentials` — deliberately, so the endpoint can't be used to probe
/// which addresses have accounts. The copy here has to stay equally vague for
/// the same reason: it says "email or password", never which one was wrong.
String authErrorMessage(Object? error) {
  if (error is AuthException) {
    final message = error.message.toLowerCase();
    if (message.contains('invalid login credentials')) {
      return 'Email or password is incorrect.';
    }
    if (message.contains('email not confirmed')) {
      return 'Confirm your email first — check your inbox for the code.';
    }
    if (message.contains('already registered')) {
      return 'That email already has an account. Try signing in.';
    }
    if (message.contains('rate limit') || message.contains('too many')) {
      return 'Too many attempts. Wait a minute, then try again.';
    }
    if (message.contains('password should be')) {
      return error.message; // Supabase's own length/strength text is clearer.
    }
    return error.message;
  }
  return 'Could not sign in. Check your connection and try again.';
}
