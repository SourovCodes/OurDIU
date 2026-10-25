import 'package:diuqbank/data/analytics.dart';
import 'package:diuqbank/features/upload/papers.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _Recorded implements Analytics {
  final screens = <String>[];

  @override
  void screenView(String screen) => screens.add(screen);
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

void main() {
  tearDown(() => analytics = const NoAnalytics());

  testWidgets('screens are reported by route pattern, once each', (
    tester,
  ) async {
    final recorded = analytics = _Recorded();
    Widget page(BuildContext context, GoRouterState state) => const SizedBox();
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(path: '/home', builder: page),
        GoRoute(path: '/questions/:id', builder: page),
      ],
    );
    trackScreens(router);
    await tester.pumpWidget(
      WidgetsApp.router(routerConfig: router, color: const Color(0xFF000000)),
    );

    router.go('/questions/12?submission=3');
    await tester.pumpAndSettle();
    router.go('/questions/40');
    await tester.pumpAndSettle();

    // Another paper is the same screen; no ids reach Analytics.
    expect(recorded.screens, ['/home', '/questions/:id']);
  });
}
