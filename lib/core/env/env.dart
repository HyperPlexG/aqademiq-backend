/// Compile-time environment configuration, supplied via `--dart-define`.
///
/// This is the single switch (README §7, seam 3) that flips the whole app
/// between mock data sources and the live Google Cloud backend. Until the
/// NestJS contract lands, the app runs entirely on mocks.
///
/// Example:
/// ```sh
/// flutter run --dart-define=USE_MOCKS=false \
///   --dart-define=API_BASE_URL=https://api.aqademiq.app \
///   --dart-define=SOCKET_URL=https://rt.aqademiq.app
/// ```
abstract final class Env {
  /// When `true` (the default) every repository is backed by a `MockXxxSource`
  /// returning delayed fixtures. Flip to `false` during the §8 wiring pass.
  static const bool useMocks =
      bool.fromEnvironment('USE_MOCKS', defaultValue: true);

  /// Base URL of the NestJS REST API on Cloud Run. Unused while [useMocks].
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Socket.IO endpoint (focus ticks / presence). Unused while [useMocks].
  static const String socketUrl = String.fromEnvironment('SOCKET_URL');

  /// Supabase project URL — identity (auth) + realtime. Required for live builds.
  /// e.g. https://qwvuoooentacjslzpbqy.supabase.co
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');

  /// Supabase anon/publishable key — safe to ship in the client.
  static const String supabaseAnonKey =
      String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Whether Supabase Auth is configured (live builds).
  static bool get hasSupabase =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  /// Google OAuth **Web** client id — used as `serverClientId` so the native
  /// id-token audience matches the Supabase Google provider. Required for Google
  /// sign-in on Android + iOS.
  static const String googleServerClientId =
      String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

  /// Google OAuth **iOS** client id — used as `clientId` on iOS only.
  static const String googleIosClientId =
      String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

  /// GCS bucket for signed-URL uploads. Unused while [useMocks].
  static const String gcsBucket = String.fromEnvironment('GCS_BUCKET');

  /// Whether the live backend has been configured. Guards accidental live runs.
  static bool get hasLiveConfig => apiBaseUrl.isNotEmpty;
}
