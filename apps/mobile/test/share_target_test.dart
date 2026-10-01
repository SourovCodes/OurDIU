import 'dart:io';

import 'package:diuqbank/auth/token.dart';
import 'package:diuqbank/features/upload/papers.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';
import 'fixtures.dart';

PickedPdf sharedPdf({int bytes = 900000}) {
  final file = File('${Directory.systemTemp.path}/qb-shared.pdf')
    ..writeAsBytesSync([0x25, 0x50, 0x44, 0x46]);
  return PickedPdf(
    path: file.path,
    name: 'math 1 final summer25.pdf',
    bytes: bytes,
    source: PaperSource.shared,
    pages: 3,
  );
}

FakeBackend signedIn() => FakeBackend({
  'GET /api/v1/me': (_) => reply(profileJson()),
  'GET /api/v1/me/submissions': (_) => reply({
    'items': [myPaperJson(3, status: 'published')],
  }),
});

void main() {
  testWidgets('a PDF shared to the app opens the upload form', (tester) async {
    await pumpApp(
      tester,
      backend: signedIn(),
      tokens: MemoryTokenStore('session.sig'),
      shared: FakeSharedPdfs(sharedPdf()),
    );

    expect(find.text('Share a paper'), findsWidgets);
    expect(find.text('math 1 final summer25.pdf'), findsOneWidget);
    expect(
      find.text('Shared from another app · 3 pages · 879 KB'),
      findsOneWidget,
    );
    // Your papers load after the form opens; it still starts on your department.
    expect(find.text('CSE · Computer Science and Engineering'), findsOneWidget);
  });

  testWidgets('shared while signed out, it asks to sign in first', (
    tester,
  ) async {
    final shared = FakeSharedPdfs();
    await pumpApp(tester, shared: shared);

    shared.controller.add(sharedPdf());
    await tester.pumpAndSettle();

    expect(find.text('Sign in to share papers'), findsOneWidget);
    expect(find.text('math 1 final summer25.pdf'), findsNothing);
  });

  testWidgets('says when a shared PDF is over the limit', (tester) async {
    final shared = FakeSharedPdfs();
    await pumpApp(
      tester,
      backend: signedIn(),
      tokens: MemoryTokenStore('session.sig'),
      shared: shared,
    );

    shared.controller.add(sharedPdf(bytes: 30 * 1024 * 1024));
    await tester.pumpAndSettle();

    expect(find.textContaining('This PDF is 30.0 MB'), findsOneWidget);
  });

  testWidgets("says when a shared file can't be read", (tester) async {
    final shared = FakeSharedPdfs();
    await pumpApp(
      tester,
      backend: signedIn(),
      tokens: MemoryTokenStore('session.sig'),
      shared: shared,
    );

    shared.controller.add(
      const PickedPdf(
        path: '',
        name: 'x.pdf',
        bytes: -1,
        source: PaperSource.shared,
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text("Couldn't open the shared file. Try saving it first."),
      findsOneWidget,
    );
  });
}
