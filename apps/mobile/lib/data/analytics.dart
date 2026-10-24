import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../features/upload/papers.dart';
import '../firebase_options.dart';

/// What the app reports to Google Analytics (docs/PLAN.md, decision 58): screens
/// by their route's pattern and a few actions, with names that need no custom
/// dimensions. Never the account, search terms, titles or names.
abstract interface class Analytics {
  /// [screen] is a route pattern, e.g. `/questions/:id`.
  void screenView(String screen);
  void login();

  /// The app was opened by an ourdiu.com link.
  void appLinkOpen();

  /// A paper's link was shared.
  void sharePaperLink(int questionId);

  /// A paper's PDF was downloaded to share or save it.
  void paperDownload();
  void uploadStart(PaperSource source);
  void uploadSubmit(PaperSource source);
}

class NoAnalytics implements Analytics {
  const NoAnalytics();

  @override
  void screenView(String screen) {}
  @override
  void login() {}
  @override
  void appLinkOpen() {}
  @override
  void sharePaperLink(int questionId) {}
  @override
  void paperDownload() {}
  @override
  void uploadStart(PaperSource source) {}
  @override
  void uploadSubmit(PaperSource source) {}
}

/// Reports go nowhere until `main` sets up Firebase: in debug builds, tests
/// and on iOS they never do.
Analytics analytics = const NoAnalytics();

/// Sets up Firebase and reporting for release builds on Android. Collection is
/// off in the manifest, so nothing is sent before this or from other builds.
Future<void> startAnalytics() async {
  if (!kReleaseMode || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    await Firebase.initializeApp(options: androidFirebaseOptions);
    final firebase = FirebaseAnalytics.instance;
    await firebase.setAnalyticsCollectionEnabled(true);
    analytics = _FirebaseAnalytics(firebase);
  } catch (e) {
    debugPrint('Analytics failed to start: $e');
  }
}

class _FirebaseAnalytics implements Analytics {
  _FirebaseAnalytics(this._firebase);

  final FirebaseAnalytics _firebase;

  @override
  void screenView(String screen) =>
      _firebase.logScreenView(screenName: screen, screenClass: screen);

  @override
  void login() => _firebase.logLogin(loginMethod: 'google');

  @override
  void appLinkOpen() => _firebase.logEvent(name: 'app_link_open');

  @override
  void sharePaperLink(int questionId) => _firebase.logShare(
    contentType: 'paper',
    itemId: '$questionId',
    method: 'link',
  );

  @override
  void paperDownload() => _firebase.logEvent(name: 'paper_download');

  @override
  void uploadStart(PaperSource source) => _firebase.logEvent(
    name: 'upload_start',
    parameters: {'source': _source(source)},
  );

  @override
  void uploadSubmit(PaperSource source) => _firebase.logEvent(
    name: 'upload_submit',
    parameters: {'source': _source(source)},
  );

  static String _source(PaperSource source) => switch (source) {
    PaperSource.scan => 'scan',
    PaperSource.files => 'file',
    PaperSource.shared => 'share',
  };
}

/// Reports a screen view whenever [router] settles on a different screen.
void trackScreens(GoRouter router) {
  String? last;
  void report() {
    final screen = router.routerDelegate.currentConfiguration.fullPath;
    if (screen.isEmpty || screen == last) return;
    last = screen;
    analytics.screenView(screen);
  }

  router.routerDelegate.addListener(report);
  report();
}

/// Reports `app_link_open` when an ourdiu.com link opens the app: on launch
/// (the link is the platform's first route) or while it's running.
class AppLinkObserver with WidgetsBindingObserver {
  AppLinkObserver() {
    if (WidgetsBinding.instance.platformDispatcher.defaultRouteName != '/') {
      analytics.appLinkOpen();
    }
  }

  @override
  Future<bool> didPushRouteInformation(RouteInformation routeInformation) {
    analytics.appLinkOpen();
    // The router handles the link itself.
    return Future.value(false);
  }
}
