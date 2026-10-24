import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/api.dart';
import 'auth/token.dart';
import 'data/analytics.dart';
import 'data/prefs.dart';
import 'data/settings.dart';
import 'features/routine/routine_home_widget.dart';
import 'features/update/update_gate.dart';
import 'router.dart';
import 'spaces/space.dart';
import 'theme/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final tokens = SecureTokenStore();
  final (dir, prefs, token, _) = await (
    getApplicationSupportDirectory(),
    SharedPreferences.getInstance(),
    tokens.read(),
    startAnalytics(),
  ).wait;

  // Start the PDF engine now, in the background, so the first paper opens
  // without waiting for it (pdfrx's advice for apps that open documents).
  unawaited(pdfrxFlutterInitialize());

  final router = buildRouter(initialLocation: startLocation(prefs));
  trackScreens(router);
  // Before the router's own observer, which takes the links it's given.
  WidgetsBinding.instance.addObserver(AppLinkObserver());

  runApp(
    ProviderScope(
      overrides: [
        cookieJarProvider.overrideWithValue(
          PersistCookieJar(storage: FileStorage('${dir.path}/cookies/')),
        ),
        prefsProvider.overrideWithValue(prefs),
        tokenStoreProvider.overrideWithValue(tokens),
        savedSessionTokenProvider.overrideWithValue(token),
      ],
      child: QbApp(router: router),
    ),
  );
}

class QbApp extends ConsumerWidget {
  const QbApp({super.key, required this.router});

  final GoRouter router;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'OurDIU',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ref.watch(appearanceProvider),
      routerConfig: router,
      scaffoldMessengerKey: rootMessengerKey,
      builder: (context, child) => RoutineWidgetSync(
        router: router,
        child: UpdateGate(child: child!),
      ),
    );
  }
}
