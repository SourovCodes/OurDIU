import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/token.dart';
import 'generated/qb_api.dart';

/// The site the app talks to. Point it at a local dev server with
/// `--dart-define=API_BASE_URL=http://10.0.2.2:5173` (Android emulator) or
/// `http://localhost:5173` (iOS simulator).
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://ourdiu.com',
);

/// Cookies the API sets, like a browser keeps them. The view cookies make each
/// install count a page view at most once a day. `main` swaps in one that's saved
/// on the device; this in-memory one is for tests.
final cookieJarProvider = Provider<CookieJar>((ref) => CookieJar());

/// A URL the API returned, which can be relative to the site (avatars are).
Uri absoluteUrl(String url) => Uri.parse(apiBaseUrl).resolve(url);

final _baseOptions = BaseOptions(
  baseUrl: apiBaseUrl,
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 20),
);

/// Tests answer requests with a fake backend; null uses the network.
final httpAdapterProvider = Provider<HttpClientAdapter?>((ref) => null);

Dio _newDio(Ref ref) {
  final dio = Dio(_baseOptions);
  if (ref.watch(httpAdapterProvider) case final adapter?) {
    dio.httpClientAdapter = adapter;
  }
  ref.onDispose(dio.close);
  return dio;
}

/// Routes that act as the signed-in user. Only these get the session token:
/// public reads stay anonymous, so the site's cache can answer them.
bool needsSession(String path) =>
    path.startsWith('/api/v1/me') ||
    path == '/api/v1/submissions' ||
    RegExp(r'^/api/v1/submissions/\d+/(vote|reports)$').hasMatch(path);

final dioProvider = Provider<Dio>((ref) {
  final dio = _newDio(ref)
    ..interceptors.addAll([
      CookieManager(ref.watch(cookieJarProvider)),
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = ref.read(sessionTokenProvider);
          if (token != null && needsSession(options.path)) {
            options.headers['authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) {
          // The session ended elsewhere (signed out on the site, or expired).
          final sent = error.requestOptions.headers['authorization'];
          final token = ref.read(sessionTokenProvider);
          if (error.response?.statusCode == 401 && sent == 'Bearer $token') {
            ref.read(sessionTokenProvider.notifier).set(null);
          }
          handler.next(error);
        },
      ),
    ]);
  return dio;
});

/// For Better Auth's own endpoints (`/api/auth/*`): no cookies, so they never
/// see the site's session cookie, and the token is passed explicitly.
final authDioProvider = Provider<Dio>(_newDio);

final qbApiProvider = Provider<QbApi>((ref) => QbApi(ref.watch(dioProvider)));
