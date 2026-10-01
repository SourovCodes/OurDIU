import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Where the session token is kept between launches.
abstract interface class TokenStore {
  Future<String?> read();
  Future<void> write(String? token);
}

/// The Android Keystore (iOS: the Keychain), which `main` uses.
class SecureTokenStore implements TokenStore {
  static const _key = 'session_token';
  final _storage = const FlutterSecureStorage();

  @override
  Future<String?> read() async {
    try {
      return await _storage.read(key: _key);
    } catch (_) {
      // Unreadable after a restore to another device: sign in again.
      return null;
    }
  }

  @override
  Future<void> write(String? token) => token == null
      ? _storage.delete(key: _key)
      : _storage.write(key: _key, value: token);
}

/// For tests: forgotten when the app closes.
class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this.token]);

  String? token;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String? token) async => this.token = token;
}

final tokenStoreProvider = Provider<TokenStore>((ref) => MemoryTokenStore());

/// The token saved at the last launch; `main` reads it before the first frame.
final savedSessionTokenProvider = Provider<String?>((ref) => null);

/// The signed-in session's token, which the API accepts as a bearer token; null
/// when signed out.
class SessionToken extends Notifier<String?> {
  @override
  String? build() => ref.read(savedSessionTokenProvider);

  Future<void> set(String? token) async {
    state = token;
    await ref.read(tokenStoreProvider).write(token);
  }
}

final sessionTokenProvider = NotifierProvider<SessionToken, String?>(
  SessionToken.new,
);
