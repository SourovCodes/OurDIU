import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../api/api.dart';
import '../api/generated/export.dart';
import 'token.dart';

/// The site's web OAuth client ID. Google issues the ID token for it, so the
/// API accepts the token as its own. The Android clients (package name and each
/// signing certificate) only have to exist in the same Google Cloud project
/// (`ourdiu`). Builds before the move used the `diuquestionbank` project's
/// client, which the API still accepts (GOOGLE_EXTRA_CLIENT_IDS). Client IDs
/// are public; the secret stays on the server.
const googleServerClientId =
    '279664469023-dgh2duvok7122vagev2f5llbl4ugctmg.apps.googleusercontent.com';

typedef GoogleIdToken = ({String token, String email});

/// Google's account picker on the phone (Credential Manager on Android).
abstract interface class GoogleAccounts {
  /// An ID token for the account the user picks; null if they close the picker.
  Future<GoogleIdToken?> pick();

  /// Forgets the account, so the picker asks again next time.
  Future<void> forget();
}

class PlatformGoogleAccounts implements GoogleAccounts {
  Future<void>? _initialized;

  Future<void> _init() => _initialized ??= GoogleSignIn.instance.initialize(
    serverClientId: googleServerClientId,
  );

  @override
  Future<GoogleIdToken?> pick() async {
    await _init();
    try {
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null) throw StateError('Google sent no ID token');
      return (token: token, email: account.email);
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      rethrow;
    }
  }

  @override
  Future<void> forget() async {
    await _init();
    await GoogleSignIn.instance.signOut();
  }
}

final googleAccountsProvider = Provider<GoogleAccounts>(
  (ref) => PlatformGoogleAccounts(),
);

/// Where a sign-in is, for the Account screen.
sealed class SignInState {
  const SignInState();
}

class SignInIdle extends SignInState {
  const SignInIdle();
}

class SigningIn extends SignInState {
  const SigningIn(this.email);
  final String email;
}

enum SignInOutcome { signedIn, cancelled, failed }

class SignIn extends Notifier<SignInState> {
  @override
  SignInState build() => const SignInIdle();

  /// Picks a Google account and swaps its ID token for a session.
  Future<SignInOutcome> signIn() async {
    if (state is SigningIn) return SignInOutcome.cancelled;
    final google = ref.read(googleAccountsProvider);
    final GoogleIdToken? picked;
    try {
      picked = await google.pick();
    } catch (e) {
      debugPrint('Google sign-in failed: $e');
      return SignInOutcome.failed;
    }
    if (picked == null) return SignInOutcome.cancelled;

    state = SigningIn(picked.email);
    try {
      final res = await ref
          .read(authDioProvider)
          .post<Object?>(
            '/api/auth/sign-in/social',
            data: {
              'provider': 'google',
              'idToken': {'token': picked.token},
            },
          );
      final token = res.headers.value('set-auth-token');
      if (token == null) throw StateError('The API sent no session token');
      await ref.read(sessionTokenProvider.notifier).set(token);
      state = const SignInIdle();
      return SignInOutcome.signedIn;
    } catch (e) {
      // Let the user pick again, rather than getting the same account back.
      await google.forget().catchError((_) {});
      debugPrint('Sign-in failed: $e');
      state = const SignInIdle();
      return SignInOutcome.failed;
    }
  }

  /// Ends the session on the API too, as far as the connection allows.
  Future<void> signOut() async {
    final token = ref.read(sessionTokenProvider);
    await ref.read(sessionTokenProvider.notifier).set(null);
    state = const SignInIdle();
    if (token != null) {
      ref
          .read(authDioProvider)
          .post<Object?>(
            '/api/auth/sign-out',
            options: Options(headers: {'authorization': 'Bearer $token'}),
          )
          .ignore();
    }
    ref.read(googleAccountsProvider).forget().ignore();
  }
}

final signInProvider = NotifierProvider<SignIn, SignInState>(SignIn.new);

/// The signed-in user; null when signed out.
final profileProvider = FutureProvider<Profile?>((ref) async {
  if (ref.watch(sessionTokenProvider) == null) return null;
  return ref.watch(qbApiProvider).account.getApiV1Me();
});
