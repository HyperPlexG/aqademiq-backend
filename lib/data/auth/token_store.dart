import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure, platform-backed storage for the API token pair (Keychain on iOS,
/// EncryptedSharedPreferences on Android). Written on sign-in / OTP-confirm /
/// refresh, read by the `AuthInterceptor`, cleared on sign-out.
class TokenStore {
  // Defaults are secure-backed on every platform (Keychain / Android Keystore).
  TokenStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _kAccess = 'aqademiq.access_token';
  static const _kRefresh = 'aqademiq.refresh_token';

  Future<String?> readAccess() => _storage.read(key: _kAccess);
  Future<String?> readRefresh() => _storage.read(key: _kRefresh);

  Future<bool> get hasSession async => (await readRefresh())?.isNotEmpty ?? false;

  Future<void> save({required String access, required String refresh}) async {
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
  }

  Future<void> saveAccess(String access) =>
      _storage.write(key: _kAccess, value: access);

  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}

final tokenStoreProvider = Provider<TokenStore>((_) => TokenStore());
